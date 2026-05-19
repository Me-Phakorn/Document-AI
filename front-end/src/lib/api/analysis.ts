import { apiGet, apiPost } from '@/lib/api-client';
import type { DocumentVersionRecord } from './documents';

export interface AiAnalysisResultRecord {
  id: string;
  documentVersionId: string;
  promptInstanceId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  outcome: 'RULES_FOUND' | 'NO_RULES_FOUND' | 'NOT_RELEVANT' | 'FAILED' | null;
  confidence: number | null;
  result: unknown;
  tokenUsage: number | null;
  estimatedCost: string | null;
  latencyMs: number | null;
  createdAt: string;
  updatedAt: string;
  documentVersion?: DocumentVersionRecord;
  reviews?: Array<{ id: string; status: string; reviewType: string; outcome: string | null; comment: string | null }>;
}

export interface AiConfigResponse {
  provider: string;
  fallbackProvider?: string;
  model: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  requestTimeoutMs: number;
  appTitle: string;
  httpRefererConfigured: boolean;
  claudeCodeConfigured: boolean;
  claudeCodeCommand: string;
  claudeCodeModel: string;
  claudeCodeTimeoutMs: number;
}

export function getAiConfig() {
  return apiGet<AiConfigResponse>('/analysis/ai-config');
}

export function listAnalysisResults(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<{ items: AiAnalysisResultRecord[]; total: number; limit: number; offset: number }>(`/analysis/results?limit=${limit}&offset=${offset}`);
}

export function runDocumentAnalysis(documentVersionId: string) {
  return apiPost<AiAnalysisResultRecord>(`/analysis/document-versions/${documentVersionId}/run`);
}