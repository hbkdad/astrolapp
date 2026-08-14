import type { MetadataRoute } from 'next';
import { ZODIAC_SIGNS } from '@astrolapp/astro-engine';
import { SITE_URL } from '@/lib/seo';

/**
 * XML sitemap.
 *
 * Only genuinely public, indexable pages appear. Anything behind a birth
 * profile is excluded — those pages are personal, contain no shared content,
 * and would be worthless (and privacy-hostile) in an index.
 *
 * `changeFrequency` and `priority` are advisory only; they are set honestly
 * rather than inflated, since search engines largely ignore them and inflating
 * them signals nothing useful.
 */
const LIFE_PATH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/horoscope`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...ZODIAC_SIGNS.map((sign) => ({
      url: `${SITE_URL}/horoscope/${sign}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/moon-phase/today`,
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    },
    ...['privacy', 'terms'].map((page) => ({
      url: `${SITE_URL}/${page}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
    ...LIFE_PATH_NUMBERS.map((number) => ({
      url: `${SITE_URL}/numerology/life-path/${number}`,
      lastModified: now,
      // The meaning of a number does not change; only the page furniture might.
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    })),
  ];
}
