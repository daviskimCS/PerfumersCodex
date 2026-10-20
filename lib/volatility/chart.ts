/**
 * Geometry for the volatility map (`components/volatility-chart.tsx`): axis
 * ticks, scales and label placement. Pure and database-free, so the layout
 * rules are tested without rendering.
 *
 * The site sets every face in JetBrains Mono (globals.css), so a label's
 * width is its character count times 0.6 em. That is what lets the server
 * place labels without measuring text in a browser.
 */

export interface Ticks {
  min: number
  max: number
  values: number[]
}

/**
 * "Nice" ticks: the step of 1, 2 or 5 times a power of ten nearest to an
 * even split into `target` parts, with the domain widened to whole steps so
 * the outermost gridlines frame the data.
 * `minSpan` stops a corpus of one or two close points from zooming in until
 * a hair's difference fills the plot.
 */
export function niceTicks(
  dataMin: number,
  dataMax: number,
  target: number,
  minSpan: number
): Ticks {
  let low = Math.min(dataMin, dataMax)
  let high = Math.max(dataMin, dataMax)
  if (high - low < minSpan) {
    const middle = (low + high) / 2
    low = middle - minSpan / 2
    high = middle + minSpan / 2
  }
  // A little air so no point sits on the frame.
  const pad = (high - low) * 0.06
  low -= pad
  high += pad

  const rough = (high - low) / Math.max(target, 1)
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const step =
    (fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10) * power

  const min = Math.floor(low / step) * step
  const max = Math.ceil(high / step) * step
  const values: number[] = []
  // Integer counting avoids 0.1 + 0.2 drift in the labels.
  const count = Math.round((max - min) / step)
  for (let index = 0; index <= count; index += 1) {
    values.push(Number((min + index * step).toFixed(10)))
  }
  return { min, max, values }
}

/** Maps a domain value onto a pixel range. `range` may run backwards (y). */
export function scale(
  value: number,
  domain: readonly [number, number],
  range: readonly [number, number]
): number {
  const [d0, d1] = domain
  const [r0, r1] = range
  if (d1 === d0) return (r0 + r1) / 2
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0)
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
}

export interface LabelInput {
  /** Point centre, in pixels. */
  x: number
  y: number
  /** Dot radius, so a label never sits on its own mark. */
  r: number
  text: string
}

export interface PlacedLabel {
  x: number
  /** Baseline. */
  y: number
  anchor: 'start' | 'middle' | 'end'
  /** False when every position collided: the label shows on hover only. */
  visible: boolean
}

/**
 * Greedy placement in input order, so the caller decides priority (the
 * highlighted material first). Each label tries right, left, above and
 * below its dot, then above and below flush to either side, and takes the
 * first spot that stays inside `bounds` and clears every dot and every label
 * already placed. One that fits nowhere keeps the right-hand position but is
 * marked not visible: the chart shows it only on hover, and the table under
 * the chart names every point anyway.
 */
export function placeLabels(
  points: readonly LabelInput[],
  fontSize: number,
  bounds: Box
): PlacedLabel[] {
  const charWidth = fontSize * 0.6
  const gap = 4
  // Cap height and descender, near enough for a monospaced face.
  const ascent = fontSize * 0.75
  const descent = fontSize * 0.25

  const dots: Box[] = points.map((point) => ({
    x0: point.x - point.r,
    y0: point.y - point.r,
    x1: point.x + point.r,
    y1: point.y + point.r,
  }))
  const taken: Box[] = []

  return points.map((point, index) => {
    const width = point.text.length * charWidth
    const candidates: Array<PlacedLabel & { box: Box }> = [
      {
        x: point.x + point.r + gap,
        y: point.y + ascent / 2,
        anchor: 'start',
        visible: true,
        box: {
          x0: point.x + point.r + gap,
          y0: point.y - ascent / 2,
          x1: point.x + point.r + gap + width,
          y1: point.y + ascent / 2 + descent,
        },
      },
      {
        x: point.x - point.r - gap,
        y: point.y + ascent / 2,
        anchor: 'end',
        visible: true,
        box: {
          x0: point.x - point.r - gap - width,
          y0: point.y - ascent / 2,
          x1: point.x - point.r - gap,
          y1: point.y + ascent / 2 + descent,
        },
      },
      {
        x: point.x,
        y: point.y - point.r - gap - descent,
        anchor: 'middle',
        visible: true,
        box: {
          x0: point.x - width / 2,
          y0: point.y - point.r - gap - descent - ascent,
          x1: point.x + width / 2,
          y1: point.y - point.r - gap,
        },
      },
      {
        x: point.x,
        y: point.y + point.r + gap + ascent,
        anchor: 'middle',
        visible: true,
        box: {
          x0: point.x - width / 2,
          y0: point.y + point.r + gap,
          x1: point.x + width / 2,
          y1: point.y + point.r + gap + ascent + descent,
        },
      },
      // Above and below again, flush to one side of the dot instead of
      // centred: what lets a point near the plot's edge keep its label.
      ...(['above', 'below'] as const).flatMap((side) => {
        const baseline =
          side === 'above'
            ? point.y - point.r - gap - descent
            : point.y + point.r + gap + ascent
        const y0 = baseline - ascent
        const y1 = baseline + descent
        return [
          {
            x: point.x + point.r,
            y: baseline,
            anchor: 'end' as const,
            visible: true,
            box: {
              x0: point.x + point.r - width,
              y0,
              x1: point.x + point.r,
              y1,
            },
          },
          {
            x: point.x - point.r,
            y: baseline,
            anchor: 'start' as const,
            visible: true,
            box: {
              x0: point.x - point.r,
              y0,
              x1: point.x - point.r + width,
              y1,
            },
          },
        ]
      }),
    ]

    const fits = candidates.find(
      (candidate) =>
        candidate.box.x0 >= bounds.x0 &&
        candidate.box.x1 <= bounds.x1 &&
        candidate.box.y0 >= bounds.y0 &&
        candidate.box.y1 <= bounds.y1 &&
        !taken.some((box) => overlaps(box, candidate.box)) &&
        !dots.some(
          (dot, other) => other !== index && overlaps(dot, candidate.box)
        )
    )
    if (fits !== undefined) {
      taken.push(fits.box)
      return { x: fits.x, y: fits.y, anchor: fits.anchor, visible: true }
    }

    // Hover-only. Keep it inside the frame: flip left when it would run off.
    const right = candidates[0]!
    const left = candidates[1]!
    const fallback = right.box.x1 <= bounds.x1 ? right : left
    return {
      x: fallback.x,
      y: fallback.y,
      anchor: fallback.anchor,
      visible: false,
    }
  })
}
