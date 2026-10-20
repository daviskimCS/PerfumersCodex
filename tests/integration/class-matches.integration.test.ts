import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { loadMaterialForReview } from '@/lib/db/materials'

import { sql } from './helpers'

/**
 * The matched atoms of a chemical class (migration 0013), through real
 * Postgres: the `smallint[]` column the seed writes must reach
 * `MaterialDetail.classMatches` as numbers, in the class's own order, so the
 * page's highlight toggles tint the atoms the seed computed. The unit suite
 * proves the atoms are right; this proves they survive the database.
 *
 * `lib/db` is pointed at the local database, as in the search suite.
 */
vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/postgres-js')
  const { default: postgres } = await import('postgres')
  const schema = await import('@/db/schema')
  const { integrationEnv } = await import('./env')
  const client = postgres(integrationEnv().databaseUrl, {
    prepare: false,
    max: 2,
    onnotice: () => {},
  })
  return { db: drizzle(client, { schema }) }
})

/** Every fixture slug starts with this, so cleanup can never touch real rows. */
const PREFIX = 'class-match-it-'
const SLUG = `${PREFIX}iso-e-super`

async function removeFixtures(): Promise<void> {
  const ids = sql`select id from materials where slug like ${`${PREFIX}%`}`
  await sql`delete from material_chemical_classes where material_id in (${ids})`
  await sql`delete from material_structure_drawings where material_id in (${ids})`
  await sql`delete from materials where slug like ${`${PREFIX}%`}`
  await sql`delete from chemical_classes where slug like ${`${PREFIX}%`}`
}

beforeAll(async () => {
  await removeFixtures()
  await sql.begin(async (tx) => {
    const [source] = await tx`
      insert into sources (type, title, accessed_at)
      values ('other', 'Class match integration test source', now())
      returning id`
    const [material] = await tx`
      insert into materials (
        slug, canonical_name, material_type, identity_source_id, smiles
      )
      values (
        ${SLUG}, 'Class Match Fixture', 'synthetic', ${source.id},
        'CC1CC2=C(CC1(C)C(=O)C)C(CCC2)(C)C'
      )
      returning id`
    await tx`
      insert into material_structure_drawings (material_id, svg, rdkit_version)
      values (${material.id}, '<svg viewBox=''0 0 640 480''></svg>', '2025.03.4')`
    await tx`
      insert into chemical_classes (slug, name, smarts, description, sort_order)
      values
        (${`${PREFIX}ketone`}, 'Ketone', '[#6][CX3](=O)[#6]', 'Fixture.', 1),
        (${`${PREFIX}older`}, 'Older', '[#6]', 'Fixture.', 2)`
    await tx`
      insert into material_chemical_classes
        (material_id, class_slug, matched_atoms, rdkit_version)
      values
        (${material.id}, ${`${PREFIX}ketone`}, ${[6, 8, 9, 10]}::smallint[], '2025.03.4')`
    // A row from before migration 0013: the column's default, no atoms.
    await tx`
      insert into material_chemical_classes (material_id, class_slug, rdkit_version)
      values (${material.id}, ${`${PREFIX}older`}, '2025.03.4')`
  })
})

afterAll(async () => {
  await removeFixtures()
})

describe('class matches', () => {
  it('reach MaterialDetail as the numbers the seed stored', async () => {
    const detail = (await loadMaterialForReview(SLUG))?.detail
    expect(detail?.classMatches).toEqual([
      {
        slug: `${PREFIX}ketone`,
        atoms: [6, 8, 9, 10],
        rdkitVersion: '2025.03.4',
      },
    ])
  })

  it('leave a class seeded before 0013 a plain chip, still listed', async () => {
    const detail = (await loadMaterialForReview(SLUG))?.detail
    expect(detail?.chemicalClasses).toEqual([
      { slug: `${PREFIX}ketone`, name: 'Ketone' },
      { slug: `${PREFIX}older`, name: 'Older' },
    ])
  })
})
