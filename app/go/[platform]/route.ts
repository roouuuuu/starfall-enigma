import { NextRequest, NextResponse } from 'next/server';

import { loadSession } from '@/lib/auth';
import { get, run } from '@/lib/db';
import { addUtm, cleanText, isValidHttpUrl } from '@/src/utils';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ platform: string }> };

export async function GET(request: NextRequest, { params }: Props) {
  const { platform: rawPlatform } = await params;
  const platform = cleanText(rawPlatform, 30).toLowerCase();
  const link = await get<{ url: string }>(
    'SELECT * FROM social_links WHERE platform = ? AND active = 1',
    [platform]
  );

  if (!link || !isValidHttpUrl(link.url)) {
    return new Response(null, {
      status: 302,
      headers: { location: '/', 'cache-control': 'no-store' },
    });
  }

  const fromQuery = request.nextUrl.searchParams.get('from');
  const fromPath = fromQuery && fromQuery.startsWith('/')
    ? cleanText(fromQuery, 500)
    : request.nextUrl.pathname;

  try {
    const { user } = await loadSession(request);
    await run(
      `INSERT INTO social_clicks (platform, clicked_at, referrer, path, user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        platform,
        new Date().toISOString(),
        cleanText(request.headers.get('referer') || '', 500),
        fromPath,
        user ? Number(user.id) : null,
      ]
    );
  } catch (error) {
    // A click must never be blocked by analytics.
    console.error('Social click tracking failed:', error);
  }

  const response = NextResponse.redirect(addUtm(link.url, platform), 302);
  response.headers.set('cache-control', 'no-store');
  return response;
}
