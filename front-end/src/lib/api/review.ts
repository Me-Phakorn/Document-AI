import { apiGet, apiPost } from '@/lib/api-client';
import type { AiAnalysisResultRecord } from './analysis';

export interface ReviewItemRecord {
  id: string;
  reviewType: 'SOURCE_AI_RESULT' | 'NOT_RELEVANT' | 'RULEBOOK_VERSION' | 'COMPLIANCE_CHECK';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES';
  outcome: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'CONFIRMED_NOT_RELEVANT' | 'OVERRIDDEN' | null;
  aiAnalysisResultId: string | null;
  aiAnalysisResult?: AiAnalysisResultRecord | null;
  complianceCheckId: string | null;
  complianceCheck?: unknown;
  reviewerId: string | null;
  roundNumber: number;
  comment: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export function listReviewItems(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<{ items: ReviewItemRecord[]; total: number; limit: number; offset: number }>(`/review/items?limit=${limit}&offset=${offset}`);
}

export function approveReviewItem(reviewItemId: string, comment?: string) {
  return apiPost(`/review/items/${reviewItemId}/approve`, { comment });
}

export function requestReviewChanges(reviewItemId: string, comment: string) {
  return apiPost(`/review/items/${reviewItemId}/request-changes`, { comment });
}

export function confirmReviewNotRelevant(reviewItemId: string, comment?: string) {
  return apiPost(`/review/items/${reviewItemId}/confirm-not-relevant`, { comment });
}

export function markDocumentVersionNotRelevant(documentVersionId: string, comment?: string) {
  return apiPost(`/review/document-versions/${documentVersionId}/not-relevant`, { comment });
}