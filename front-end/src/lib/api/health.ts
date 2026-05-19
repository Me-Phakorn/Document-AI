import { apiGet } from '@/lib/api-client';

export function getApiHealth() {
  return apiGet<{ status: string; service: string; timestamp: string }>('/health');
}