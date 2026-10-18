import Link from 'next/link'

import { cn } from '@/lib/utils'

const LINK_CLASSNAME =
  'text-foreground underline decoration-brand-muted underline-offset-4 hover:decoration-brand'

/**
 * The notice every account-creating surface carries: `/signup` (email or
 * Google) and `/login` (where "Continue with Google" creates an account for a
 * Google address it has not seen).
 *
 * A notice, not a checkbox, on purpose. An account is provided under the
 * Terms (a contract), not on the strength of consent, so a pre-ticked or
 * mandatory "I agree" box would add friction without adding a legal basis.
 * What the law asks for here is that the reader is told, at the point they
 * hand over an email address, what governs the account and where the privacy
 * information is (GDPR Art. 13; Google's OAuth policy for the Google path).
 * It also states the age floor the Terms set (16 and over, worldwide, chosen
 * 2026-10-18): a statement rather than a birth date, which would be data the
 * site has no other use for.
 */
export function AccountTermsNotice({
  className,
  variant = 'default',
}: {
  className?: string
  /**
   * `google` is the one-line form `/login` shows directly above its Google
   * button. It also says what the button does for a new address (that line
   * used to be a paragraph of its own under the button), so the sign-in page
   * carries one piece of small print instead of two.
   */
  variant?: 'default' | 'google'
}) {
  if (variant === 'google') {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        New here? Continuing with Google creates your account, which means you
        confirm you’re 16 or over and accept the{' '}
        <Link href="/terms" className={LINK_CLASSNAME}>
          Terms
        </Link>
        . The{' '}
        <Link href="/privacy" className={LINK_CLASSNAME}>
          Privacy notice
        </Link>{' '}
        says what it stores.
      </p>
    )
  }

  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      Creating an account, with email or with Google, means you confirm you’re
      16 or over and accept the{' '}
      <Link href="/terms" className={LINK_CLASSNAME}>
        Terms
      </Link>
      . The{' '}
      <Link href="/privacy" className={LINK_CLASSNAME}>
        Privacy notice
      </Link>{' '}
      says what an account stores and how to delete it.
    </p>
  )
}
