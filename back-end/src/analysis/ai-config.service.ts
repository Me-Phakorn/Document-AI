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

interface OpenRouterModelsResponse {
  data?: Array<{
    id?: unknown;
  }>;
}

@Injectable()
export class AiConfigService {
  private modelCache?: { fetchedAt: number; models: string[] };
  private readonly modelCacheTtlMs = 5 * 60 * 1000;

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

  async getPublicSummary(): Promise<AiProviderConfigDto> {
    const openRouter = this.getOpenRouterConfig();
    const claudeCode = this.getClaudeCodeConfig();

    return {
      provider: this.provider,
      fallbackProvider: this.fallbackProvider,
      model: openRouter.model,
      modelOptions: await this.getOpenRouterModelOptions(),
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

  private async getOpenRouterModelOptions() {
    const fallback = [this.model];
    if (this.modelCache && Date.now() - this.modelCache.fetchedAt < this.modelCacheTtlMs) {
      return this.modelCache.models;
    }

    const openRouter = this.getOpenRouterConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(openRouter.requestTimeoutMs, 10_000));

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (openRouter.apiKey) headers.Authorization = `Bearer ${openRouter.apiKey}`;
      if (openRouter.httpReferer) headers['HTTP-Referer'] = openRouter.httpReferer;
      if (openRouter.appTitle) headers['X-Title'] = openRouter.appTitle;

      const response = await fetch(`${openRouter.baseUrl}/models`, { headers, signal: controller.signal });
      if (!response.ok) return fallback;

      const payload = (await response.json()) as OpenRouterModelsResponse;
      const models = payload.data
        ?.map((model) => (typeof model.id === 'string' ? model.id.trim() : ''))
        .filter(Boolean) ?? [];
      const modelOptions = Array.from(new Set([this.model, ...models]));
      this.modelCache = { fetchedAt: Date.now(), models: modelOptions };
      return modelOptions;
    } catch {
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
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