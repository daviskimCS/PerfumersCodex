import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '@/db/schema'
import { env } from '@/lib/env'

// Pooled connection (port 6543, transaction mode): prepared statements
// don't survive transaction-mode pooling, so prepare must stay off.
//
// Boundary rule: this client connects as the postgres role and BYPASSES RLS.
// Editorial/public data only. User-owned tables (bookmarks, notes) must go
// through the Supabase client (lib/supabase/) so RLS is enforced.
//
// Connected LAZILY, on first query rather than at import. `next build`
// imports every route module to read its segment config (`export const
// dynamic`), so a module-scope `postgres(env.DATABASE_URL)` would demand a
// database URL at build time — and fail the build wherever secrets are
// absent, which is every CI runner and any preview deploy without them
// configured. Route modules must stay importable without credentials;
// only actually querying needs them.
type Db = PostgresJsDatabase<typeof schema>

let instance: Db | undefined

function connect(): Db {
  if (!instance) {
    instance = drizzle(postgres(env.DATABASE_URL, { prepare: false }), {
      schema,
    })
  }
  return instance
}

// A Proxy so callers keep writing `db.select(...)` — the connection is opened
// on the first property access, not when this module is imported.
export const db = new Proxy({} as Db, {
  get: (_target, property, receiver) =>
    Reflect.get(connect(), property, receiver),
})
