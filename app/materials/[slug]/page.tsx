import type { Metadata } from 'next'
import { cache, Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Cite } from '@/components/material/cite'
import { ComputedPropertiesModule } from '@/components/material/computed-properties'
import { humanize } from '@/components/material/format'
import { MaterialIdentity } from '@/components/material/identity'
import { OdorPredictionsModule } from '@/components/material/odor-predictions'
import { OlfactivePanel } from '@/components/material/olfactive-panel'
import { SafetyPanel } from '@/components/material/safety-panel'
import { SimilarMaterialsModule } from '@/components/material/similar-materials'
import { SourcesPanel } from '@/components/material/sources-panel'
import { MaterialStructure } from '@/components/material/structure'
import { MaterialTabs } from '@/components/material/tabs'
import { parseMaterialTab } from '@/components/material/tabs-config'
import { UsagePanel } from '@/components/material/usage-panel'
import {
  NoteEditor,
  NoteEditorSkeleton,
  NoteEditorUnavailable,
} from '@/components/note-editor'
import { SaveButton, SaveButtonSkeleton } from '@/components/save-button'
import { Badge } from '@/components/ui/badge'
import { getCurrentUserId, isMaterialSaved } from '@/lib/db/bookmarks'
import { getMaterialBySlug } from '@/lib/db/materials'
import { getNote } from '@/lib/db/notes'

// Without this, `next build` statically prerenders the route and the DB query
// runs at build time — so the build starts depending on a live database,
// which CI does not have. The deliberate caching pass (cacheLife/cacheTag)
// comes after seeding settles (wave-4.md, wave-specific constraint 3).
export const dynamic = 'force-dynamic'

// generateMetadata and the page body both need the material; React's cache()
// dedupes them to one DB read per request.
const getMaterial = cache(getMaterialBySlug)

interface MaterialRouteProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  params,
}: MaterialRouteProps): Promise<Metadata> {
  const { slug } = await params
  const material = await getMaterial(slug)
  if (!material) notFound()

  const description = `${material.canonicalName} in the Perfumers Codex — identifiers, cited IFRA limits and GHS hazards, olfactive notes, and usage guidance.`

  return {
    // Exercises the root layout's title.template ("%s · Perfumers Codex").
    title: material.canonicalName,
    description,
    alternates: { canonical: `/materials/${material.slug}` },
    openGraph: {
      type: 'article',
      title: material.canonicalName,
      description,
      url: `/materials/${material.slug}`,
    },
    twitter: {
      card: 'summary',
      title: material.canonicalName,
      description,
    },
  }
}

export default async function MaterialPage({
  params,
  searchParams,
}: MaterialRouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const material = await getMaterial(slug)
  // A wrong slug is a 404, not an error state (docs/architecture.md D4).
  if (!material) notFound()

  // Read on the server so a deep link (?tab=sources#source-2) arrives with the
  // right panel already in the HTML — the tab component only takes it from
  // here and keeps the URL in step afterwards.
  const initialTab = parseMaterialTab(query.tab)

  return (
    <article className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      {/* ────────────────────────────────────────────────────────────────
          HERO — deliberately inline rather than a component. Wave 5 mounts
          the save button here, and factoring this out would turn that into
          an edit outside its file list (wave-4.md, W4-C).
          ──────────────────────────────────────────────────────────────── */}
      <header>
        <Link
          href="/materials"
          className="font-mono text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Materials
        </Link>

        <div className="mt-6 flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-12">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              {humanize(material.materialType)}
            </p>

            <h1 className="mt-3 font-display text-3xl md:text-4xl">
              {material.canonicalName}
            </h1>

            {material.casNumber ? (
              <p className="mt-4 font-mono text-sm">
                <span className="text-muted-foreground">CAS </span>
                {material.casNumber}
                <Cite
                  sources={material.sources}
                  sourceId={material.identitySourceId}
                />
              </p>
            ) : null}

            {material.families.length > 0 ? (
              <ul className="mt-6 flex flex-wrap gap-2">
                {material.families.map((family) => (
                  <li key={family.slug}>
                    <Badge variant="outline">{family.name}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}

            {/* W5-B mounts here — the reason this hero stayed inline. Its own
                Suspense boundary keeps the session round-trip off the critical
                path: the material renders as soon as the database answers, and
                the button arrives in a box the skeleton already reserved. */}
            <div className="mt-8">
              <Suspense fallback={<SaveButtonSkeleton />}>
                <SaveControl materialId={material.id} />
              </Suspense>
            </div>
          </div>

          {/* Drawn at seed time and inlined here; nothing renders at all
              when the material has no SMILES. */}
          <MaterialStructure
            smiles={material.smiles}
            structure={material.structure}
            name={material.canonicalName}
          />
        </div>
      </header>

      <MaterialIdentity material={material} />

      <div className="mt-14">
        <MaterialTabs
          initialTab={initialTab}
          panels={{
            safety: (
              <SafetyPanel
                usageLimits={material.usageLimits}
                ifraAbsences={material.ifraAbsences}
                hazards={material.hazards}
                sources={material.sources}
              />
            ),
            olfactive: (
              <OlfactivePanel
                olfactive={material.olfactive}
                sources={material.sources}
              />
            ),
            usage: (
              <UsagePanel
                usageGuidance={material.usageGuidance}
                landmarkUses={material.landmarkUses}
                sources={material.sources}
              />
            ),
            sources: <SourcesPanel sources={material.sources} />,
          }}
        />
      </div>

      {/* Structure-derived context. Below the tabs, not inside them: none of
          it is a cited fact, and none of it is editorial. */}
      <ComputedPropertiesModule
        computed={material.computed}
        smiles={material.smiles}
      />
      <SimilarMaterialsModule
        similar={material.similar}
        smiles={material.smiles}
      />

      {/* Model output — its own separated, labelled block, never intermixed
          with the human-written description (AGENTS.md). */}
      <OdorPredictionsModule predictions={material.odorPredictions} />

      {/* W6-A mounts here: the reader's own private note, below the tabs and
          outside every panel, so nothing about the layout can put a personal
          scribble next to a cited fact (AGENTS.md). Its own Suspense boundary
          keeps the session and note round trips off the critical path — the
          material renders as soon as the database answers. Mounted *last* on
          purpose: signed out, the whole region renders nothing, and there is
          no content below it for that collapse to shift. */}
      <Suspense fallback={<NoteEditorSkeleton />}>
        <NoteRegion materialId={material.id} />
      </Suspense>
    </article>
  )
}

/**
 * Server-side data wiring for the save button (W5-B).
 *
 * Both facts the button renders from are settled here, on the server: whether
 * there is a session (`getUser()`, validated against the auth server, never
 * `getSession()`) and whether this material is already on that user's shelf
 * (read through the Supabase client, so RLS decides what is visible). The
 * client component is handed the answers; it never asks Supabase anything.
 */
async function SaveControl({ materialId }: { materialId: string }) {
  let signedIn = false
  let saved = false

  try {
    signedIn = (await getCurrentUserId()) !== null
    if (signedIn) saved = await isMaterialSaved(materialId)
  } catch (error) {
    // A public reference page must survive an auth-service or bookmark hiccup.
    // This degrades one control — to the signed-out link, or to an unsaved
    // button whose save is an idempotent upsert either way — and logs the real
    // failure, rather than throwing the whole cited material page to
    // error.tsx over a feature nobody came here for.
    console.error('[bookmarks] save state unavailable:', error)
  }

  return (
    <SaveButton
      materialId={materialId}
      signedIn={signedIn}
      initialSaved={saved}
    />
  )
}

/**
 * Server-side data wiring for the private note (W6-A).
 *
 * Both facts the editor renders from are settled here, on the server: whether
 * there is a session (`getUser()`, validated against the auth server, never
 * `getSession()`) and the note's current text (read through the Supabase
 * client, so RLS decides what is visible — `lib/db/notes.ts` never touches
 * Drizzle, which would bypass RLS). The client component is handed the answers;
 * it never asks Supabase anything.
 *
 * The two failure modes are deliberately not the same failure:
 *
 * - the *session* read failed, so the reader cannot be identified at all → the
 *   region renders nothing, exactly as it would for a signed-out visitor. A
 *   public reference page must survive an auth-service hiccup, and claiming a
 *   note problem to someone who may not even have an account would be noise.
 * - the *note* read failed for a reader we know is signed in → say so. An empty
 *   textarea here would read as "you have no note" and invite them to type over
 *   one that still exists (D4: never catch-and-render-blank).
 */
async function NoteRegion({ materialId }: { materialId: string }) {
  let signedIn = false
  let body: string | null = null
  let unavailable = false

  try {
    signedIn = (await getCurrentUserId()) !== null
    if (signedIn) body = await getNote(materialId)
  } catch (error) {
    console.error('[notes] private note unavailable:', error)
    // True only when the session resolved and the note read is what threw.
    unavailable = signedIn
  }

  if (unavailable) return <NoteEditorUnavailable />

  return (
    <NoteEditor
      materialId={materialId}
      signedIn={signedIn}
      initialBody={body ?? ''}
    />
  )
}
