'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

import { TURNSTILE_FIELD } from '@/lib/validation/turnstile'

/**
 * Cloudflare Turnstile, the bot check on every form that sends a password or
 * an email to Supabase Auth (sign-in, sign-up, password reset, the current-
 * password check on /account).
 *
 * Dormant until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set: with no key it renders
 * nothing and loads no script, and the server skips the check
 * (lib/turnstile.ts). The variable is read as a literal so Next.js inlines it
 * into the browser bundle; lib/env.ts is server-only.
 *
 * Loaded by script tag, not an npm package: the script must come from
 * Cloudflare's own URL (proxying or bundling it breaks it). Rendered
 * explicitly so the token can be reset after every submission. A token is
 * single-use, and a form that comes back with an error (wrong password) would
 * otherwise resubmit a spent one. `interaction-only` keeps the widget
 * invisible unless Cloudflare decides to ask the reader to click.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

type Turnstile = {
  render(
    container: HTMLElement,
    options: Record<string, unknown>
  ): string | undefined
  reset(widgetId: string): void
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

export function TurnstileField({
  action,
  resetKey,
}: {
  /** Shown in Cloudflare's analytics, to tell the forms apart. */
  action: string
  /** Any value that changes after each submission: the form's action state. */
  resetKey: unknown
}) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  useEffect(() => {
    const turnstile = window.turnstile
    if (!SITE_KEY || !scriptReady || !turnstile || !container.current) return
    widgetId.current =
      turnstile.render(container.current, {
        sitekey: SITE_KEY,
        action,
        appearance: 'interaction-only',
        theme: 'auto',
        'response-field-name': TURNSTILE_FIELD,
      }) ?? null
    return () => {
      if (widgetId.current) turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [scriptReady, action])

  useEffect(() => {
    if (widgetId.current) window.turnstile?.reset(widgetId.current)
  }, [resetKey])

  if (!SITE_KEY) return null

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={container} />
    </>
  )
}
