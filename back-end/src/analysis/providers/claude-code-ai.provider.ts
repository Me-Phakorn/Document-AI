import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { AiConfigService } from '../ai-config.service';
import { AiCompletionInput, AiCompletionResult, AiMessage, AiProvider } from './ai-provider.types';

interface ClaudeCodeJsonResponse {
  result?: string;
  content?: string;
  message?: {
    content?: string | Array<{ text?: string }>;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

@Injectable()
export class ClaudeCodeAiProvider implements AiProvider {
  constructor(@Inject(AiConfigService) private readonly aiConfig: AiConfigService) {}

  async createChatCompletion(input: AiCompletionInput): Promise<AiCompletionResult> {
    const config = this.aiConfig.getClaudeCodeConfig();
    const systemPrompt = this.extractSystemPrompt(input.messages);
    const prompt = this.renderPrompt(input.messages, input.fallbackFromProvider);
    const args = [
      '--print',
      '--output-format',
      'json',
      '--input-format',
      'text',
      '--no-session-persistence',
      '--model',
      config.model,
      '--permission-mode',
      'dontAsk',
    ];

    if (config.disableTools) {
      args.push('--tools', '');
    }

    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    const stdout = await this.runClaude(config.command, args, prompt, config.requestTimeoutMs, input.correlationId);
    const parsed = this.parseResponse(stdout);

    return {
      provider: 'claude-code',
      model: config.model,
      content: parsed.content,
      promptTokens: parsed.promptTokens,
      completionTokens: parsed.completionTokens,
      totalTokens: parsed.totalTokens,
    };
  }

  private runClaude(command: string, args: string[], input: string, timeoutMs: number, correlationId?: string) {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(
          new ServiceUnavailableException({
            code: 'AI_CLAUDE_CODE_CLI_UNAVAILABLE',
            message: 'Claude Code CLI could not be started.',
            detail: error.message,
            correlationId,
          }),
        );
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (timedOut) {
          reject(
            new ServiceUnavailableException({
              code: 'AI_CLAUDE_CODE_TIMEOUT',
              message: 'Claude Code CLI request timed out.',
              correlationId,
            }),
          );
          return;
        }

        if (code !== 0) {
          reject(
            new ServiceUnavailableException({
              code: 'AI_CLAUDE_CODE_REQUEST_FAILED',
              message: 'Claude Code CLI request failed.',
              exitCode: code,
              stderr: this.redact(stderr),
              correlationId,
            }),
          );
          return;
        }

        resolve(stdout);
      });

      child.stdin.write(input);
      child.stdin.end();
    });
  }

  private extractSystemPrompt(messages: AiMessage[]) {
    return messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
      .trim();
  }

  private renderPrompt(messages: AiMessage[], fallbackFromProvider?: string) {
    const nonSystemMessages = messages.filter((message) => message.role !== 'system');
    const prefix = fallbackFromProvider ? `Primary provider '${fallbackFromProvider}' failed. Continue the same task using Claude Code.\n\n` : '';

    return `${prefix}${nonSystemMessages
      .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
      .join('\n\n')}`.trim();
  }

  private parseResponse(stdout: string) {
    const trimmed = stdout.trim();
    if (!trimmed) {
      return { content: '' };
    }

    try {
      const payload = JSON.parse(trimmed) as ClaudeCodeJsonResponse;
      const content = this.extractContent(payload) || trimmed;
      const inputTokens = payload.usage?.input_tokens;
      const outputTokens = payload.usage?.output_tokens;
      const cacheCreationTokens = payload.usage?.cache_creation_input_tokens ?? 0;
      const cacheReadTokens = payload.usage?.cache_read_input_tokens ?? 0;
      const promptTokens = inputTokens === undefined ? undefined : inputTokens + cacheCreationTokens + cacheReadTokens;

      return {
        content,
        promptTokens,
        completionTokens: outputTokens,
        totalTokens: promptTokens === undefined || outputTokens === undefined ? undefined : promptTokens + outputTokens,
      };
    } catch {
      return { content: trimmed };
    }
  }

  private extractContent(payload: ClaudeCodeJsonResponse) {
    if (payload.result) return payload.result;
    if (payload.content) return payload.content;

    const messageContent = payload.message?.content;
    if (typeof messageContent === 'string') return messageContent;
    if (Array.isArray(messageContent)) {
      return messageContent.map((item) => item.text).filter(Boolean).join('\n');
    }

    return undefined;
  }

  private redact(value: string) {
    return value.replace(/(api[_-]?key|token|authorization)(\s*[:=]\s*)\S+/gi, '$1$2[redacted]');
  }
}