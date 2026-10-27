import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';

import { getDb, getSettings } from '@/src/db';
import { resolveAdminSlug } from '@/src/admin-access';
import { normalizeLanguage, normalizeCurrency, translator, clientStrings } from '@/src/i18n';
import { formatMoney, formatDate, hashToken, publicUser } from '@/src/utils';
import { getSessionUser } from '@/src/auth';
import { CATEGORY_LIST, COLLECTIONS } from '@/src/catalog';
import { createAssetHelper } from '@/src/assets';

const asset = createAssetHelper();

let cachedAdminBase: string | null = null;

function adminBaseFor(db: ReturnType<typeof getDb>) {
  if (!cachedAdminBase) cachedAdminBase = `/${resolveAdminSlug(db, process.env.DB_PATH)}`;
  return cachedAdminBase;
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
  const baseUrl = `${protocol}://${host}`;

  const db = getDb();
  const settings = getSettings(db) as Record<string, string>;

  const lang = normalizeLanguage(cookieStore.get('se_lang')?.value || 'en') as 'en' | 'id';
  const currency = normalizeCurrency(cookieStore.get('se_currency')?.value || 'USD');
  const exchangeRate = Number(settings.exchange_rate || 0) || 16000;

  const raw = cookieStore.get('se_session')?.value || '';
  const session = raw
    ? (db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(raw)) as Record<string, any> | undefined)
    : undefined;
  const sessionValid = Boolean(session && new Date(String(session.expires_at)).getTime() > Date.now());
  const userRow = session && sessionValid ? getSessionUser(db, session) : null;
  const user = publicUser(userRow) as SiteUser | null;
  const csrfToken = sessionValid ? String(session?.csrf_token || '') : '';

  const wishlistIds = user
    ? (db.prepare('SELECT product_id FROM wishlists WHERE user_id = ?').all(Number(user.id)) as Array<{ product_id: number }>)
      .map((row) => Number(row.product_id))
    : [];

  const t = translator(lang);
  const adminBase = adminBaseFor(db);

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

  const socials = (db.prepare('SELECT platform, label, url FROM social_links WHERE active = 1 ORDER BY platform ASC').all() as Array<Record<string, string>>)
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
