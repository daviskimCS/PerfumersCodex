/**
 * The review gate's command (migration 0008). The only way anything reaches
 * readers.
 *
 *   npm run db:review list                          # where everything stands
 *   npm run db:review show iso-e-super              # everything its page would show
 *   npm run db:review publish iso-e-super <fp>      # publish what `show` printed
 *   npm run db:review revoke civetone               # take it down again
 *   npm run db:review refresh                       # recompute stored fingerprints
 *
 * The fingerprint covers what the page RENDERS (lib/review/fingerprint.ts):
 * the material's own rows and the shared ones it shows (family names, IFRA
 * category names, hazard statements, class names, full citation rows,
 * similar materials). `publish` refuses unless the fingerprint you pass is
 * still the current one, so what goes live is exactly what `show` showed you.
 * If anything changes afterwards, from any writer, the page hides itself.
 *
 * Verbs are positional, never flags (lib/review/args.ts): npm swallows
 * `--flags` typed without a separating `--`, which once turned a revoke into
 * a publish.
 *
 * Operator tool: it imports the Drizzle client and review operations from
 * lib/db, like the seed.
 */
import { config as loadEnvFile } from 'dotenv'

import { db } from '@/lib/db'
import {
  assertReviewGateMigrated,
  listReviewStatus,
  publishMaterial,
  refreshFingerprints,
  ReviewError,
  revokeMaterial,
  type ReviewStatus,
} from '@/lib/db/review'
import { loadMaterialForReview } from '@/lib/db/materials'
import { parseReviewArgs, ReviewUsageError } from '@/lib/review/args'
import { materialFingerprint, shortFingerprint } from '@/lib/review/fingerprint'
import { NEXT_STEP } from '@/lib/review/state'
import type { MaterialDetail } from '@/lib/types'

function printStatuses(statuses: ReviewStatus[]): void {
  if (statuses.length === 0) {
    console.log('no materials in the database')
    return
  }
  for (const status of statuses) {
    const fingerprint =
      status.fingerprint === null ? '' : shortFingerprint(status.fingerprint)
    console.log(
      `${status.slug.padEnd(28)} ${status.state.padEnd(22)} ${fingerprint.padEnd(17)} ${NEXT_STEP[status.state]}`
    )
  }
  const published = statuses.filter((status) => status.state === 'published')
  console.log(`\n${published.length} of ${statuses.length} visible to readers`)
}

/** Everything the page would render, in page order, as plain text. */
function printDetail(detail: MaterialDetail, unpublished: Set<string>): void {
  const cite = (id: string | null): string => {
    if (id === null) return ' [uncited]'
    const index = detail.sources.findIndex((source) => source.id === id)
    return index === -1 ? ' [?]' : ` [${index + 1}]`
  }
  const lines: string[] = []
  const section = (title: string, rows: string[]): void => {
    lines.push(`\n${title}`)
    lines.push(
      ...(rows.length === 0 ? ['  (none)'] : rows.map((row) => `  ${row}`))
    )
  }

  lines.push(`${detail.canonicalName}  (/materials/${detail.slug})`)
  section('Identity', [
    `type: ${detail.materialType}`,
    `CAS: ${detail.casNumber ?? '—'}${cite(detail.identitySourceId)}`,
    `IUPAC: ${detail.iupacName ?? '—'}`,
    `formula: ${detail.molecularFormula ?? '—'}   MW: ${detail.molecularWeight ?? '—'}`,
    `SMILES: ${detail.smiles ?? '—'}`,
  ])
  section(
    'Families (names are shared reference data)',
    detail.families.map((f) => `${f.name}  (${f.slug})`)
  )
  section(
    'Structural classes (computed)',
    detail.chemicalClasses.map((c) => `${c.name}  (${c.slug})`)
  )
  section(
    'Synonyms',
    detail.synonyms.map((s) => `${s.name}  — ${s.type}${cite(s.sourceId)}`)
  )
  section(
    'IFRA limits (category names are shared reference data)',
    detail.usageLimits.map(
      (l) =>
        `Cat ${l.categoryId} ${l.categoryName}: ${l.restrictionType}` +
        `${l.maxPct === null ? '' : ` ${l.maxPct}%`}, ${l.ifraAmendmentVersion} amendment, ` +
        `verified ${l.verifiedAt}${l.notes ? ` — ${l.notes}` : ''}${cite(l.sourceId)}`
    )
  )
  section(
    'Verified IFRA absences',
    detail.ifraAbsences.map(
      (a) =>
        `no Standard as of ${a.ifraAmendmentVersion}, verified ${a.verifiedAt}${a.notes ? ` — ${a.notes}` : ''}${cite(a.sourceId)}`
    )
  )
  section(
    'GHS hazards (statements are shared reference data)',
    detail.hazards.map(
      (h) => `${h.code} ${h.description} (${h.category})${cite(h.sourceId)}`
    )
  )
  section(
    'Olfactive description',
    detail.olfactive === null
      ? []
      : [
          `${detail.olfactive.description}${cite(detail.olfactive.sourceId)}`,
          `tenacity ${detail.olfactive.tenacity ?? '—'}, projection ${detail.olfactive.projection ?? '—'}, facets ${detail.olfactive.keyFacets.join(', ') || '—'}`,
        ]
  )
  section(
    'Usage guidance',
    detail.usageGuidance === null
      ? []
      : [
          `typical ${detail.usageGuidance.typicalPctMin ?? '—'}–${detail.usageGuidance.typicalPctMax ?? '—'}%${cite(detail.usageGuidance.sourceId)}`,
          ...(detail.usageGuidance.thresholdNote
            ? [`threshold: ${detail.usageGuidance.thresholdNote}`]
            : []),
          ...(detail.usageGuidance.dilutionNote
            ? [`dilution: ${detail.usageGuidance.dilutionNote}`]
            : []),
        ]
  )
  section(
    'Landmark uses',
    detail.landmarkUses.map(
      (u) =>
        `${u.perfumeName}${u.house ? `, ${u.house}` : ''}${u.year ? ` (${u.year})` : ''}${u.notes ? ` — ${u.notes}` : ''}${cite(u.sourceId)}`
    )
  )
  section(
    'Computed properties',
    detail.computed === null
      ? []
      : [
          `logP ${detail.computed.logp ?? '—'}, TPSA ${detail.computed.tpsa ?? '—'}, heavy atoms ${detail.computed.heavyAtomCount ?? '—'} (RDKit ${detail.computed.rdkitVersion})`,
        ]
  )
  section(
    'Similar materials',
    detail.similar.map(
      (n) =>
        `${n.canonicalName} (${n.slug}) Tanimoto ${n.tanimoto}` +
        `${unpublished.has(n.slug) ? '   [not published: hidden from the page until it is]' : ''}`
    )
  )
  section(
    'Odor predictions (experimental module)',
    detail.odorPredictions.map(
      (p) => `${p.descriptor} ${p.probability} (model ${p.modelVersion})`
    )
  )
  section(
    'Sources (as cited, numbered)',
    detail.sources.map(
      (s, i) =>
        `[${i + 1}] ${s.title} — ${s.type}${s.author ? `, ${s.author}` : ''}` +
        `${s.publishedAt ? `, published ${s.publishedAt}` : ''}, accessed ${s.accessedAt}` +
        `${s.url ? `\n      ${s.url}` : ''}`
    )
  )
  console.log(lines.join('\n'))
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
  const command = parseReviewArgs(process.argv.slice(2), process.env)
  // tsx is not Next.js: load .env.local the same way the seed does.
  loadEnvFile({ path: '.env.local', quiet: true })
  loadEnvFile({ quiet: true })

  connectionOpened = true
  await assertReviewGateMigrated()

  switch (command.verb) {
    case 'list':
      printStatuses(await listReviewStatus())
      return
    case 'refresh':
      printStatuses(await refreshFingerprints())
      return
    case 'show': {
      const loaded = await loadMaterialForReview(command.slug)
      if (loaded === null) {
        throw new ReviewError(
          `${command.slug}: no live material with that slug`
        )
      }
      printDetail(loaded.detail, loaded.unpublishedNeighbors)
      const fingerprint = materialFingerprint(loaded.detail)
      const live = loaded.reviewedHash === fingerprint
      console.log(
        `\nfingerprint: ${shortFingerprint(fingerprint)}  (${live ? 'published in exactly this form' : 'not published in this form'})` +
          `\nto publish exactly this: npm run db:review publish ${command.slug} ${shortFingerprint(fingerprint)}`
      )
      return
    }
    case 'publish': {
      const result = await publishMaterial(command.slug, command.fingerprint)
      console.log(
        result.alreadyPublished
          ? `${command.slug}: already published in this form`
          : `${command.slug}: published — ${result.loaded.detail.canonicalName} (${shortFingerprint(result.fingerprint)})`
      )
      return
    }
    case 'revoke': {
      const outcome = await revokeMaterial(command.slug)
      console.log(
        outcome === 'revoked'
          ? `${command.slug}: review revoked — hidden from readers`
          : `${command.slug}: was not reviewed; nothing to revoke`
      )
      return
    }
  }
}

main()
  .then(closeConnection)
  .catch(async (error: unknown) => {
    if (error instanceof ReviewUsageError || error instanceof ReviewError) {
      console.error(`review: ${error.message}`)
    } else {
      console.error(error)
    }
    process.exitCode = 1
    await closeConnection()
  })
