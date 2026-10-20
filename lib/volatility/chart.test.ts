import { describe, expect, it } from 'vitest'

import { niceTicks, placeLabels, scale } from '@/lib/volatility/chart'

describe('niceTicks', () => {
  it('frames the data in whole steps of 1, 2 or 5 × 10^k', () => {
    // The eight structures in the corpus today span 140–278 g/mol.
    const ticks = niceTicks(140.22, 278.4, 7, 40)
    expect(ticks.min).toBeLessThanOrEqual(140.22)
    expect(ticks.max).toBeGreaterThanOrEqual(278.4)
    expect(ticks.values).toEqual([
      120, 140, 160, 180, 200, 220, 240, 260, 280, 300,
    ])
  })

  it('widens a single point to the minimum span instead of a zero-width axis', () => {
    const ticks = niceTicks(4.5183, 4.5183, 6, 2)
    expect(ticks.max - ticks.min).toBeGreaterThanOrEqual(2)
    expect(ticks.values.length).toBeGreaterThan(2)
  })

  it('prints decimal steps without floating-point drift', () => {
    const ticks = niceTicks(1.6, 2.2, 6, 0.5)
    for (const value of ticks.values) {
      expect(String(value)).toMatch(/^-?\d+(\.\d{1,2})?$/)
    }
  })
})

describe('scale', () => {
  it('maps the domain ends onto the range ends, including a reversed y range', () => {
    expect(scale(0, [0, 10], [400, 0])).toBe(400)
    expect(scale(10, [0, 10], [400, 0])).toBe(0)
    expect(scale(5, [0, 10], [400, 0])).toBe(200)
  })
})

describe('placeLabels', () => {
  const bounds = { x0: 0, y0: 0, x1: 500, y1: 300 }

  it('puts a lone label to the right of its dot', () => {
    const [label] = placeLabels(
      [{ x: 100, y: 100, r: 5, text: 'Coumarin' }],
      12,
      bounds
    )
    expect(label).toMatchObject({ anchor: 'start', visible: true })
    expect(label!.x).toBeGreaterThan(105)
  })

  it('flips left at the right edge rather than running off the plot', () => {
    const [label] = placeLabels(
      [{ x: 490, y: 100, r: 5, text: 'Civetone' }],
      12,
      bounds
    )
    expect(label).toMatchObject({ anchor: 'end', visible: true })
  })

  it('gives the first point priority and moves a colliding neighbour', () => {
    const [first, second] = placeLabels(
      [
        { x: 100, y: 100, r: 5, text: 'Iso E Super' },
        { x: 104, y: 102, r: 5, text: 'Javanol' },
      ],
      12,
      bounds
    )
    expect(first).toMatchObject({ anchor: 'start', visible: true })
    expect(second!.anchor).not.toBe('start')
  })

  it('hides a label that fits nowhere instead of overlapping', () => {
    // A tight cluster: five dots on top of each other cannot all be labelled.
    const cluster = Array.from({ length: 5 }, (_, index) => ({
      x: 250,
      y: 150 + index,
      r: 5,
      text: `Material ${index}`,
    }))
    const placed = placeLabels(cluster, 12, bounds)
    expect(placed[0]!.visible).toBe(true)
    expect(placed.some((label) => !label.visible)).toBe(true)
  })
})
