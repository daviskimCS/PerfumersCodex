import type { Metadata } from 'next'

import { LoginForm } from '@/components/auth/login-form'

/**
 * `/login` — a Server Component whose only job is the page's metadata; the
 * interactive form is `components/auth/login-form.tsx`.
 *
 * The split exists because `metadata` is Server-Component-only, and this page
 * has to have a title of its own: before W7-B both auth pages fell through to
 * the root layout's bare "Perfumers Codex", which describes neither of them
 * (WCAG 2.4.2 Page Titled, and the "page metadata" line in
 * docs/quality-checklist.md). Next documents exactly this arrangement — keep
 * page.tsx a Server Component, move the client logic to its own file
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 * generate-metadata.md).
 */
export const metadata: Metadata = {
  // Exercises the root layout's title.template ("%s · Perfumers Codex").
  title: 'Sign in',
  description:
    'Sign in to Perfumers Codex to save materials and keep private notes. Reading the reference never requires an account.',
  alternates: { canonical: '/login' },
}

export default function LoginPage() {
  return <LoginForm />
}
