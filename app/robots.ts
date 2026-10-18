import type { MetadataRoute } from 'next'

import { env } from '@/lib/env'

/**
 * robots.txt: crawl the reference, skip the per-reader and machine routes.
 *
 * The disallowed paths hold nothing a search result should point at: account
 * and saved pages redirect a crawler to /login, the auth routes are one-time
 * links, and /api answers JSON. Search result pages are left out too, since
 * every query string would otherwise be indexed as its own thin page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/saved', '/search', '/api/', '/auth/'],
    },
    sitemap: new URL('/sitemap.xml', env.NEXT_PUBLIC_SITE_URL).toString(),
  }
}
