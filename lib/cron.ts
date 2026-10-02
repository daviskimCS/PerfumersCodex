import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Is this request Vercel Cron, carrying the configured secret?
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set
 * on the project. Pure and database-free so it can be tested without a server.
 *
 * FAILS CLOSED: with no secret configured, nothing is authorized. An unset
 * variable must never turn into "anyone may call this".
 *
 * Both sides are hashed before comparing so the comparison is constant-time
 * whatever the header's length; `timingSafeEqual` throws on unequal lengths.
 */
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !authorization) return false
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest()
  const actual = createHash('sha256').update(authorization).digest()
  return timingSafeEqual(expected, actual)
}
