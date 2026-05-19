import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { AiCompletionService } from './ai-completion.service';
import { AiConfigService } from './ai-config.service';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { ClaudeCodeAiProvider } from './providers/claude-code-ai.provider';
import { OpenRouterAiProvider } from './providers/openrouter-ai.provider';

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [AnalysisController],
  providers: [AiConfigService, AnalysisService, AiCompletionService, OpenRouterAiProvider, ClaudeCodeAiProvider],
  exports: [AiConfigService, AnalysisService, AiCompletionService, OpenRouterAiProvider, ClaudeCodeAiProvider],
})
export class AnalysisModule {}