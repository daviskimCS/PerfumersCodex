import type { MetadataRoute } from 'next'

import { env } from '@/lib/env'

/**
 * Crawlers may read the reference but not the per-reader pages or the APIs.
 * `/search` is excluded too: result pages are infinite, and every material
 * they lead to is already in the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/account',
        '/saved',
        '/login',
        '/signup',
        '/auth/',
        '/search',
      ],
    },
    sitemap: new URL('/sitemap.xml', env.NEXT_PUBLIC_SITE_URL).href,
  }
}
