import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    bucket: process.env.S3_BUCKET || 'hr-documents',
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION || 'ap-southeast-1',
    presignExpiresSeconds: parseInt(
      process.env.S3_PRESIGN_EXPIRES_SECONDS || '900',
      10,
    ),
  },
}));
