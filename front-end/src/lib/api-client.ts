import { cookies } from 'next/headers';
import { authTokenCookieName } from '@/lib/auth';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
  }
}

export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(await getAuthHeaders()),
    },
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    throw new ApiClientError(`API request failed: ${response.status}`, response.status, payload);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    throw new ApiClientError(`API request failed: ${response.status}`, response.status, payload);
  }

  return response.json() as Promise<T>;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get(authTokenCookieName)?.value;

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}