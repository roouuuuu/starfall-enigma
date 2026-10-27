import { NextResponse, type NextRequest } from 'next/server';

import { createSession, applySessionCookie, SESSION_COOKIE } from '@/lib/auth';
import { get, run } from '@/lib/db';
import { hashToken } from '@/src/utils';

// React only needs eval() in development for callstack reconstruction and
// Fast Refresh. Production keeps the strict policy.
const SCRIPT_SRC = process.env.NODE_ENV === 'production'
  ? "script-src 'self'"
  : "script-src 'self' 'unsafe-eval'";

function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `${SCRIPT_SRC} 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

function isDocumentRequest(request: NextRequest) {
  if (request.method !== 'GET') return false;
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/_next') || pathname.startsWith('/__nextjs')) return false;
  if (pathname.startsWith('/api/')) return false;
  if (pathname === '/health' || pathname === '/robots.txt' || pathname === '/sitemap.xml') return false;
  if (pathname === '/preferences' || pathname.startsWith('/go/')) return false;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html') || accept === '*/*' || accept === '';
}

async function sessionIsValid(raw: string) {
  const session = await get<{ expires_at: string }>(
    'SELECT expires_at FROM sessions WHERE token_hash = ?',
    [hashToken(raw)]
  );
  if (!session) return false;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await run('DELETE FROM sessions WHERE token_hash = ?', [hashToken(raw)]);
    return false;
  }
  return true;
}

export async function proxy(request: NextRequest) {
  // Next reads the nonce back from this header and applies it to every script
  // tag it emits, so hydration survives the strict policy.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-se-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  requestHeaders.set('x-se-path', request.nextUrl.pathname);
  requestHeaders.set('x-se-url', `${request.nextUrl.pathname}${request.nextUrl.search}`);

  let createdRaw = '';
  if (isDocumentRequest(request)) {
    const raw = request.cookies.get(SESSION_COOKIE)?.value || '';
    const valid = raw ? await sessionIsValid(raw) : false;
    if (!valid) {
      const created = await createSession(null);
      createdRaw = created.raw;
      const existing = request.headers.get('cookie') || '';
      requestHeaders.set(
        'cookie',
        existing
          ? `${existing}; ${SESSION_COOKIE}=${encodeURIComponent(created.raw)}`
          : `${SESSION_COOKIE}=${encodeURIComponent(created.raw)}`
      );
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (createdRaw) applySessionCookie(response, createdRaw);
  response.headers.set('content-security-policy', csp);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('cross-origin-opener-policy', 'same-origin');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|js/|css/|assets/).*)'],
};
