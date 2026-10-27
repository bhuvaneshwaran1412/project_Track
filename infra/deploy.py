import boto3
import os
import zipfile
import time
import argparse
import subprocess
import traceback
import sys

for var in ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION', 'AWS_REGION', 'AWS_SESSION_TOKEN']:
    if var in os.environ and os.environ[var]:
        os.environ[var] = os.environ[var].strip()

AWS_REGION = os.environ.get('AWS_REGION', 'ap-southeast-2')

def zip_project(zip_filename):
    print("Zipping project files...", flush=True)
    ignore_dirs = {'.git', 'node_modules', 'infra', '.vscode'}
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith('.')]
            for file in files:
                if file == zip_filename or file.endswith('.zip') or file.startswith('.'):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, '.')
                zipf.write(file_path, arcname)
    print(f"Project zipped into {zip_filename}", flush=True)

def deploy_infrastructure(stack_name, template_file, db_password):
    cf_client = boto3.client('cloudformation', region_name=AWS_REGION)
    
    with open(template_file, 'r') as f:
        template_body = f.read()
        
    print(f"Checking CloudFormation stack: {stack_name} in {AWS_REGION}...", flush=True)
    stack_exists = False
    try:
        cf_client.describe_stacks(StackName=stack_name)
        stack_exists = True
    except Exception:
        stack_exists = False

    if not stack_exists:
        print(f"Creating CloudFormation stack: {stack_name}...", flush=True)
        cf_client.create_stack(
            StackName=stack_name,
            TemplateBody=template_body,
            Parameters=[
                {'ParameterKey': 'DBPassword', 'ParameterValue': db_password}
            ],
            Capabilities=['CAPABILITY_NAMED_IAM']
        )
        print("Stack creation initiated. Waiting for completion (this may take 8-12 minutes for RDS & Beanstalk)...", flush=True)
        waiter = cf_client.get_waiter('stack_create_complete')
        waiter.wait(StackName=stack_name, WaiterConfig={'Delay': 30, 'MaxAttempts': 60})
        print("Stack created successfully!", flush=True)
    else:
        print(f"Stack {stack_name} exists. Checking for updates...", flush=True)
        try:
            cf_client.update_stack(
                StackName=stack_name,
                TemplateBody=template_body,
                Parameters=[
                    {'ParameterKey': 'DBPassword', 'ParameterValue': db_password}
                ],
                Capabilities=['CAPABILITY_NAMED_IAM']
            )
            print("Stack update initiated. Waiting for completion...", flush=True)
            waiter = cf_client.get_waiter('stack_update_complete')
            waiter.wait(StackName=stack_name, WaiterConfig={'Delay': 30, 'MaxAttempts': 60})
            print("Stack updated successfully!", flush=True)
        except Exception as e:
            if 'No updates are to be performed' in str(e):
                print("No infrastructure updates required.", flush=True)
            else:
                print(f"Stack update status: {e}", flush=True)

    # Get outputs
    response = cf_client.describe_stacks(StackName=stack_name)
    outputs = response['Stacks'][0]['Outputs']
    return {output['OutputKey']: output['OutputValue'] for output in outputs}

def deploy_app_version(app_name, env_name, zip_filename, s3_bucket):
    s3_client = boto3.client('s3', region_name=AWS_REGION)
    eb_client = boto3.client('elasticbeanstalk', region_name=AWS_REGION)
    
    print(f"Checking environment {env_name} status...", flush=True)
    while True:
        env_resp = eb_client.describe_environments(
            ApplicationName=app_name,
            EnvironmentNames=[env_name]
        )
        current_status = env_resp['Environments'][0]['Status']
        if current_status == 'Ready':
            print(f"Environment {env_name} is Ready.", flush=True)
            break
        print(f"Environment is currently in '{current_status}' state. Waiting 15s...", flush=True)
        time.sleep(15)

    version_label = f"v-{int(time.time())}"
    s3_key = f"app-versions/{version_label}.zip"
    
    print(f"Uploading {zip_filename} to S3 bucket {s3_bucket} at {s3_key}...", flush=True)
    s3_client.upload_file(zip_filename, s3_bucket, s3_key)
    
    print(f"Creating Elastic Beanstalk application version {version_label}...", flush=True)
    eb_client.create_application_version(
        ApplicationName=app_name,
        VersionLabel=version_label,
        SourceBundle={'S3Bucket': s3_bucket, 'S3Key': s3_key},
        Process=True
    )
    
    print(f"Deploying version {version_label} to environment {env_name}...", flush=True)
    eb_client.update_environment(
        ApplicationName=app_name,
        EnvironmentName=env_name,
        VersionLabel=version_label
    )
    
    print("Deployment initiated. Waiting for environment to update...", flush=True)
    time.sleep(15)
    while True:
        response = eb_client.describe_environments(
            ApplicationName=app_name,
            EnvironmentNames=[env_name]
        )
        env_data = response['Environments'][0]
        status = env_data['Status']
        health = env_data['Health']
        current_version = env_data.get('VersionLabel', '')
        print(f"Status: {status}, Health: {health}, Version: {current_version}", flush=True)
        
        if status == 'Ready' and current_version == version_label:
            break
        time.sleep(15)
    
    print("Application deployment completed successfully!", flush=True)

if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument('--db-password', default='AdminPass123!', help='Database password')
        parser.add_argument('--region', default='ap-southeast-2', help='AWS Region')
        args = parser.parse_args()
        db_password = args.db_password if args.db_password else 'AdminPass123!'
        AWS_REGION = args.region

        STACK_NAME = 'project-track-stack'
        TEMPLATE_FILE = 'infra/template.yaml'
        ZIP_FILE = 'app.zip'
        
        # 1. Zip project
        zip_project(ZIP_FILE)
        
        # 2. Deploy Infrastructure
        outputs = deploy_infrastructure(STACK_NAME, TEMPLATE_FILE, db_password)
        
        bucket_name = outputs['BucketName']
        
        # Dynamically resolve Application Name and Environment Name from CloudFormation resources
        cf_client = boto3.client('cloudformation', region_name=AWS_REGION)
        resources = cf_client.describe_stack_resources(StackName=STACK_NAME)['StackResources']
        app_name = next(r['PhysicalResourceId'] for r in resources if r['LogicalResourceId'] == 'EBApplication')
        env_name = next(r['PhysicalResourceId'] for r in resources if r['LogicalResourceId'] == 'EBEnvironment')
        
        # 3. Deploy App to Beanstalk
        deploy_app_version(app_name, env_name, ZIP_FILE, bucket_name)

        # 4. Initialize Database
        print("Initializing RDS MySQL database with backup.sql...", flush=True)
        for attempt in range(1, 6):
            try:
                subprocess.run(
                    ['node', 'infra/init_db.js', outputs['DBEndpoint'], 'admin', db_password, 'projecttrack'],
                    check=True
                )
                print("Database initialized successfully!", flush=True)
                break
            except Exception as e:
                print(f"Database init attempt {attempt}/5 failed: {e}. Retrying in 10s...", flush=True)
                time.sleep(10)
        
        print("\n=======================================================", flush=True)
        print("DEPLOYMENT COMPLETE! YOUR PLATFORM IS LIVE!", flush=True)
        print(f"Website URL: http://{outputs['WebsiteURL']}", flush=True)
        print(f"Login Page: http://{outputs['WebsiteURL']}/login.html", flush=True)
        print(f"RDS MySQL Host: {outputs['DBEndpoint']}", flush=True)
        print(f"S3 Bucket: {outputs['BucketName']}", flush=True)
        print("=======================================================\n", flush=True)

        github_env = os.environ.get('GITHUB_ENV')
        if github_env:
            with open(github_env, 'a') as f:
                f.write(f"DB_HOST={outputs['DBEndpoint']}\n")
    except Exception as e:
        print("\n*** DEPLOYMENT FAILED WITH EXCEPTION ***", flush=True)
        traceback.print_exc()
        sys.exit(1)
