import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import type { Readable } from 'node:stream';

export interface PutObjectInput {
  bucket: string;
  objectKey: string;
  content: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class MinioStorageService {
  private readonly client: MinioClient;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new MinioClient({
      endPoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
      port: Number(config.get<string>('MINIO_PORT', '9000')),
      accessKey: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
      useSSL: ['1', 'true', 'yes', 'on'].includes(config.get<string>('MINIO_USE_SSL', 'false').toLowerCase()),
    });
  }

  async readTextObject(bucket: string, objectKey: string) {
    try {
      const stream = await this.client.getObject(bucket, objectKey);
      return this.readStream(stream);
    } catch (error) {
      throw new NotFoundException({
        code: 'STORED_OBJECT_NOT_READABLE',
        message: 'The stored OCR text artifact could not be read.',
        bucket,
        objectKey,
      });
    }
  }

  async putObject(input: PutObjectInput) {
    await this.ensureBucket(input.bucket);
    await this.client.putObject(input.bucket, input.objectKey, input.content, input.content.byteLength, {
      'Content-Type': input.contentType,
      ...input.metadata,
    });
  }

  async ensureBucket(bucket: string) {
    const exists = await this.client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(bucket);
    }
  }

  private readStream(stream: Readable) {
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }
}