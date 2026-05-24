import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiConfigService } from '../ai-config.service';
import { AiCompletionInput, AiCompletionResult, AiProvider } from './ai-provider.types';

interface OpenRouterChatResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

@Injectable()
export class OpenRouterAiProvider implements AiProvider {
  constructor(@Inject(AiConfigService) private readonly aiConfig: AiConfigService) {}

  async createChatCompletion(input: AiCompletionInput): Promise<AiCompletionResult> {
    const config = this.aiConfig.getOpenRouterConfig();
    const model = input.model?.trim() || config.model;
    if (!config.apiKey) {
      throw new ServiceUnavailableException({
        code: 'AI_OPENROUTER_API_KEY_MISSING',
        message: 'OPENROUTER_API_KEY is not configured.',
        correlationId: input.correlationId,
      });
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...(config.httpReferer ? { 'HTTP-Referer': config.httpReferer } : {}),
          'X-Title': config.appTitle,
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          temperature: input.temperature ?? 0.1,
          ...(input.responseFormatJson ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new ServiceUnavailableException({
          code: 'AI_OPENROUTER_REQUEST_FAILED',
          message: 'OpenRouter request failed.',
          status: response.status,
          correlationId: input.correlationId,
        });
      }

      const payload = (await response.json()) as OpenRouterChatResponse;
      return {
        provider: 'openrouter',
        model: payload.model ?? model,
        content: payload.choices?.[0]?.message?.content ?? '',
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
        totalTokens: payload.usage?.total_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}