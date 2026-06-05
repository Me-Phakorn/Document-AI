/**
 * Browser-side API client for use in client components ('use client').
 *
 * Calls go through the Next.js BFF proxy at /api/backend/[...path], which
 * runs server-side and attaches the httpOnly auth cookie to the backend
 * request. This avoids the need to read the httpOnly cookie in the browser.
 */

export class ApiClientBrowserError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
  }
}

function buildProxyUrl(path: string) {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `/api/backend/${clean}`;
}

export async function apiGetBrowser<T>(path: string): Promise<T> {
  const response = await fetch(buildProxyUrl(path));

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    throw new ApiClientBrowserError(`API ${response.status}`, response.status, payload);
  }

  return response.json() as Promise<T>;
}

export async function apiPostBrowser<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildProxyUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    throw new ApiClientBrowserError(`API ${response.status}`, response.status, payload);
  }

  return response.json() as Promise<T>;
}

export async function apiPatchBrowser<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildProxyUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    throw new ApiClientBrowserError(`API ${response.status}`, response.status, payload);
  }

  return response.json() as Promise<T>;
}

