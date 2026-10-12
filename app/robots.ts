import type { MetadataRoute } from 'next'

import { env } from '@/lib/env'

/**
 * robots.txt: crawl the reference, skip the per-reader and machine routes.
 *
 * The disallowed paths hold nothing a search result should point at: account
 * and saved pages redirect a crawler to /login, the auth routes are one-time
 * links, and /api answers JSON. Search result pages are left out too, since
 * every query string would otherwise be indexed as its own thin page.
 *
 * While the pre-launch gate is up, proxy.ts rewrites this path to the
 * construction page like every other route, so nothing here is served until
 * the gate comes down.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/saved', '/search', '/api/', '/auth/', '/unlock'],
    },
    sitemap: new URL('/sitemap.xml', env.NEXT_PUBLIC_SITE_URL).toString(),
  }
}
