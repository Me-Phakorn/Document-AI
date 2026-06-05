export interface JwtSessionPayload {
  sub: string;
  username: string;
  role: string;
  type: 'access';
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export const authTokenCookieName = 'docai_access_token';

export function normalizeNextPath(value: string | null | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  return value;
}

/**
 * Decode and lightly validate a JWT without verifying the signature.
 * Signature verification is the backend's responsibility — the frontend only needs
 * to know whether a token looks structurally valid and hasn't expired yet, so it
 * can decide whether to show the login page or redirect to the app.
 * Any forged token will be rejected by the backend on the first real API call.
 */
export function verifySessionToken(token: string | null | undefined): JwtSessionPayload | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const payload = parseJsonSegment<JwtSessionPayload>(parts[1]);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.type !== 'access' ||
    payload.exp <= now ||
    !payload.sub ||
    !payload.username ||
    !payload.role
  ) {
    return null;
  }

  return payload;
}

function parseJsonSegment<T>(segment: string): T | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return JSON.parse(atob(`${normalized}${padding}`)) as T;
  } catch {
    return null;
  }
}
