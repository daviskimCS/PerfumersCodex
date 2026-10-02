import { and, asc, eq, isNull } from 'drizzle-orm'

import { materials } from '@/db/schema'
import { db } from '@/lib/db'
import {
  loadMaterialForReview,
  type MaterialForReview,
} from '@/lib/db/materials'
import {
  materialFingerprint,
  shortFingerprint,
  SHORT_FINGERPRINT_LENGTH,
} from '@/lib/review/fingerprint'
import { reviewState, type ReviewState } from '@/lib/review/state'

/**
 * The review gate's operator side (migration 0008). Called by
 * `npm run db:review` (scripts/review.ts) and by the seed. Never by app code:
 * the app only reads through `materialIsPublished` and `getMaterialBySlug`.
 *
 * A material is public when `reviewed_hash` equals the fingerprint of what
 * its page renders. `content_hash` is the STORED copy of that fingerprint,
 * which the list queries compare against because recomputing it per row is
 * too costly. The detail page recomputes it on every request.
 */

export class ReviewError extends Error {}

/**
 * Fail before writing anything when migration 0008 is missing, rather than
 * half-way through a seed with a raw "column does not exist".
 */
export async function assertReviewGateMigrated(): Promise<void> {
  try {
    await db
      .select({
        contentHash: materials.contentHash,
        reviewedHash: materials.reviewedHash,
        reviewedAt: materials.reviewedAt,
      })
      .from(materials)
      .limit(0)
  } catch (cause) {
    const code = (cause as { code?: string } | null)?.code
    const nested = (cause as { cause?: { code?: string } } | null)?.cause?.code
    if (code === '42703' || nested === '42703') {
      throw new ReviewError(
        'migration 0008 (the review gate) is not applied to this database. ' +
          'Run `npm run db:migrate` from a checkout that contains ' +
          'db/migrations/0008_material-review-gate.sql, then retry.'
      )
    }
    throw cause
  }
}

export interface ReviewStatus {
  slug: string
  canonicalName: string
  state: ReviewState
  /** Fingerprint of what the page would render now; null when soft-deleted. */
  fingerprint: string | null
  reviewedAt: Date | null
}

function statusOf(
  loaded: MaterialForReview,
  fingerprint: string
): ReviewStatus {
  return {
    slug: loaded.detail.slug,
    canonicalName: loaded.detail.canonicalName,
    state: reviewState({
      contentHash: fingerprint,
      reviewedHash: loaded.reviewedHash,
      deletedAt: null,
    }),
    fingerprint,
    reviewedAt: loaded.reviewedAt,
  }
}

async function liveSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: materials.slug })
    .from(materials)
    .where(isNull(materials.deletedAt))
    .orderBy(asc(materials.slug))
  return rows.map((row) => row.slug)
}

/**
 * Recompute and store `content_hash` for EVERY live material, not just the
 * ones a seed run wrote: a shared row (source, family, IFRA category, hazard
 * statement, class) written for one material changes what others render.
 * Run by the seed after every run, and by `db:review refresh`.
 */
export async function refreshFingerprints(): Promise<ReviewStatus[]> {
  const statuses: ReviewStatus[] = []
  for (const slug of await liveSlugs()) {
    const loaded = await loadMaterialForReview(slug)
    if (loaded === null) continue // soft-deleted between the two reads
    const fingerprint = materialFingerprint(loaded.detail)
    if (loaded.contentHash !== fingerprint) {
      await db
        .update(materials)
        .set({ contentHash: fingerprint })
        .where(eq(materials.id, loaded.detail.id))
    }
    statuses.push(statusOf(loaded, fingerprint))
  }
  return statuses
}

/**
 * Every material's state, from LIVE fingerprints (read-only). Soft-deleted
 * rows are listed too, so nothing in the table is invisible to the maker.
 */
export async function listReviewStatus(): Promise<ReviewStatus[]> {
  const rows = await db
    .select({
      slug: materials.slug,
      canonicalName: materials.canonicalName,
      deletedAt: materials.deletedAt,
      reviewedAt: materials.reviewedAt,
    })
    .from(materials)
    .orderBy(asc(materials.slug))

  const statuses: ReviewStatus[] = []
  for (const row of rows) {
    if (row.deletedAt !== null) {
      statuses.push({
        slug: row.slug,
        canonicalName: row.canonicalName,
        state: 'soft-deleted',
        fingerprint: null,
        reviewedAt: row.reviewedAt,
      })
      continue
    }
    const loaded = await loadMaterialForReview(row.slug)
    if (loaded === null) continue
    statuses.push(statusOf(loaded, materialFingerprint(loaded.detail)))
  }
  return statuses
}

/** Placeholder families the research agents proposed for the maker to replace. */
const PLACEHOLDER = /\bPROPOSED\b/

/**
 * Publish one material, but only in the exact form the maker was shown.
 *
 * `expected` is the fingerprint `db:review show` printed (short or full). If
 * anything the page renders changed since then, the fingerprints differ and
 * nothing is written. That binds the review to what was actually reviewed,
 * not to whatever is in the database by the time the command runs.
 */
export async function publishMaterial(
  slug: string,
  expected: string
): Promise<{
  fingerprint: string
  alreadyPublished: boolean
  loaded: MaterialForReview
}> {
  const loaded = await loadMaterialForReview(slug)
  if (loaded === null) {
    throw new ReviewError(`${slug}: no live material with that slug`)
  }
  const fingerprint = materialFingerprint(loaded.detail)
  const short = shortFingerprint(fingerprint)
  if (expected.length < SHORT_FINGERPRINT_LENGTH) {
    throw new ReviewError(
      `${slug}: give the full ${SHORT_FINGERPRINT_LENGTH}-character fingerprint from \`db:review show\``
    )
  }
  if (expected !== fingerprint && expected !== short) {
    throw new ReviewError(
      `${slug}: what the page would show has changed since that fingerprint was printed ` +
        `(now ${short}). Nothing was published. Run \`db:review show ${slug}\` and review it again.`
    )
  }
  const placeholders = loaded.detail.families.filter((family) =>
    PLACEHOLDER.test(family.name)
  )
  if (placeholders.length > 0) {
    throw new ReviewError(
      `${slug}: its families include placeholder names ` +
        `(${placeholders.map((family) => `"${family.name}"`).join(', ')}). ` +
        'Replace them in families.json and re-seed before publishing.'
    )
  }
  if (loaded.reviewedHash === fingerprint) {
    return { fingerprint, alreadyPublished: true, loaded }
  }

  const updated = await db
    .update(materials)
    .set({
      reviewedHash: fingerprint,
      contentHash: fingerprint,
      reviewedAt: new Date(),
    })
    .where(and(eq(materials.id, loaded.detail.id), isNull(materials.deletedAt)))
    .returning({ id: materials.id })
  if (updated.length !== 1) {
    throw new ReviewError(
      `${slug}: it was soft-deleted while this ran; nothing was published`
    )
  }
  return { fingerprint, alreadyPublished: false, loaded }
}

/** Take one material down. Revoking an unreviewed material is a no-op. */
export async function revokeMaterial(
  slug: string
): Promise<'revoked' | 'was not reviewed'> {
  const row = (
    await db
      .select({ id: materials.id, reviewedHash: materials.reviewedHash })
      .from(materials)
      .where(eq(materials.slug, slug))
      .limit(1)
  )[0]
  if (row === undefined) {
    throw new ReviewError(`${slug}: no material with that slug`)
  }
  if (row.reviewedHash === null) return 'was not reviewed'
  await db
    .update(materials)
    .set({ reviewedHash: null, reviewedAt: null })
    .where(eq(materials.id, row.id))
  return 'revoked'
}
