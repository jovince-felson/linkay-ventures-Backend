import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({
  region:      process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;
const EXPIRES_IN = Number(process.env.S3_PRESIGN_EXPIRES || 900);

export function buildFileKey(assetId, mediaType, originalName) {
  const ext  = originalName.split('.').pop().toLowerCase();
  const type = mediaType.toLowerCase().replace('_', '-');
  return `assets/${assetId}/${type}/${uuidv4()}.${ext}`;
}

export async function generatePresignedUploadUrl(fileKey, mimeType) {
  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         fileKey,
    ContentType: mimeType,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN });
  const fileUrl   = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${fileKey}`;
  return { uploadUrl, fileUrl };
}

export async function generatePresignedDownloadUrl(fileKey) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: fileKey });
  return getSignedUrl(s3, command, { expiresIn: EXPIRES_IN });
}

export async function deleteS3Object(fileKey) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }));
}

export async function fileExistsInS3(fileKey) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: fileKey }));
    return true;
  } catch {
    return false;
  }
}
