import { apiGet, apiPost } from '@/lib/api-client';

export interface WebsiteScanRecord {
  id: string;
  websiteSourceId: string;
  status: 'IDLE' | 'SCANNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL_FAILED';
  startedAt: string | null;
  finishedAt: string | null;
  discoveredCount: number;
  importedCount: number;
  duplicateCount: number;
  failureReason: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface WebsiteSourceRecord {
  id: string;
  name: string;
  baseUrl: string;
  domain: string | null;
  isActive: boolean;
  scanConfig: unknown;
  createdAt: string;
  updatedAt: string;
  scans: WebsiteScanRecord[];
}

export interface WebsiteSourceListResponse {
  items: WebsiteSourceRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateWebsiteSourceRequest {
  name: string;
  baseUrl: string;
  domain?: string;
  maxPages?: number;
  maxDocuments?: number;
  isActive?: boolean;
}

export function listWebsiteSources(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<WebsiteSourceListResponse>(`/sources?limit=${limit}&offset=${offset}`);
}

export function createWebsiteSource(input: CreateWebsiteSourceRequest) {
  return apiPost<WebsiteSourceRecord>('/sources', input);
}

export function triggerWebsiteSourceScan(sourceId: string) {
  return apiPost<{ sourceId: string; status: 'TRIGGERED'; pid: number | null }>(`/sources/${sourceId}/scans`);
}