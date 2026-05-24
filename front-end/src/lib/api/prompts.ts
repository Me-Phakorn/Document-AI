import { apiGet, apiPost } from '@/lib/api-client';

export type PromptStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';

export interface PromptTemplateVersionRecord {
  id: string;
  promptTemplateId: string;
  versionNumber: number;
  status: PromptStatus;
  templateText: string;
  variables: string[];
  aiProvider: string | null;
  aiModel: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface PromptTemplateRecord {
  id: string;
  name: string;
  domain: string | null;
  tags: string[];
  status: PromptStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  versions: PromptTemplateVersionRecord[];
}

export interface PromptTemplateListResponse {
  items: PromptTemplateRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreatePromptTemplateRequest {
  name: string;
  domain?: string;
  tags?: string[];
  templateText: string;
  variables?: string[];
  aiModel?: string;
}

export interface CreatePromptVersionRequest {
  templateText: string;
  variables?: string[];
  aiModel?: string;
}

export function listPromptTemplates(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<PromptTemplateListResponse>(`/prompts?limit=${limit}&offset=${offset}`);
}

export function createPromptTemplate(input: CreatePromptTemplateRequest) {
  return apiPost<PromptTemplateRecord>('/prompts', input);
}

export function createPromptVersion(promptTemplateId: string, input: CreatePromptVersionRequest) {
  return apiPost<PromptTemplateVersionRecord>(`/prompts/${promptTemplateId}/versions`, input);
}

export function activatePromptVersion(promptTemplateVersionId: string) {
  return apiPost<PromptTemplateVersionRecord>(`/prompts/versions/${promptTemplateVersionId}/activate`);
}