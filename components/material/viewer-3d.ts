import {
  createViewer,
  elementColors,
  type GLViewer,
} from '3dmol/build/3Dmol-min.js'

/**
 * The 3Dmol.js half of "View in 3D". `structure-3d.tsx` imports this module
 * only when a reader presses the button, so 3Dmol.js (about 157 KB gzipped)
 * is a separate chunk that a reader who never presses it never downloads.
 *
 * CSP (lib/csp.ts): 3Dmol.js calls `eval` only when handed a callback as a
 * string, and starts a `blob:` worker only to compute molecular surfaces.
 * This module does neither, so the page's strict script policy holds.
 */

/**
 * Element colours per theme, over 3Dmol's Jmol defaults for anything else.
 * Carbon follows the page's ink; the rest keep their usual hues, tuned to
 * read on the plate in each theme.
 */
const PALETTES = {
  light: {
    C: '#3d3833',
    H: '#d6d1cb',
    O: '#d23a2f',
    N: '#2f62c9',
    S: '#c9a227',
    Cl: '#2e9e4a',
    Br: '#9a3b26',
  },
  dark: {
    C: '#a59d94',
    H: '#f4f1ed',
    O: '#ff7262',
    N: '#7ea4ff',
    S: '#f0cf4a',
    Cl: '#5fd07a',
    Br: '#e0805f',
  },
} as const

export type Theme = keyof typeof PALETTES

export interface MoleculeViewer {
  /** Back to the orientation and zoom it opened with. */
  reset(): void
  setTheme(theme: Theme): void
  /** Call after the container changes size or becomes visible again. */
  resize(): void
  /** Arrow keys rotate, + and − zoom. Returns true when the key was used. */
  handleKey(key: string): boolean
  destroy(): void
}

const KEY_ROTATION_DEGREES = 15

export function mountViewer(
  container: HTMLElement,
  molfile: string,
  theme: Theme
): MoleculeViewer {
  const viewer: GLViewer = createViewer(container, {
    backgroundColor: 'white',
    backgroundAlpha: 0,
    antialias: true,
  })
  viewer.addModel(molfile, 'sdf', { keepH: true })
  applyTheme(viewer, theme)
  // The seed stored the molecule broadside (longest axis along x), so the
  // default camera already shows its widest face.
  viewer.zoomTo()
  viewer.render()
  const initialView = viewer.getView()

  return {
    reset() {
      viewer.setView(initialView)
      viewer.render()
    },
    setTheme(next) {
      applyTheme(viewer, next)
      viewer.render()
    },
    resize() {
      viewer.resize()
      viewer.render()
    },
    handleKey(key) {
      switch (key) {
        case 'ArrowLeft':
          viewer.rotate(-KEY_ROTATION_DEGREES, 'y')
          break
        case 'ArrowRight':
          viewer.rotate(KEY_ROTATION_DEGREES, 'y')
          break
        case 'ArrowUp':
          viewer.rotate(-KEY_ROTATION_DEGREES, 'x')
          break
        case 'ArrowDown':
          viewer.rotate(KEY_ROTATION_DEGREES, 'x')
          break
        case '+':
        case '=':
          viewer.zoom(1.15)
          break
        case '-':
        case '_':
          viewer.zoom(1 / 1.15)
          break
        default:
          return false
      }
      viewer.render()
      return true
    },
    destroy() {
      viewer.clear()
      container.replaceChildren()
    },
  }
}

function applyTheme(viewer: GLViewer, theme: Theme): void {
  const colorscheme = {
    prop: 'elem',
    map: { ...elementColors.Jmol, ...PALETTES[theme] },
  }
  // Ball and stick.
  viewer.setStyle(
    {},
    {
      stick: { radius: 0.14, colorscheme },
      sphere: { scale: 0.24, colorscheme },
    }
  )
}
