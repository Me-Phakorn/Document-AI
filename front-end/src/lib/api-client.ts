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

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...getBasicAuthHeaders(),
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
  const response = await fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...getBasicAuthHeaders(),
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

function getBasicAuthHeaders(): Record<string, string> {
  if (!readBoolean(process.env.BASIC_AUTH_ENABLED, true)) {
    return {};
  }

  const username = process.env.BASIC_AUTH_USERNAME ?? fallbackCredential();
  const password = process.env.BASIC_AUTH_PASSWORD ?? fallbackCredential();

  if (!username || !password) {
    return {};
  }

  return {
    Authorization: `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`,
  };
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function fallbackCredential(): string {
  return process.env.NODE_ENV === 'production' ? '' : 'admin';
}