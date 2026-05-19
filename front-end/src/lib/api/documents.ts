import { apiGet, apiPost } from '@/lib/api-client';
import type { WorkflowStatus } from '@/lib/types';

export interface DocumentRecord {
  id: string;
  title: string;
  domain: string | null;
  sourceType: 'UPLOAD' | 'WEBSITE_SCAN' | 'API';
  status: WorkflowStatus;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionRecord {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  sourceUrl: string | null;
  sourceUrlHash: string | null;
  fileName: string | null;
  mimeType: string | null;
  byteSize: string | null;
  fileSha256: string | null;
  contentSha256: string | null;
  status: WorkflowStatus;
  ocrStatus: 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  isLatest: boolean;
  previousVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  document: DocumentRecord;
}

export interface OcrArtifactRecord {
  id: string;
  documentVersionId: string;
  engine: string;
  status: 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  aggregateConfidence: number | null;
  minPageConfidence: number | null;
  pageCount: number | null;
  failedPages: unknown;
  warnings: unknown;
  searchableObjectId: string | null;
  textObjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredObjectRecord {
  id: string;
  bucket: string;
  objectKey: string;
  fileName: string | null;
  contentType: string;
  byteSize: string;
  sha256: string;
  ownerType: string;
  ownerId: string;
  lifecycleStatus: 'CURRENT' | 'SUPERSEDED' | 'ARCHIVED';
  metadata: unknown;
  createdAt: string;
}

export interface DocumentListResponse {
  items: DocumentVersionRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface DocumentSummaryResponse {
  documents: {
    totalDocuments: number;
    totalVersions: number;
    latestVersions: number;
    uploaded: number;
    ocrCompleted: number;
    ocrFailed: number;
    pendingReview: number;
    approved: number;
    notRelevant: number;
  };
  ocr: {
    completed: number;
    partial: number;
    failed: number;
    pending: number;
  };
  ai: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  latestScan: {
    id: string;
    websiteSourceId: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    discoveredCount: number;
    importedCount: number;
    duplicateCount: number;
    failureReason: string | null;
    metadata: unknown;
    createdAt: string;
  } | null;
}

export interface DocumentDetailResponse {
  documentVersion: DocumentVersionRecord & {
    ocrArtifacts: OcrArtifactRecord[];
    aiResults: unknown[];
  };
  storedObjects: StoredObjectRecord[];
}

export interface OcrTextResponse {
  documentVersionId: string;
  ocrArtifact: OcrArtifactRecord;
  textObject: StoredObjectRecord;
  text: string;
  textLength: number;
}

export function listDocuments(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<DocumentListResponse>(`/documents?limit=${limit}&offset=${offset}`);
}

export function getDocumentSummary() {
  return apiGet<DocumentSummaryResponse>('/documents/summary');
}

export function getDocumentDetail(documentVersionId: string) {
  return apiGet<DocumentDetailResponse>(`/documents/${documentVersionId}`);
}

export function getOcrText(documentVersionId: string) {
  return apiGet<OcrTextResponse>(`/documents/${documentVersionId}/ocr-text`);
}

export interface UploadDocumentInput {
  title: string;
  domain?: string;
  sourceUrl?: string;
  fileName: string;
  mimeType?: string;
  contentBase64: string;
  sourceType?: 'UPLOAD' | 'WEBSITE_SCAN' | 'API';
}

export function uploadDocument(input: UploadDocumentInput) {
  return apiPost<{ outcome: string; documentId?: string; documentVersionId?: string; reason?: string }>('/documents/upload', {
    sourceType: 'UPLOAD',
    mimeType: 'application/pdf',
    ...input,
  });
}