import { createClient } from '@supabase/supabase-js'

import { env } from '@/lib/env'

// Admin client with service role — server-only, never expose to the client.
// Used exclusively for privileged operations: account deletion, admin tasks.
// All regular auth operations use the SSR client in lib/supabase/server.ts.
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
