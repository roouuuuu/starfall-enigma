import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const body = [
    'User-agent: *',
    'Disallow: /admin',
    'Disallow: /setup',
    'Disallow: /api/',
    'Disallow: /account',
    'Disallow: /checkout',
    'Disallow: /order/',
    'Disallow: /login',
    'Disallow: /register',
    'Allow: /assets/',
    `Sitemap: ${origin}/sitemap.xml`,
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
