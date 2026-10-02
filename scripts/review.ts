/**
 * The review gate's only writer (migration 0008).
 *
 *   npm run db:review -- --list
 *   npm run db:review -- iso-e-super javanol      # publish, after reviewing
 *   npm run db:review -- --revoke civetone        # hide again
 *
 * Readers see a material only while `reviewed_hash = content_hash`. The seed
 * records `content_hash` from the data file on every run; this command copies
 * that hash into `reviewed_hash`, which is what "I reviewed this, in this
 * form" means. When the seed later writes different data, the hashes differ
 * and the page hides itself until the next review. No data file, seed flag
 * or app code path can publish a material. Only this command can.
 *
 * Review the data that was SEEDED, not a newer draft on disk: the hash binds
 * to what is in the database. If a draft changed after its last seed, seed it
 * first, then review it.
 *
 * All-or-nothing, like the seed: every named slug is checked before anything
 * is written, and the writes share one transaction. The update also requires
 * `content_hash` to still be the value that was read, so a seed running
 * between the check and the write cannot get a newer, unreviewed version
 * published.
 *
 * Imports `db/schema.ts` directly, as the seed does: an operator tool,
 * outside architecture D1's app-code boundary. The client comes from lib/db.
 */
import { config as loadEnvFile } from 'dotenv'
import { and, asc, eq, inArray } from 'drizzle-orm'

import { materials } from '@/db/schema'
import { db } from '@/lib/db'
import { NEXT_STEP, reviewState } from '@/lib/review/state'

const USAGE = [
  'usage: npm run db:review -- --list',
  '       npm run db:review -- <slug> [<slug> ...]',
  '       npm run db:review -- --revoke <slug> [<slug> ...]',
].join('\n')

class ReviewAbort extends Error {}

type Command =
  | { kind: 'list' }
  | { kind: 'publish'; slugs: string[] }
  | { kind: 'revoke'; slugs: string[] }

function parseArgs(argv: string[]): Command {
  const flags = argv.filter((arg) => arg.startsWith('--'))
  const slugs = [...new Set(argv.filter((arg) => !arg.startsWith('--')))]
  const unknown = flags.filter(
    (flag) => flag !== '--list' && flag !== '--revoke'
  )
  if (unknown.length > 0) {
    throw new ReviewAbort(`unknown flag ${unknown.join(', ')}\n${USAGE}`)
  }
  if (flags.includes('--list')) {
    if (flags.length > 1 || slugs.length > 0) {
      throw new ReviewAbort(`--list takes no other arguments\n${USAGE}`)
    }
    return { kind: 'list' }
  }
  if (slugs.length === 0) throw new ReviewAbort(USAGE)
  return flags.includes('--revoke')
    ? { kind: 'revoke', slugs }
    : { kind: 'publish', slugs }
}

const columns = {
  id: materials.id,
  slug: materials.slug,
  canonicalName: materials.canonicalName,
  casNumber: materials.casNumber,
  contentHash: materials.contentHash,
  reviewedHash: materials.reviewedHash,
  reviewedAt: materials.reviewedAt,
  deletedAt: materials.deletedAt,
}

/** The tail of a hash, enough to tell two versions apart in a log. */
function short(hash: string | null): string {
  return hash === null ? '—' : `…${hash.slice(-10)}`
}

async function list(): Promise<void> {
  const rows = await db
    .select(columns)
    .from(materials)
    .orderBy(asc(materials.slug))
  if (rows.length === 0) {
    console.log('no materials in the database')
    return
  }
  for (const row of rows) {
    const state = reviewState(row)
    const reviewed =
      row.reviewedAt === null
        ? ''
        : ` (reviewed ${row.reviewedAt.toISOString()})`
    console.log(
      `${row.slug.padEnd(28)} ${state.padEnd(22)} ${NEXT_STEP[state]}${reviewed}`
    )
  }
  const published = rows.filter((row) => reviewState(row) === 'published')
  console.log(`\n${published.length} of ${rows.length} visible to readers`)
}

async function publishOrRevoke(
  kind: 'publish' | 'revoke',
  slugs: string[]
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select(columns)
      .from(materials)
      .where(inArray(materials.slug, slugs))
    const bySlug = new Map(rows.map((row) => [row.slug, row]))

    // Check every slug before writing any: one bad name aborts the batch.
    const problems: string[] = []
    for (const slug of slugs) {
      const row = bySlug.get(slug)
      if (row === undefined) {
        problems.push(`${slug}: no such material`)
        continue
      }
      const state = reviewState(row)
      if (
        kind === 'publish' &&
        (state === 'soft-deleted' || state === 'not fingerprinted')
      ) {
        problems.push(`${slug}: ${state} — ${NEXT_STEP[state]}`)
      }
    }
    if (problems.length > 0) {
      throw new ReviewAbort(
        `nothing was changed:\n${problems.map((p) => `  ${p}`).join('\n')}`
      )
    }

    for (const slug of slugs) {
      const row = bySlug.get(slug)!
      const state = reviewState(row)

      if (kind === 'revoke') {
        if (row.reviewedHash === null) {
          console.log(`${slug}: was not reviewed; nothing to revoke`)
          continue
        }
        await tx
          .update(materials)
          .set({ reviewedHash: null, reviewedAt: null })
          .where(eq(materials.id, row.id))
        console.log(`${slug}: review revoked — hidden from readers`)
        continue
      }

      if (state === 'published') {
        console.log(`${slug}: already published (${short(row.contentHash)})`)
        continue
      }
      // `content_hash` must still be the value read above. If a seed ran in
      // between, nothing matches, and the newer data stays unpublished.
      const updated = await tx
        .update(materials)
        .set({ reviewedHash: row.contentHash, reviewedAt: new Date() })
        .where(
          and(
            eq(materials.id, row.id),
            eq(materials.contentHash, row.contentHash!)
          )
        )
        .returning({ id: materials.id })
      if (updated.length !== 1) {
        throw new ReviewAbort(
          `${slug}: its data changed while this ran; nothing was changed. Review it again.`
        )
      }
      console.log(
        `${slug}: published — ${row.canonicalName}` +
          `${row.casNumber === null ? '' : `, CAS ${row.casNumber}`}` +
          `, data ${short(row.contentHash)}`
      )
    }
  })
}

let connectionOpened = false

async function closeConnection(): Promise<void> {
  if (!connectionOpened) return
  // Same reach as scripts/seed.ts: without ending the pool the process hangs.
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
    .$client
  if (client && typeof client.end === 'function') await client.end()
}

async function main(): Promise<void> {
  const command = parseArgs(process.argv.slice(2))
  // tsx is not Next.js: load .env.local the same way the seed does.
  loadEnvFile({ path: '.env.local', quiet: true })
  loadEnvFile({ quiet: true })

  connectionOpened = true
  if (command.kind === 'list') await list()
  else await publishOrRevoke(command.kind, command.slugs)
}

main()
  .then(closeConnection)
  .catch(async (error: unknown) => {
    console.error(
      error instanceof ReviewAbort ? `review: ${error.message}` : error
    )
    process.exitCode = 1
    await closeConnection()
  })
