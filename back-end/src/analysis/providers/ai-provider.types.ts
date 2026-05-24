export type AiMessageRole = 'system' | 'user' | 'assistant';

export type AiMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface AiMessage {
  role: AiMessageRole;
  content: string | AiMessageContentPart[];
}

export interface AiCompletionInput {
  messages: AiMessage[];
  correlationId?: string;
  fallbackFromProvider?: string;
  model?: string;
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