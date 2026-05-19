import { Module } from '@nestjs/common';
import { MinioStorageService } from './minio-storage.service';
import { ObjectKeyService } from './object-key.service';

@Module({
  providers: [ObjectKeyService, MinioStorageService],
  exports: [ObjectKeyService, MinioStorageService],
})
export class StorageModule {}