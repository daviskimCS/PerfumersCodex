import { createClient } from '@supabase/supabase-js'

// Admin client with service role — server-only, never expose to the client.
// Used exclusively for privileged operations: account deletion, admin tasks.
// All regular auth operations use the SSR client in lib/supabase/server.ts.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
