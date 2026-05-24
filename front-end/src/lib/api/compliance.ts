import { apiGet, apiPost } from '@/lib/api-client';

export interface AiFinding {
  ruleCode: string;
  ruleTitle: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  status: 'VIOLATED' | 'POTENTIAL' | 'COMPLIANT';
  explanation: string;
  evidence?: string;
}

export interface ComplianceCheckRecord {
  id: string;
  inputType: 'IMAGE' | 'PDF' | 'TEXT' | 'URL' | 'SOCIAL_POST' | 'SCREENSHOT';
  status: string;
  selectedRulebookId: string | null;
  selectedReportId: string | null;
  inputHash: string | null;
  metadata: {
    title?: string | null;
    focusPrompt?: string | null;
    hasImage?: boolean;
    rulebookTitle?: string;
    model?: string | null;
    violationsCount?: number;
    potentialCount?: number;
    compliantCount?: number;
    totalRulesChecked?: number;
    inputImageKey?: string | null;
    inputImageMimeType?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  selectedRulebook?: {
    id: string;
    title: string;
    domain: string;
  } | null;
  results: Array<{
    id: string;
    versionNumber: number;
    status: string;
    summary: string | null;
    matchedRules: AiFinding[] | unknown;
    ambiguousPoints: unknown;
    recommendedAction: string | null;
    createdAt: string;
  }>;
}

export interface RuleChecked {
  id: string;
  ruleCode: string;
  title: string;
  description: string;
  riskLevel: string;
  condition: string | null;
  prohibition: string | null;
  fromVersionNumber: number;
}

export interface ComplianceCheckDetail extends ComplianceCheckRecord {
  rulesChecked: RuleChecked[];
}

export function listComplianceChecks(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<{ items: ComplianceCheckRecord[]; total: number; limit: number; offset: number }>(`/compliance/checks?limit=${limit}&offset=${offset}`);
}

export function getComplianceCheckDetail(id: string) {
  return apiGet<ComplianceCheckDetail>(`/compliance/checks/${id}/detail`);
}

export function createComplianceCheck(input: {
  content?: string;
  imageBase64?: string;
  imageMimeType?: string;
  focusPrompt?: string;
  title?: string;
  selectedRulebookId?: string;
  inputType?: string;
  model?: string;
}) {
  return apiPost<ComplianceCheckRecord>('/compliance/checks', {
    inputType: input.imageBase64 ? 'IMAGE' : 'TEXT',
    ...input,
  });
}