import { JOURNAL } from '@/src/content';

export type JournalArticle = {
  slug: string;
  date: string;
  readMinutes: number;
  image: string;
  category: string;
  title: string;
  excerpt: string;
  body: string[];
};

export function journalFor(lang: 'en' | 'id'): JournalArticle[] {
  return JOURNAL.map((item: any) => ({
    slug: item.slug,
    date: item.date,
    readMinutes: item.readMinutes,
    image: item.image,
    category: lang === 'id' ? item.category_id : item.category_en,
    title: lang === 'id' ? item.title_id : item.title_en,
    excerpt: lang === 'id' ? item.excerpt_id : item.excerpt_en,
    body: lang === 'id' ? item.body_id : item.body_en,
  }));
}
