import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authTokenCookieName } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Guard against Next.js prefetch requests – a prefetch would delete the cookie
  // before the user actually clicks the logout button.
  if (request.headers.get('Next-Router-Prefetch') === '1' || request.headers.get('RSC') === '1') {
    return new NextResponse(null, { status: 204 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${request.headers.get('x-forwarded-proto') ?? 'https'}://${request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000'}`;
  const origin = appUrl.replace(/\/$/, '');
  const response = NextResponse.redirect(new URL('/login', origin));
  response.cookies.delete(authTokenCookieName);
  return response;
}