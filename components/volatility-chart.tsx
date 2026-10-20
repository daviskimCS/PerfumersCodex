import type { VolatilityPoint } from '@/lib/db/volatility'
import { cn } from '@/lib/utils'
import { niceTicks, placeLabels, scale } from '@/lib/volatility/chart'

/**
 * The volatility map's scatter plot: molecular weight across, computed logP
 * up. Server-rendered SVG, no chart library and no script.
 *
 * Two layouts are rendered and CSS shows one: a wide one for tablets and up,
 * and a narrow one drawn at phone size so its text is not scaled down to
 * nothing. Only one is ever displayed, so assistive tech meets one.
 *
 * Accessibility: each SVG is one labelled image (`role="img"`, `<title>`,
 * `<desc>`). The dots are links for pointer users, kept out of the tab order
 * and the accessibility tree because the table under the chart carries the
 * same links in reading order — a keyboard user should not tab through every
 * dot to reach it. Identity never rests on colour: the highlighted material
 * also gets a ring and a bold label.
 */

interface Layout {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
  xTicks: number
  yTicks: number
  tickFont: number
  labelFont: number
  hint: { left: string; right: string }
}

const WIDE: Layout = {
  width: 760,
  height: 460,
  margin: { top: 16, right: 24, bottom: 72, left: 60 },
  xTicks: 7,
  yTicks: 6,
  tickFont: 12,
  labelFont: 13,
  hint: {
    left: '← lighter: tends to lift sooner',
    right: 'heavier: tends to linger →',
  },
}

const NARROW: Layout = {
  width: 340,
  height: 400,
  margin: { top: 12, right: 12, bottom: 68, left: 44 },
  xTicks: 4,
  yTicks: 5,
  tickFont: 11,
  labelFont: 12,
  hint: { left: '← lifts sooner', right: 'lingers →' },
}

const DOT_R = 4.5
const HIGHLIGHT_R = 6
const HIGHLIGHT_RING_R = 10

export function VolatilityChart({
  points,
  highlight,
}: {
  points: VolatilityPoint[]
  /** The slug to emphasise, already known to be among `points`, or null. */
  highlight: string | null
}) {
  return (
    <>
      <ScatterSvg
        layout={WIDE}
        idPrefix="volatility-wide"
        points={points}
        highlight={highlight}
        className="hidden sm:block"
      />
      <ScatterSvg
        layout={NARROW}
        idPrefix="volatility-narrow"
        points={points}
        highlight={highlight}
        className="sm:hidden"
      />
    </>
  )
}

function formatTick(value: number): string {
  // Ticks are whole steps of 1, 2 or 5 × 10^k; trimming trailing zeros keeps
  // "2.5" and "150" honest without a locale formatter.
  return String(Number(value.toFixed(2)))
}

function ScatterSvg({
  layout,
  idPrefix,
  points,
  highlight,
  className,
}: {
  layout: Layout
  idPrefix: string
  points: VolatilityPoint[]
  highlight: string | null
  className?: string
}) {
  const { width, height, margin } = layout
  const plot = {
    x0: margin.left,
    x1: width - margin.right,
    y0: margin.top,
    y1: height - margin.bottom,
  }

  const weights = points.map((point) => point.molecularWeight)
  const logps = points.map((point) => point.logp)
  const x = niceTicks(
    Math.min(...weights),
    Math.max(...weights),
    layout.xTicks,
    40
  )
  const y = niceTicks(Math.min(...logps), Math.max(...logps), layout.yTicks, 2)

  const toX = (value: number) =>
    scale(value, [x.min, x.max], [plot.x0, plot.x1])
  const toY = (value: number) =>
    scale(value, [y.min, y.max], [plot.y1, plot.y0])

  // Highlighted material first so it wins its label spot; it is also drawn
  // last so it sits on top of any neighbour.
  const ordered = [...points].sort(
    (a, b) => Number(b.slug === highlight) - Number(a.slug === highlight)
  )
  const placed = placeLabels(
    ordered.map((point) => ({
      x: toX(point.molecularWeight),
      y: toY(point.logp),
      r: point.slug === highlight ? HIGHLIGHT_RING_R : DOT_R + 2,
      text: point.canonicalName,
    })),
    layout.labelFont,
    plot
  )
  const marks = ordered
    .map((point, index) => ({ point, label: placed[index]! }))
    .reverse()

  const titleId = `${idPrefix}-title`
  const descId = `${idPrefix}-desc`
  const highlighted = points.find((point) => point.slug === highlight)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className={cn('h-auto w-full overflow-visible', className)}
      style={{ maxWidth: width }}
    >
      <title id={titleId}>
        Molecular weight against computed logP for {points.length} published{' '}
        {points.length === 1 ? 'material' : 'materials'}
      </title>
      <desc id={descId}>
        Scatter plot. Molecular weight in grams per mole runs from{' '}
        {formatTick(x.min)} to {formatTick(x.max)} across; computed logP runs
        from {formatTick(y.min)} to {formatTick(y.max)} up.
        {highlighted === undefined
          ? null
          : ` ${highlighted.canonicalName} is highlighted at ${highlighted.molecularWeight} g/mol, logP ${highlighted.logp}.`}{' '}
        The table after the chart lists every point.
      </desc>

      {/* Grid: hairline, solid, recessive. */}
      <g className="stroke-border" strokeWidth={1} shapeRendering="crispEdges">
        {y.values.map((value) => (
          <line
            key={`y${value}`}
            x1={plot.x0}
            x2={plot.x1}
            y1={toY(value)}
            y2={toY(value)}
          />
        ))}
        {x.values.map((value) => (
          <line
            key={`x${value}`}
            x1={toX(value)}
            x2={toX(value)}
            y1={plot.y0}
            y2={plot.y1}
          />
        ))}
      </g>

      {/* Tick labels and axis titles wear text tokens, never a data colour. */}
      <g className="fill-muted-foreground" fontSize={layout.tickFont}>
        {y.values.map((value) => (
          <text
            key={`yl${value}`}
            x={plot.x0 - 8}
            y={toY(value)}
            textAnchor="end"
            dominantBaseline="middle"
            className="tabular-nums"
          >
            {formatTick(value)}
          </text>
        ))}
        {x.values.map((value) => (
          <text
            key={`xl${value}`}
            x={toX(value)}
            y={plot.y1 + layout.tickFont + 6}
            textAnchor="middle"
            className="tabular-nums"
          >
            {formatTick(value)}
          </text>
        ))}
        <text
          x={(plot.x0 + plot.x1) / 2}
          y={plot.y1 + layout.tickFont * 2 + 16}
          textAnchor="middle"
          className="fill-foreground"
        >
          Molecular weight (g/mol)
        </text>
        <text x={plot.x0} y={height - 4} textAnchor="start">
          {layout.hint.left}
        </text>
        <text x={plot.x1} y={height - 4} textAnchor="end">
          {layout.hint.right}
        </text>
        <text
          transform={`translate(${layout.tickFont + 2} ${(plot.y0 + plot.y1) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-foreground"
        >
          logP (computed)
        </text>
      </g>

      {/* Points. Each is a link for pointer users; see the note above. */}
      {marks.map(({ point, label }) => {
        const cx = toX(point.molecularWeight)
        const cy = toY(point.logp)
        const isHighlight = point.slug === highlight
        return (
          <a
            key={point.slug}
            href={`/materials/${point.slug}`}
            tabIndex={-1}
            aria-hidden="true"
            className="group"
          >
            <title>
              {`${point.canonicalName}: ${point.molecularWeight} g/mol, logP ${point.logp}`}
            </title>
            {/* Hit target larger than the mark. */}
            <circle cx={cx} cy={cy} r={12} className="fill-transparent" />
            {isHighlight ? (
              <circle
                cx={cx}
                cy={cy}
                r={HIGHLIGHT_RING_R}
                className="fill-none stroke-brand"
                strokeWidth={1.5}
              />
            ) : null}
            <circle
              cx={cx}
              cy={cy}
              r={isHighlight ? HIGHLIGHT_R : DOT_R}
              className={cn(
                'stroke-background group-hover:stroke-foreground',
                isHighlight ? 'fill-brand' : 'fill-muted-foreground'
              )}
              strokeWidth={2}
            />
            <text
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fontSize={layout.labelFont}
              fontWeight={isHighlight ? 600 : undefined}
              // A halo in the surface colour keeps a label legible where it
              // crosses a gridline or, on hover, another point.
              strokeWidth={4}
              strokeLinejoin="round"
              className={cn(
                'fill-foreground stroke-background [paint-order:stroke]',
                label.visible
                  ? null
                  : 'opacity-0 transition-opacity group-hover:opacity-100'
              )}
            >
              {point.canonicalName}
            </text>
          </a>
        )
      })}
    </svg>
  )
}
