import type { User } from '@supabase/supabase-js'

/**
 * Pure facts about how an account signs in, read from the Supabase user and
 * the access token's claims. No network, no client: the account actions and
 * the account page call these with what `getUser()` / `getClaims()` already
 * returned, and the unit tests call them with literals.
 */

/** The slice of `User` these helpers read, so tests need not build a whole one. */
export type IdentityFacts = Pick<User, 'identities' | 'app_metadata'>

/**
 * Does this account have a password to sign in with?
 *
 * A Google-only account still has an email address (Google's), so "has an
 * email" is the wrong test, and it is the one `changePassword` used to make:
 * it sent a Google-only reader through a current-password check they could
 * never pass and told them "That isn't your current password". Supabase
 * records an `email` identity for every email/password account; that is the
 * fact that matters.
 *
 * `identities` is absent on some partial user objects, so `app_metadata.
 * providers` (Supabase's own list of linked providers) is the fallback.
 */
export function hasPasswordSignIn(user: IdentityFacts): boolean {
  if (user.identities && user.identities.length > 0) {
    return user.identities.some((identity) => identity.provider === 'email')
  }
  const providers: unknown = user.app_metadata?.providers
  return Array.isArray(providers) && providers.includes('email')
}

/**
 * One entry of the access token's `amr` (authentication methods) claim.
 * Supabase emits the detailed `{ method, timestamp }` form; RFC 8176 allows
 * bare strings, which carry no timestamp and so can never prove recency.
 */
export type AmrEntry = { method: string; timestamp: number } | string

/**
 * How long after following a reset link the new password may be set without
 * the old one. Long enough to read the page and type a password twice, short
 * enough that a session cookie lifted later cannot use the reset page as a
 * way around the current-password check on `/account`.
 */
export const RECOVERY_WINDOW_SECONDS = 30 * 60

/**
 * Is this session one that a password-reset link just created?
 *
 * The reset page sets a new password WITHOUT the current one; that is its
 * whole job. So it must refuse an ordinary session, or anyone holding a
 * signed-in cookie (a shared computer, a stolen token) could skip the
 * current-password check `changePassword` enforces and take the account.
 *
 * The reset link lands on `/auth/confirm`, whose `verifyOtp` signs the reader
 * in with an `otp` entry in the token's `amr` claim. A signup confirmation
 * does the same, so `otp` alone is not enough: the account must also have a
 * reset requested (`recovery_sent_at`) no later than that sign-in, and the
 * sign-in must be recent. An attacker with a password session has no `otp`
 * entry; requesting a reset from that session mails the link to the owner,
 * not to them.
 */
export function isRecentRecoverySession(
  amr: readonly AmrEntry[] | undefined,
  recoverySentAt: string | null | undefined,
  nowSeconds: number
): boolean {
  if (!amr || !recoverySentAt) return false
  const requestedAt = Date.parse(recoverySentAt)
  if (Number.isNaN(requestedAt)) return false
  const requestedAtSeconds = Math.floor(requestedAt / 1000)

  return amr.some(
    (entry) =>
      typeof entry !== 'string' &&
      entry.method === 'otp' &&
      entry.timestamp >= requestedAtSeconds &&
      entry.timestamp <= nowSeconds &&
      nowSeconds - entry.timestamp <= RECOVERY_WINDOW_SECONDS
  )
}

/** `isRecentRecoverySession` against the clock, for callers outside tests. */
export function isRecoverySessionNow(
  amr: readonly AmrEntry[] | undefined,
  recoverySentAt: string | null | undefined
): boolean {
  return isRecentRecoverySession(
    amr,
    recoverySentAt,
    Math.floor(Date.now() / 1000)
  )
}
