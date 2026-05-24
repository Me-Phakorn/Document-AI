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

export async function verifySessionToken(token: string | null | undefined): Promise<JwtSessionPayload | null> {
  if (!token) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const header = parseJsonSegment<{ alg?: string; typ?: string }>(encodedHeader);
  if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') {
    return null;
  }

  const expectedSignature = await signValue(`${encodedHeader}.${encodedPayload}`, getJwtSecret());
  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  const payload = parseJsonSegment<JwtSessionPayload>(encodedPayload);
  if (!payload) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.type !== 'access' ||
    payload.iss !== getJwtIssuer() ||
    payload.aud !== getJwtAudience() ||
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
    return JSON.parse(decodeBase64UrlText(segment)) as T;
  } catch {
    return null;
  }
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function decodeBase64UrlText(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}

function encodeBase64Url(value: Uint8Array) {
  let binary = '';
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function getJwtSecret() {
  return process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production' ? 'change-me-in-production' : 'docai-local-jwt-secret');
}

function getJwtIssuer() {
  return process.env.JWT_ISSUER ?? 'docai.local';
}

function getJwtAudience() {
  return process.env.JWT_AUDIENCE ?? 'docai-admin';
}
