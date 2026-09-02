'use client'

import dynamic from 'next/dynamic'

import { StructurePlate } from './structure-plate'

/**
 * The structure viewer's boundary component.
 *
 * `page.tsx` imports this statically; this file is what performs the
 * `next/dynamic(..., { ssr: false })`. The indirection is required, not
 * stylistic: `ssr: false` called from a server component is a hard error in
 * Next 16 ("`ssr: false` is not allowed with `next/dynamic` in Server
 * Components" — node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md).
 * So the wrapper carries `'use client'` and the RDKit component stays behind
 * an async import.
 *
 * The wrapper itself is a handful of bytes. `structure-canvas` — and through
 * it the whole `@rdkit/rdkit` glue plus its 6.6 MB WASM — is a separate chunk
 * fetched only once this mounts, which is the entire Lighthouse budget for
 * this page (docs/cheminformatics.md).
 */
const StructureCanvas = dynamic(() => import('./structure-canvas'), {
  ssr: false,
  loading: () => <StructurePlate busy />,
})

export function MaterialStructure({
  smiles,
  name,
}: {
  /** `null` for naturals and other mixtures — see `lib/types.ts`. */
  smiles: string | null
  name: string
}) {
  // A NULL-SMILES material renders no structure UI at all: no plate, no
  // placeholder, no empty frame. There is nothing to draw and nothing missing
  // — a mixture simply has no single structure (AGENTS.md).
  if (smiles === null) return null
  return <StructureCanvas smiles={smiles} name={name} />
}
