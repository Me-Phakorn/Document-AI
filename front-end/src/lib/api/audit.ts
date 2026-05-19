import { apiGet } from '@/lib/api-client';

export interface AuditLogRecord {
  id: string;
  actorId: string | null;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState: unknown;
  nextState: unknown;
  correlationId: string;
  requestMetadata: unknown;
  reason: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLogRecord[];
  total: number;
  limit: number;
  offset: number;
}

export function listAuditLogs(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  return apiGet<AuditLogListResponse>(`/audit/logs?limit=${limit}&offset=${offset}`);
}