import type { MetadataRoute } from 'next';
import { SITE_URL, SITE_URL_IS_PLACEHOLDER } from '@/lib/seo';

/**
 * Robots directives.
 *
 * The personal routes are disallowed deliberately. They render one visitor's
 * birth chart, so they have no value in an index and crawling them would be a
 * privacy problem rather than merely wasteful.
 */
export default function robots(): MetadataRoute.Robots {
  // A deploy that never had NEXT_PUBLIC_SITE_URL set is misconfigured: its
  // canonicals and sitemap point at localhost. Indexing it would scatter broken
  // URLs and could get a staging copy ranked instead of production, so nothing
  // is allowed until the host is real.
  if (SITE_URL_IS_PLACEHOLDER) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/today', '/chart', '/profile'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
