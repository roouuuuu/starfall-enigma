import { NextRequest } from 'next/server';

import { all } from '@/lib/db';
import { JOURNAL } from '@/src/content';
import { escapeXml } from '@/src/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const base = request.nextUrl.origin;
  const staticPaths = ['/', '/shop', '/journal', '/about', '/stores', '/client-care', '/legal', '/credits'];
  const products = await all<{ slug: string }>(
    'SELECT slug FROM products WHERE published = 1 ORDER BY id'
  );

  const urls = [
    ...staticPaths.map((url) => ({ loc: `${base}${url}`, priority: url === '/' ? '1.0' : '0.7' })),
    ...products.map((product) => ({ loc: `${base}/product/${product.slug}`, priority: '0.8' })),
    ...JOURNAL.map((article: { slug: string }) => ({ loc: `${base}/journal/${article.slug}`, priority: '0.6' })),
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((item) => `  <url><loc>${escapeXml(item.loc)}</loc><priority>${item.priority}</priority></url>`).join('\n') +
    '\n</urlset>';

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
