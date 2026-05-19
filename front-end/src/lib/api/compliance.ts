import { apiGet, apiPost } from '@/lib/api-client';

export interface ComplianceCheckRecord {
  id: string;
  inputType: 'IMAGE' | 'PDF' | 'TEXT' | 'URL' | 'SOCIAL_POST' | 'SCREENSHOT';
  status: string;
  selectedRulebookVersionId: string | null;
  selectedReportId: string | null;
  inputHash: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  results: Array<{
    id: string;
    versionNumber: number;
    status: string;
    summary: string | null;
    matchedRules: unknown;
    recommendedAction: string | null;
    createdAt: string;
  }>;
}

export function listComplianceChecks(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<{ items: ComplianceCheckRecord[]; total: number; limit: number; offset: number }>(`/compliance/checks?limit=${limit}&offset=${offset}`);
}

export function createComplianceCheck(input: { content: string; title?: string; selectedRulebookVersionId?: string; inputType?: string }) {
  return apiPost<ComplianceCheckRecord>('/compliance/checks', { inputType: 'TEXT', ...input });
}