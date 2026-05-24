import { apiGet, apiPost } from '@/lib/api-client';

export interface RuleVersionRecord {
  id: string;
  masterRulebookVersionId: string;
  ruleCode: string;
  category: string | null;
  title: string;
  description: string;
  condition: string | null;
  prohibition: string | null;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  sourceReferences: unknown;
  createdAt: string;
}

export interface SourceDocumentInfo {
  documentVersionId: string;
  documentId: string;
  documentVersionNumber: number;
  title: string;
}

export interface MasterRulebookVersionRecord {
  id: string;
  masterRulebookId: string;
  versionNumber: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'NEEDS_REVIEW' | 'SUPERSEDED' | 'ARCHIVED';
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rules: RuleVersionRecord[];
  sourceDocument: SourceDocumentInfo | null;
}

export interface MasterRulebookRecord {
  id: string;
  title: string;
  domain: string;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  versions: MasterRulebookVersionRecord[];
}

export interface MasterRulebookVersionWithRulebook extends Omit<MasterRulebookVersionRecord, 'sourceDocument'> {
  sourceDocument: SourceDocumentInfo | null;
  masterRulebook: Omit<MasterRulebookRecord, 'versions'>;
}

export function listRulebooks(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<{ items: MasterRulebookRecord[]; total: number; limit: number; offset: number }>(`/rulebooks?limit=${limit}&offset=${offset}`);
}

export function getRulebookVersion(rulebookVersionId: string) {
  return apiGet<MasterRulebookVersionWithRulebook>(`/rulebooks/versions/${rulebookVersionId}`);
}

export function publishRulebookVersion(rulebookVersionId: string) {
  return apiPost<MasterRulebookVersionRecord>(`/rulebooks/versions/${rulebookVersionId}/publish`);
}