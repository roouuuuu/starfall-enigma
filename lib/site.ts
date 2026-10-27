import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';

import { all, get, getSettings, run } from '@/lib/db';
import { normalizeLanguage, normalizeCurrency, translator, clientStrings } from '@/src/i18n';
import { formatMoney, formatDate, hashToken, publicUser } from '@/src/utils';
import { CATEGORY_LIST, COLLECTIONS } from '@/src/catalog';
import { createAssetHelper } from '@/src/assets';

const asset = createAssetHelper();

async function adminBaseFor() {
  const explicit = String(process.env.ADMIN_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '') || '/';

  const fromEnv = String(process.env.ADMIN_SLUG || '').trim().toLowerCase();
  if (fromEnv) return `/${fromEnv}`;

  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = 'admin_slug'");
  return row?.value ? `/${row.value}` : '/account';
}

export type SiteUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type Category = {
  id: string;
  label: string;
  description?: string;
  image?: string;
  group?: string;
};

export type SocialLink = {
  platform: string;
  label: string;
  href: string;
};

export type SiteContext = {
  pathname: string;
  currentUrl: string;
  baseUrl: string;
  lang: 'en' | 'id';
  currency: string;
  exchangeRate: number;
  settings: Record<string, string>;
  user: SiteUser | null;
  csrfToken: string;
  sessionHash: string;
  wishlistIds: number[];
  t: (key: string, vars?: Record<string, string | number>) => any;
  money: (cents: number) => string;
  formatDate: (value: string) => string;
  clientStrings: unknown;
  adminBase: string;
  announcement: string;
  brandEmail: string;
  supportPhone: string;
  year: number;
  langSwitchUrl: string;
  currencySwitchUrl: string;
  langAlt: string;
  currencyAlt: string;
  clothingCategories: Category[];
  navCategories: Category[];
  collections: Category[];
  socials: SocialLink[];
  asset: (path: string) => string;
};

export const getSiteContext = cache(async (): Promise<SiteContext> => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const pathname = headerStore.get('x-se-path') || '/';
  const currentUrl = headerStore.get('x-se-url') || pathname;
  const host = headerStore.get('host') || 'localhost:3000';
  const protocol = headerStore.get('x-forwarded-proto') || 'http';
  const configuredBase = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  const baseUrl = configuredBase || `${protocol}://${host}`;

  const settings = await getSettings();

  const lang = normalizeLanguage(cookieStore.get('se_lang')?.value || 'en') as 'en' | 'id';
  const currency = normalizeCurrency(cookieStore.get('se_currency')?.value || 'USD');
  const exchangeRate = Number(settings.exchange_rate || 0) || 16000;

  const raw = cookieStore.get('se_session')?.value || '';
  let session = raw
    ? await get<Record<string, any>>('SELECT * FROM sessions WHERE token_hash = ?', [hashToken(raw)])
    : undefined;

  if (session && new Date(String(session.expires_at)).getTime() <= Date.now()) {
    await run('DELETE FROM sessions WHERE token_hash = ?', [session.token_hash]);
    session = undefined;
  }

  const userRow = session?.user_id
    ? await get<Record<string, any>>('SELECT * FROM users WHERE id = ?', [Number(session.user_id)])
    : null;
  const user = publicUser(userRow) as SiteUser | null;
  const csrfToken = session ? String(session.csrf_token || '') : '';

  const wishlistIds = user
    ? (await all<{ product_id: number }>('SELECT product_id FROM wishlists WHERE user_id = ?', [Number(user.id)]))
      .map((row) => Number(row.product_id))
    : [];

  const t = translator(lang);
  const adminBase = await adminBaseFor();

  const clothingCategories = CATEGORY_LIST
    .filter((category: any) => category.group === 'clothing')
    .map((category: any) => ({
      ...category,
      label: lang === 'id' ? category.label_id : category.label_en,
    }));

  const navCategories = CATEGORY_LIST.map((category: any) => ({
    ...category,
    label: lang === 'id' ? category.label_id : category.label_en,
    description: lang === 'id' ? category.description_id : category.description_en,
  }));

  const collections = COLLECTIONS.map((collection: any) => ({
    ...collection,
    label: lang === 'id' ? collection.label_id || collection.label : collection.label,
  }));

  const socials = (await all<Record<string, string>>(
    'SELECT platform, label, url FROM social_links WHERE active = 1 ORDER BY platform ASC'
  ))
    .filter((row) => /^https?:\/\//i.test(row.url))
    .map((row) => ({
      platform: row.platform,
      label: row.label,
      href: `/go/${encodeURIComponent(row.platform)}?from=${encodeURIComponent(pathname)}`,
    }));

  const langQuery = new URLSearchParams({
    lang: lang === 'en' ? 'id' : 'en',
    currency,
    redirect: currentUrl,
  });
  const currencyQuery = new URLSearchParams({
    lang,
    currency: currency === 'USD' ? 'IDR' : 'USD',
    redirect: currentUrl,
  });

  return {
    pathname,
    currentUrl,
    baseUrl,
    lang,
    currency,
    exchangeRate,
    settings,
    user,
    csrfToken,
    sessionHash: raw ? hashToken(raw) : '',
    wishlistIds,
    t,
    money: (cents: number) => formatMoney(Number(cents || 0), currency, exchangeRate),
    formatDate: (value: string) => formatDate(value, lang),
    clientStrings: clientStrings(lang),
    adminBase,
    announcement: lang === 'id' ? settings.announcement_id : settings.announcement_en,
    brandEmail: settings.brand_email || 'concierge@starfallenigma.com',
    supportPhone: settings.support_phone || '',
    year: new Date().getFullYear(),
    langSwitchUrl: `/preferences?${langQuery.toString()}`,
    currencySwitchUrl: `/preferences?${currencyQuery.toString()}`,
    langAlt: lang === 'en' ? 'ID' : 'EN',
    currencyAlt: currency === 'USD' ? 'IDR' : 'USD',
    clothingCategories,
    navCategories,
    collections,
    socials,
    asset,
  };
});
