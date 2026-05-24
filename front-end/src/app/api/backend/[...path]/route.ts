/**
 * Generic BFF proxy route: /api/backend/[...path]
 *
 * Client components cannot read httpOnly cookies, so they cannot attach the
 * auth token when calling the NestJS backend directly. This catch-all route
 * runs server-side, reads the httpOnly cookie, and forwards the request to
 * the backend with the Authorization header.
 *
 * Usage from client components:
 *   fetch(`/api/backend/compliance/checks/${id}/detail`)
 *   or via apiGetBrowser() in api-client-browser.ts
 */
import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authTokenCookieName } from '@/lib/auth';
import { buildApiUrl } from '@/lib/api-client';

async function proxy(req: NextRequest, segments: string[], method: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(authTokenCookieName)?.value;

  const backendPath = '/' + segments.join('/');
  const search = req.nextUrl.search;
  const url = buildApiUrl(backendPath) + search;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.text();
    if (body) headers['Content-Type'] = req.headers.get('content-type') ?? 'application/json';
  }

  const response = await fetch(url, { method, cache: 'no-store', headers, body });

  const contentType = response.headers.get('content-type') ?? '';

  // Stream binary responses (images, PDFs, etc.) directly without JSON wrapping
  if (contentType.startsWith('image/') || contentType.startsWith('application/pdf') || contentType.startsWith('application/octet-stream')) {
    const buffer = await response.arrayBuffer();
    return new Response(buffer, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': response.headers.get('cache-control') ?? 'private, max-age=3600',
        'Content-Length': String(buffer.byteLength),
      },
    });
  }

  let data: unknown;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = { message: await response.text() };
  }

  return NextResponse.json(data, { status: response.status });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxy(req, path, 'GET');
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxy(req, path, 'POST');
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxy(req, path, 'PUT');
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxy(req, path, 'PATCH');
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxy(req, path, 'DELETE');
}
