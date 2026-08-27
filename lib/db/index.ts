import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'

// Pooled connection (port 6543, transaction mode): prepared statements
// don't survive transaction-mode pooling, so prepare must stay off.
//
// Boundary rule: this client connects as the postgres role and BYPASSES RLS.
// Editorial/public data only. User-owned tables (bookmarks, notes) must go
// through the Supabase client (lib/supabase/) so RLS is enforced.
const client = postgres(process.env.DATABASE_URL!, { prepare: false })

export const db = drizzle(client, { schema })
