import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AiCompletionInput, AiCompletionResult, AiProvider } from './providers/ai-provider.types';
import { ClaudeCodeAiProvider } from './providers/claude-code-ai.provider';
import { OpenRouterAiProvider } from './providers/openrouter-ai.provider';

@Injectable()
export class AiCompletionService implements AiProvider {
  constructor(
    @Inject(AiConfigService)
    private readonly aiConfig: AiConfigService,
    @Inject(OpenRouterAiProvider)
    private readonly openRouter: OpenRouterAiProvider,
    @Inject(ClaudeCodeAiProvider)
    private readonly claudeCode: ClaudeCodeAiProvider,
  ) {}

  async createChatCompletion(input: AiCompletionInput): Promise<AiCompletionResult> {
    const provider = this.aiConfig.provider;
    const fallbackProvider = this.aiConfig.fallbackProvider;

    try {
      return await this.getProvider(provider).createChatCompletion(input);
    } catch (error) {
      if (!fallbackProvider || fallbackProvider === provider) {
        throw error;
      }

      return this.getProvider(fallbackProvider).createChatCompletion({
        ...input,
        fallbackFromProvider: provider,
      });
    }
  }

  private getProvider(provider: string): AiProvider {
    switch (provider) {
      case 'openrouter':
        return this.openRouter;
      case 'claude-code':
        return this.claudeCode;
      default:
        throw new ServiceUnavailableException({
          code: 'AI_PROVIDER_NOT_SUPPORTED',
          message: `AI provider '${provider}' is not supported.`,
        });
    }
  }
}