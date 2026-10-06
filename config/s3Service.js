const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const dotenv = require("dotenv");

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-2"
});

const getBucketName = () => {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("AWS_S3_BUCKET_NAME is not configured.");
  }

  return bucketName;
};

const uploadFileToS3 = async (fileBuffer, fileName, mimeType, projectId) => {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const s3ObjectKey = `projects/${projectId}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFileName}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: getBucketName(),
    Key: s3ObjectKey,
    Body: fileBuffer,
    ContentType: mimeType || "application/octet-stream"
  }));

  return { s3ObjectKey };
};

const getFileFromS3 = async (s3ObjectKey) => s3Client.send(new GetObjectCommand({
  Bucket: getBucketName(),
  Key: s3ObjectKey
}));

const getFileDownloadUrl = async (s3ObjectKey) => getSignedUrl(
  s3Client,
  new GetObjectCommand({
    Bucket: getBucketName(),
    Key: s3ObjectKey
  }),
  { expiresIn: 3600 }
);

const deleteFileFromS3 = async (s3ObjectKey) => s3Client.send(new DeleteObjectCommand({
  Bucket: getBucketName(),
  Key: s3ObjectKey
}));

module.exports = {
  s3Client,
  uploadFileToS3,
  getFileFromS3,
  getFileDownloadUrl,
  deleteFileFromS3,
  getBucketName
};
