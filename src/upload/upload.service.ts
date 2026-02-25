import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private s3: S3Client;
  private bucket = process.env.AWS_S3_BUCKET!;
  private cdnBase = process.env.CLOUDFRONT_BASE_URL!;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async getPresignedUrl(
    filename: string,
    contentType: string,
    folder: string,
  ) {
    const ext = filename.split('.').pop() ?? 'bin';
    const key = `${folder}/${Date.now()}-${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 300, // 5 minutes
    });

    return {
      presignedUrl,
      publicUrl: `${this.cdnBase}/${key}`,
      key,
    };
  }
}
