export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiCompletionInput {
  messages: AiMessage[];
  correlationId?: string;
  fallbackFromProvider?: string;
  responseFormatJson?: boolean;
  temperature?: number;
}

export interface AiCompletionResult {
  provider: string;
  model: string;
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiProvider {
  createChatCompletion(input: AiCompletionInput): Promise<AiCompletionResult>;
}