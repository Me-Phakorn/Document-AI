import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderConfigDto } from './dto/ai-provider-config.dto';

export interface OpenRouterConfig {
  apiKey?: string;
  appTitle: string;
  baseUrl: string;
  httpReferer?: string;
  model: string;
  requestTimeoutMs: number;
}

export interface ClaudeCodeConfig {
  command: string;
  disableTools: boolean;
  model: string;
  requestTimeoutMs: number;
}

@Injectable()
export class AiConfigService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get provider() {
    return this.config.get<string>('AI_PROVIDER', 'openrouter');
  }

  get fallbackProvider() {
    return this.config.get<string>('AI_FALLBACK_PROVIDER')?.trim() || undefined;
  }

  get model() {
    return this.config.get<string>('AI_MODEL', this.config.get<string>('OPENROUTER_MODEL', 'openai/gpt-4o-mini'));
  }

  get requestTimeoutMs() {
    return this.readPositiveInteger('AI_REQUEST_TIMEOUT_MS', 60_000);
  }

  getOpenRouterConfig(): OpenRouterConfig {
    return {
      apiKey: this.config.get<string>('OPENROUTER_API_KEY')?.trim() || undefined,
      appTitle: this.config.get<string>('OPENROUTER_APP_TITLE', 'DocAI'),
      baseUrl: this.config.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
      httpReferer: this.config.get<string>('OPENROUTER_HTTP_REFERER')?.trim() || undefined,
      model: this.model,
      requestTimeoutMs: this.requestTimeoutMs,
    };
  }

  getClaudeCodeConfig(): ClaudeCodeConfig {
    return {
      command: this.config.get<string>('CLAUDE_CODE_COMMAND', 'claude'),
      disableTools: this.readBoolean('CLAUDE_CODE_DISABLE_TOOLS', true),
      model: this.config.get<string>('CLAUDE_CODE_MODEL', 'sonnet'),
      requestTimeoutMs: this.readPositiveInteger('CLAUDE_CODE_TIMEOUT_MS', 120_000),
    };
  }

  getPublicSummary(): AiProviderConfigDto {
    const openRouter = this.getOpenRouterConfig();
    const claudeCode = this.getClaudeCodeConfig();

    return {
      provider: this.provider,
      fallbackProvider: this.fallbackProvider,
      model: openRouter.model,
      baseUrl: openRouter.baseUrl,
      apiKeyConfigured: Boolean(openRouter.apiKey),
      requestTimeoutMs: openRouter.requestTimeoutMs,
      appTitle: openRouter.appTitle,
      httpRefererConfigured: Boolean(openRouter.httpReferer),
      claudeCodeConfigured: Boolean(claudeCode.command),
      claudeCodeCommand: claudeCode.command,
      claudeCodeModel: claudeCode.model,
      claudeCodeTimeoutMs: claudeCode.requestTimeoutMs,
    };
  }

  private readBoolean(key: string, fallback: boolean) {
    const value = this.config.get<string>(key);
    if (!value) return fallback;

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private readPositiveInteger(key: string, fallback: number) {
    const value = this.config.get<string>(key);
    if (!value) return fallback;

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}