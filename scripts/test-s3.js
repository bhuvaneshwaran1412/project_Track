const { ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getBucketName, s3Client } = require("../config/s3Service");

const testConnection = async () => {
  await s3Client.send(new ListObjectsV2Command({
    Bucket: getBucketName(),
    MaxKeys: 1
  }));

  console.log("S3 bucket access verified.");
};

testConnection().catch((error) => {
  console.error("S3 connection test failed:", error.message);
  process.exitCode = 1;
});
