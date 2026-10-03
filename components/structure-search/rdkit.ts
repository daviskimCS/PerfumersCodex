import type { RDKitModule } from '@rdkit/rdkit'

/**
 * Loading RDKit.js in the browser, once per page.
 *
 * Why a script tag rather than `import('@rdkit/rdkit')`: the package's entry
 * point is an Emscripten UMD bundle carrying a Node branch that calls
 * `require('fs')`. Bundling it fails outright —
 *
 *   Module not found: Can't resolve 'fs'
 *   ./node_modules/@rdkit/rdkit/dist/RDKit_minimal.js
 *
 * — and the usual fix (a `resolve.fallback`/alias in `next.config.ts`) is out
 * of reach here, and would pull 125 KB of glue into a bundled chunk anyway.
 * Loading the file as a classic script is the path RDKit.js documents for
 * browsers: the UMD wrapper finds no CommonJS or AMD environment, so it
 * publishes `window.initRDKitModule`, and the Node branch is simply never
 * taken. `@rdkit/rdkit`'s own types declare that global.
 *
 * Both URLs come from `new URL(specifier, import.meta.url)`, the asset
 * reference form the bundler rewrites at build time: the two files are emitted
 * as static assets and referenced by their hashed URLs, so neither is parsed
 * as a module and neither ends up in any JavaScript chunk. That is what keeps
 * the 6.6 MB WASM payload off every other page in the app.
 *
 * The promise is memoised at module scope, so a page with more than one
 * structure — or a component that remounts — downloads and instantiates once.
 * A rejected load is *not* cached: a failure here is usually a dropped
 * connection, and a later mount deserves a fresh attempt.
 */

const GLUE_URL = new URL('@rdkit/rdkit/dist/RDKit_minimal.js', import.meta.url)
  .href

const WASM_URL = new URL(
  '@rdkit/rdkit/dist/RDKit_minimal.wasm',
  import.meta.url
).href

const SCRIPT_ID = 'rdkit-minimal-loader'

let pending: Promise<RDKitModule> | null = null

function loadGlue(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.initRDKitModule === 'function') {
      resolve()
      return
    }

    const existing = document.getElementById(SCRIPT_ID)
    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : document.createElement('script')

    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('RDKit.js failed to load')),
      { once: true }
    )

    if (existing === null) {
      script.id = SCRIPT_ID
      script.src = GLUE_URL
      script.async = true
      document.head.append(script)
    }
  })
}

export async function loadRDKit(): Promise<RDKitModule> {
  pending ??= (async () => {
    await loadGlue()
    const init = window.initRDKitModule
    if (typeof init !== 'function') {
      throw new Error('RDKit.js loaded but exposed no initialiser')
    }
    return init({ locateFile: () => WASM_URL })
  })().catch((error: unknown) => {
    pending = null
    throw error
  })

  return pending
}
