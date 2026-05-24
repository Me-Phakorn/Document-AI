import { apiGet, apiPost } from '@/lib/api-client';
import type {
  CreateWebsiteSourceRequest,
  CrawledPdfLink,
  ImportSelectedResponse,
  SourcePreviewResponse,
  WebsiteSourceListResponse,
  WebsiteSourceRecord,
} from './source-types';

export type {
  CreateWebsiteSourceRequest,
  CrawledPdfLink,
  ImportSelectedRequest,
  ImportSelectedResponse,
  SourcePreviewResponse,
  WebsiteScanRecord,
  WebsiteSourceListResponse,
  WebsiteSourceRecord,
} from './source-types';

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

export function previewWebsiteSource(
  sourceId: string,
  params: { startPage?: number; endPage?: number; maxDocuments?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.startPage) qs.set('startPage', String(params.startPage));
  if (params.endPage) qs.set('endPage', String(params.endPage));
  if (params.maxDocuments) qs.set('maxDocuments', String(params.maxDocuments));
  const query = qs.toString();
  return apiGet<SourcePreviewResponse>(`/sources/${sourceId}/preview${query ? `?${query}` : ''}`);
}

export function importSelectedLinks(sourceId: string, links: CrawledPdfLink[]) {
  return apiPost<ImportSelectedResponse>(`/sources/${sourceId}/import-selected`, { links });
}