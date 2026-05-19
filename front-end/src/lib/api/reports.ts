import { apiGet, apiPost } from '@/lib/api-client';

export interface ReportRecord {
  id: string;
  reportType: 'RULE_EXTRACTION' | 'COMPLIANCE_USAGE';
  status: 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';
  title: string;
  masterRulebookVersionId: string | null;
  complianceCheckId: string | null;
  parameters: unknown;
  generatedById: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  exports: Array<{
    id: string;
    reportId: string;
    format: 'PDF' | 'XLSX' | 'JSON';
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    storedObjectId: string | null;
    parametersHash: string | null;
    failureReason: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export interface ReportListResponse {
  items: ReportRecord[];
  total: number;
  limit: number;
  offset: number;
}

export function listReports(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<ReportListResponse>(`/reports?limit=${limit}&offset=${offset}`);
}

export function generateRulebookReport(rulebookVersionId: string) {
  return apiPost<ReportRecord>(`/reports/rulebook-versions/${rulebookVersionId}/generate`);
}

export function generateComplianceReport(complianceCheckId: string) {
  return apiPost<ReportRecord>(`/reports/compliance-checks/${complianceCheckId}/generate`);
}

export function getReportExport(reportExportId: string) {
  return apiGet<{ export: ReportRecord['exports'][number]; storedObject: unknown; content: unknown }>(`/reports/exports/${reportExportId}`);
}