import postgres from 'postgres'

import { integrationEnv } from './env'
import { TEST_MATERIAL_SLUG } from './fixtures'

/**
 * Runs once before the suite: checks the stack is local (integrationEnv
 * throws otherwise), checks the app's migrations are applied, and makes sure
 * one material exists for bookmarks and notes to point at.
 *
 * The material is a plain row with no review fingerprint, so it is never
 * "published" — which is fine: RLS on the user tables does not care, and
 * nothing here renders a material page.
 */
export default async function globalSetup() {
  const env = integrationEnv()
  const sql = postgres(env.databaseUrl, { max: 1, onnotice: () => {} })
  try {
    const [{ applied }] = await sql<{ applied: boolean }[]>`
      select to_regclass('public.user_notes') is not null as applied`
    if (!applied) {
      throw new Error(
        'The app migrations are not applied to the local database. Run `DIRECT_URL=$TEST_DATABASE_URL npm run db:migrate` first.'
      )
    }

    await sql.begin(async (tx) => {
      const [existing] = await tx`
        select id from materials where slug = ${TEST_MATERIAL_SLUG}`
      if (existing) return
      const [source] = await tx`
        insert into sources (type, title, accessed_at)
        values ('other', 'Integration test source', now())
        returning id`
      await tx`
        insert into materials (slug, canonical_name, material_type, identity_source_id)
        values (${TEST_MATERIAL_SLUG}, 'Integration Test Material', 'synthetic', ${source.id})`
    })
  } finally {
    await sql.end()
  }
}
