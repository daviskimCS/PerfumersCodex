import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'

/**
 * One trivial round trip, so the Supabase free tier sees activity and does not
 * pause the project after a week without queries. Reads no rows.
 */
export async function pingDatabase(): Promise<void> {
  await db.execute(sql`select 1`)
}
