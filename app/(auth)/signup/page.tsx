import type { Metadata } from 'next'

import { SignupForm } from '@/components/auth/signup-form'

/**
 * `/signup` — a Server Component whose only job is the page's metadata; the
 * interactive form is `components/auth/signup-form.tsx`. See the note in
 * `../login/page.tsx` for why the split exists (W7-B).
 */
export const metadata: Metadata = {
  // Exercises the root layout's title.template ("%s · Perfumers Codex").
  title: 'Create an account',
  description:
    'Create a Perfumers Codex account to save materials and keep private notes. Reading the reference never requires one.',
  alternates: { canonical: '/signup' },
}

export default function SignupPage() {
  return <SignupForm />
}
