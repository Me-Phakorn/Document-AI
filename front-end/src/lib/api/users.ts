import { apiGet, apiPost } from '@/lib/api-client';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'REVIEWER' | 'ANALYST' | 'VIEWER';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  items: UserRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateUserRequest {
  email: string;
  displayName: string;
  role: UserRole;
}

export function listUsers(params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return apiGet<UserListResponse>(`/users?limit=${limit}&offset=${offset}`);
}

export function createUser(input: CreateUserRequest) {
  return apiPost<UserRecord>('/users', input);
}