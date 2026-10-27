import { NextResponse, type NextRequest } from 'next/server';

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

export function proxy(request: NextRequest) {
  // Next reads the nonce back from this header and applies it to every script
  // tag it emits, so hydration survives the strict policy.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-se-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
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
