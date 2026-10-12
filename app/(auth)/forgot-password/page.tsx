import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

/**
 * `/forgot-password` — metadata only; the form is a client component, the
 * same split `/login` uses and for the same reason.
 */
export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Get a link to choose a new password for Perfumers Codex.',
  robots: { index: false },
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
