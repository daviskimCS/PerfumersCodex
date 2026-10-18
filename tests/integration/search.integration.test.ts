import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { fetchCandidates } from '@/lib/db/search'
import { normalizeQuery } from '@/lib/search/normalize'
import { rankCandidates } from '@/lib/search/rank'
import type { SearchResult } from '@/lib/types'

import { sql } from './helpers'

/**
 * The search SQL against real Postgres: pg_trgm, the materialized view and
 * the review gate, with the ranker on top. The unit suite proves the ranker
 * on synthetic evidence; this proves the evidence itself, which is where the
 * missing prefix leg hid ("eth" never reached the ranker at all).
 *
 * `lib/db` is pointed at the local database. The app's client insists on the
 * pooler port, which the local stack does not run; the SQL is the same.
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
const PREFIX = 'search-it-'

/**
 * Published here means what the review gate checks: not deleted, and
 * reviewed_hash equal to content_hash. These rows live only in the local
 * test database for the length of this file; nothing reaches readers.
 */
const PUBLISHED = 'search-integration-fixture'

interface Fixture {
  slug: string
  name: string
  published: boolean
  deleted?: boolean
  synonyms?: { name: string; type: 'trade_name' | 'abbreviation' }[]
  description?: string
}

const FIXTURES: Fixture[] = [
  {
    slug: `${PREFIX}iso-e-super`,
    name: 'Iso E Super',
    published: true,
    synonyms: [
      { name: 'OTNE', type: 'abbreviation' },
      { name: 'Timbersilk', type: 'trade_name' },
    ],
  },
  { slug: `${PREFIX}javanol`, name: 'Javanol', published: true },
  // A long name whose short prefix shares too few trigrams to reach 0.3:
  // "eth" against this scores 0.18.
  { slug: `${PREFIX}ethyl`, name: 'Ethyl Fixturine', published: true },
  {
    slug: `${PREFIX}described`,
    name: 'Described Fixture',
    published: true,
    description: 'A dry cedarlike note.',
  },
  { slug: `${PREFIX}percent`, name: '50% Fixture', published: true },
  // The review gate: neither may ever surface, whatever the query.
  { slug: `${PREFIX}unreviewed`, name: 'Isohidden Fixture', published: false },
  {
    slug: `${PREFIX}deleted`,
    name: 'Isodeleted Fixture',
    published: true,
    deleted: true,
  },
]

async function removeFixtures(): Promise<void> {
  const ids = sql`select id from materials where slug like ${`${PREFIX}%`}`
  await sql`delete from material_descriptions where material_id in (${ids})`
  await sql`delete from material_synonyms where material_id in (${ids})`
  await sql`delete from materials where slug like ${`${PREFIX}%`}`
}

beforeAll(async () => {
  await removeFixtures()
  await sql.begin(async (tx) => {
    const [source] = await tx`
      insert into sources (type, title, accessed_at)
      values ('other', 'Search integration test source', now())
      returning id`

    for (const fixture of FIXTURES) {
      const hash = fixture.published ? PUBLISHED : null
      const [material] = await tx`
        insert into materials (
          slug, canonical_name, material_type, identity_source_id,
          content_hash, reviewed_hash, reviewed_at, deleted_at
        )
        values (
          ${fixture.slug}, ${fixture.name}, 'synthetic', ${source.id},
          ${PUBLISHED}, ${hash}, ${hash === null ? null : sql`now()`},
          ${fixture.deleted ? sql`now()` : null}
        )
        returning id`

      for (const synonym of fixture.synonyms ?? []) {
        await tx`
          insert into material_synonyms (material_id, name, synonym_type, source_id)
          values (${material.id}, ${synonym.name}, ${synonym.type}, ${source.id})`
      }
      if (fixture.description !== undefined) {
        await tx`
          insert into material_descriptions (material_id, description)
          values (${material.id}, ${fixture.description})`
      }
    }
  })
  await sql`refresh materialized view material_search_view`
})

afterAll(async () => {
  await removeFixtures()
  await sql`refresh materialized view material_search_view`
})

/** The pipeline minus the CAS short-circuit and the log, scoped to fixtures. */
async function search(query: string): Promise<SearchResult[]> {
  const normalized = normalizeQuery(query)
  const results = rankCandidates(await fetchCandidates(normalized), normalized)
  return results.filter((result) => result.slug.startsWith(PREFIX))
}

function slugs(results: SearchResult[]): string[] {
  return results.map((result) => result.slug.slice(PREFIX.length))
}

describe('search SQL — prefixes', () => {
  it.each(['i', 'is', 'iso', 'iso e'])(
    'finds Iso E Super first from "%s"',
    async (query) => {
      const results = await search(query)
      expect(slugs(results)[0]).toBe('iso-e-super')
      expect(results[0].matchTier).toBe(3)
    }
  )

  it('finds a long name from a short prefix trigrams alone miss', async () => {
    const results = await search('eth')
    expect(slugs(results)).toEqual(['ethyl'])
    expect(results[0].matchTier).toBe(3)
  })

  it('finds a material by the prefix of a synonym', async () => {
    const results = await search('timb')
    expect(slugs(results)).toEqual(['iso-e-super'])
    expect(results[0].matchTier).toBe(3)
  })

  it('treats % and _ in a query as characters, not wildcards', async () => {
    expect(slugs(await search('50%'))).toEqual(['percent'])
    expect(slugs(await search('5%'))).toEqual([])
    expect(slugs(await search('5_'))).toEqual([])
  })
})

describe('search SQL — the other rules', () => {
  it('ranks an exact name first (rule 1)', async () => {
    const results = await search('Javanol')
    expect(slugs(results)).toEqual(['javanol'])
    expect(results[0].matchTier).toBe(1)
  })

  it('reports the synonym that matched exactly (rule 2)', async () => {
    const [result] = await search('otne')
    expect(result.slug).toBe(`${PREFIX}iso-e-super`)
    expect(result.matchTier).toBe(2)
    expect(result.matchedSynonym).toBe('OTNE')
  })

  it('tolerates a typo through trigram similarity (rule 3)', async () => {
    expect(slugs(await search('javanl'))).toEqual(['javanol'])
  })

  it('reaches description text through full-text search (rule 4)', async () => {
    const results = await search('cedarlike')
    expect(slugs(results)).toEqual(['described'])
    expect(results[0].matchTier).toBe(4)
  })
})

describe('search SQL — the review gate', () => {
  it.each(['iso', 'isohidden fixture', 'isodeleted fixture', 'fixture'])(
    'never returns an unreviewed or deleted material for "%s"',
    async (query) => {
      const found = slugs(await search(query))
      expect(found).not.toContain('unreviewed')
      expect(found).not.toContain('deleted')
    }
  )
})
