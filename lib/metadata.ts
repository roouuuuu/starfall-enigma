import 'server-only';

import { headers } from 'next/headers';
import type { Metadata } from 'next';

type PageMetadataInput = {
  title: string;
  description?: string;
  image?: string;
  noindex?: boolean;
  type?: 'website' | 'article';
};

export async function pageMetadata({ title, description = '', image, noindex = false, type = 'website' }: PageMetadataInput): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get('host') || 'localhost:3000';
  const protocol = headerStore.get('x-forwarded-proto') || 'http';
  const pathname = headerStore.get('x-se-path') || '/';
  const base = `${protocol}://${host}`;

  return {
    title,
    description,
    alternates: { canonical: `${base}${pathname}` },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      siteName: 'STARFALL ENIGMA',
      type,
      title,
      description,
      images: image ? [`${base}${image}`] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}
