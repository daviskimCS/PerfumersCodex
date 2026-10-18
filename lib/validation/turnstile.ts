/**
 * The form field a Cloudflare Turnstile token arrives in. Shared by the widget
 * (components/auth/turnstile.tsx) and the server check (lib/turnstile.ts), so
 * the two cannot drift apart.
 */
export const TURNSTILE_FIELD = 'cf-turnstile-response'
