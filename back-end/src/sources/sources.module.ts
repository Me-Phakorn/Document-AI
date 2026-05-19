import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  imports: [AuditModule],
  controllers: [SourcesController],
  providers: [SourcesService],
})
export class SourcesModule {}