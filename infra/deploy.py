import boto3
import os
import zipfile
import time
import argparse

def zip_project(zip_filename):
    print("Zipping project files...")
    ignore_dirs = ['.git', 'node_modules', 'infra']
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # Exclude ignored directories
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for file in files:
                if file == zip_filename or file.endswith('.zip'):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, '.')
                zipf.write(file_path, arcname)
    print(f"Project zipped into {zip_filename}")

def deploy_infrastructure(stack_name, template_file, db_password):
    cf_client = boto3.client('cloudformation')
    
    with open(template_file, 'r') as f:
        template_body = f.read()
        
    print(f"Deploying CloudFormation stack: {stack_name}...")
    
    try:
        cf_client.create_stack(
            StackName=stack_name,
            TemplateBody=template_body,
            Parameters=[
                {'ParameterKey': 'DBPassword', 'ParameterValue': db_password}
            ],
            Capabilities=['CAPABILITY_NAMED_IAM']
        )
        print("Stack creation initiated. Waiting for completion (this may take 10-15 minutes)...")
        waiter = cf_client.get_waiter('stack_create_complete')
        waiter.wait(StackName=stack_name, WaiterConfig={'Delay': 30, 'MaxAttempts': 60})
        print("Stack created successfully!")
    except cf_client.exceptions.AlreadyExistsException:
        print("Stack already exists. Updating...")
        try:
            cf_client.update_stack(
                StackName=stack_name,
                TemplateBody=template_body,
                Parameters=[
                    {'ParameterKey': 'DBPassword', 'ParameterValue': db_password}
                ],
                Capabilities=['CAPABILITY_NAMED_IAM']
            )
            print("Stack update initiated. Waiting for completion...")
            waiter = cf_client.get_waiter('stack_update_complete')
            waiter.wait(StackName=stack_name, WaiterConfig={'Delay': 30, 'MaxAttempts': 60})
            print("Stack updated successfully!")
        except Exception as e:
            if 'No updates are to be performed' in str(e):
                print("No infrastructure updates required.")
            else:
                raise e

    # Get outputs
    response = cf_client.describe_stacks(StackName=stack_name)
    outputs = response['Stacks'][0]['Outputs']
    return {output['OutputKey']: output['OutputValue'] for output in outputs}

def deploy_app_version(app_name, env_name, zip_filename, s3_bucket):
    s3_client = boto3.client('s3')
    eb_client = boto3.client('elasticbeanstalk')
    
    version_label = f"v-{int(time.time())}"
    s3_key = f"app-versions/{version_label}.zip"
    
    print(f"Uploading {zip_filename} to S3 bucket {s3_bucket} at {s3_key}...")
    s3_client.upload_file(zip_filename, s3_bucket, s3_key)
    
    print(f"Creating Elastic Beanstalk application version {version_label}...")
    eb_client.create_application_version(
        ApplicationName=app_name,
        VersionLabel=version_label,
        SourceBundle={'S3Bucket': s3_bucket, 'S3Key': s3_key},
        Process=True
    )
    
    print(f"Deploying version {version_label} to environment {env_name}...")
    eb_client.update_environment(
        ApplicationName=app_name,
        EnvironmentName=env_name,
        VersionLabel=version_label
    )
    
    print("Deployment initiated. Waiting for environment to update...")
    time.sleep(10) # Give it a moment to start
    while True:
        response = eb_client.describe_environments(
            ApplicationName=app_name,
            EnvironmentNames=[env_name]
        )
        status = response['Environments'][0]['Status']
        health = response['Environments'][0]['Health']
        print(f"Status: {status}, Health: {health}")
        
        if status == 'Ready':
            break
        time.sleep(15)
    
    print("Application deployment completed successfully!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--db-password', required=True, help='Database password')
    args = parser.parse_args()

    STACK_NAME = 'project-track-stack'
    TEMPLATE_FILE = 'infra/template.yaml'
    APP_NAME = 'Project Track App'
    ZIP_FILE = 'app.zip'
    
    # 1. Zip project
    zip_project(ZIP_FILE)
    
    # 2. Deploy Infrastructure
    outputs = deploy_infrastructure(STACK_NAME, TEMPLATE_FILE, args.db_password)
    
    bucket_name = outputs['BucketName']
    
    # Need to get Environment Name from EB Client because CF output doesn't give it directly unless specified
    eb_client = boto3.client('elasticbeanstalk')
    envs = eb_client.describe_environments(ApplicationName=APP_NAME)['Environments']
    env_name = envs[0]['EnvironmentName']
    
    # 3. Deploy App to Beanstalk
    deploy_app_version(APP_NAME, env_name, ZIP_FILE, bucket_name)
    
    print("\n===========================")
    print("DEPLOYMENT COMPLETE")
    print(f"Website URL: http://{outputs['WebsiteURL']}")
    print("===========================\n")

    github_env = os.environ.get('GITHUB_ENV')
    if github_env:
        with open(github_env, 'a') as f:
            f.write(f"DB_HOST={outputs['DBEndpoint']}\n")
