import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authTokenCookieName, normalizeNextPath, verifySessionToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/login';
  const isLogoutRoute = pathname === '/logout';
  const token = request.cookies.get(authTokenCookieName)?.value ?? null;
  const session = verifySessionToken(token);

  if (isLogoutRoute) {
    return NextResponse.next();
  }

  if (isLoginPage) {
    if (session) {
      // Use request.nextUrl.origin (respects X-Forwarded-Host from Traefik) instead of
      // request.url which may be the internal Docker hostname (e.g. http://localhost:3000).
      const destination = new URL(normalizeNextPath(request.nextUrl.searchParams.get('next')), request.nextUrl.origin);
      return NextResponse.redirect(destination);
    }

    const response = NextResponse.next();
    if (token) {
      response.cookies.delete(authTokenCookieName);
    }
    return response;
  }

  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.nextUrl.origin);
  // Never set /login itself (or /) as the next destination — it causes redirect loops.
  const nextTarget = pathname === '/' || pathname === '/login'
    ? '/dashboard'
    : `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('next', nextTarget);
  const response = NextResponse.redirect(loginUrl);
  if (token) {
    response.cookies.delete(authTokenCookieName);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/).*)'],
};