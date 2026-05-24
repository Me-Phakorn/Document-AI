/** Pure type definitions for website sources – safe to import in both Server and Client Components. */

/** Detail of a single duplicate document found during a scan. */
export interface ScanDuplicateInfo {
  title: string;
  pdfUrl: string;
  existingDocumentId: string;
  existingDocumentVersionId: string;
  existingDocumentTitle: string;
  reason: 'url_match' | 'file_hash' | 'content_hash';
}

export interface WebsiteScanMetadata {
  startPage?: number;
  endPage?: number | null;
  maxPagesCap?: number;
  maxDocuments?: number | null;
  linksFile?: string | null;
  duplicates?: ScanDuplicateInfo[];
}

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
  metadata: WebsiteScanMetadata | null;
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
  startPage?: number;
  endPage?: number;
  maxPages?: number;
  maxDocuments?: number;
  isActive?: boolean;
}

/** A single PDF link discovered by the BOT FIPCS crawler. */
export interface CrawledPdfLink {
  listPage: number;
  packId: string;
  pdfUrl: string;
  title: string;
  documentType: string | null;
  sourceDocumentDate: string | null;
  sourceDocumentDateText: string | null;
  statusText: string | null;
  language: string | null;
  relatedDocumentUrl: string | null;
}

export interface SourcePreviewResponse {
  sourceId: string;
  sourceName: string;
  baseUrl: string;
  total: number;
  links: CrawledPdfLink[];
}

export interface ImportSelectedRequest {
  links: CrawledPdfLink[];
}

export interface ImportSelectedResponse {
  sourceId: string;
  status: 'TRIGGERED';
  pid: number | null;
  selectedCount: number;
}
