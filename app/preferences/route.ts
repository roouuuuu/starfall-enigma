import { NextRequest, NextResponse } from 'next/server';

import { normalizeCurrency, normalizeLanguage } from '@/src/i18n';
import { safeRedirect } from '@/src/utils';

export const dynamic = 'force-dynamic';

const MAX_AGE = 365 * 24 * 60 * 60;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const lang = normalizeLanguage(query.get('lang') || request.cookies.get('se_lang')?.value || 'en');
  const currency = normalizeCurrency(
    query.get('currency') || request.cookies.get('se_currency')?.value || 'USD'
  );
  const target = safeRedirect(query.get('redirect') || '/', '/');

  const response = NextResponse.redirect(new URL(target, request.url), 302);
  response.cookies.set('se_lang', lang, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  response.cookies.set('se_currency', currency, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  response.headers.set('cache-control', 'no-store');
  return response;
}
