import { createBrowserClient } from '@supabase/ssr'

// Browser client — for Client Components only.
export function createClient() {
  return createBrowserClient(
    // Literal process.env on purpose — Next.js inlines NEXT_PUBLIC_* into the
    // client bundle by textual substitution, which lib/env.ts's dynamic access
    // would defeat. This file is the documented exception to the env.ts rule.
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
