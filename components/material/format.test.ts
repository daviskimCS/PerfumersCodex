import { describe, expect, it } from 'vitest'

import type { SourceType, SynonymType } from '@/lib/types'

import {
  SOURCE_TYPE_LABELS,
  SYNONYM_TYPE_LABELS,
  humanize,
  sourceTypeLabel,
  synonymTypeLabel,
} from './format'

/**
 * The maps are typed `Record<Enum, string>`, so the compiler already refuses a
 * missing member. These tests make that guarantee observable at runtime too —
 * an empty string or a raw key would satisfy the type and still lie on the page.
 */
const SYNONYM_TYPES: SynonymType[] = [
  'trade_name',
  'iupac',
  'common_name',
  'abbreviation',
  'supplier_name',
]

const SOURCE_TYPES: SourceType[] = [
  'ifra',
  'sds',
  'pubchem',
  'gsc',
  'perfumer_blog',
  'book',
  'interview',
  'other',
]

describe('synonymTypeLabel', () => {
  it.each(SYNONYM_TYPES)('labels %s with non-empty prose', (type) => {
    const label = synonymTypeLabel(type)
    expect(label).toBe(SYNONYM_TYPE_LABELS[type])
    expect(label.trim()).not.toBe('')
    expect(label).not.toContain('_')
  })

  it('covers every synonym type and nothing else', () => {
    expect(Object.keys(SYNONYM_TYPE_LABELS).sort()).toEqual(
      [...SYNONYM_TYPES].sort(),
    )
  })

  it('renders the acronym as an acronym', () => {
    expect(synonymTypeLabel('iupac')).toBe('IUPAC')
  })
})

describe('sourceTypeLabel', () => {
  it.each(SOURCE_TYPES)('labels %s with non-empty prose', (type) => {
    const label = sourceTypeLabel(type)
    expect(label).toBe(SOURCE_TYPE_LABELS[type])
    expect(label.trim()).not.toBe('')
    expect(label).not.toContain('_')
  })

  it('covers every source type and nothing else', () => {
    expect(Object.keys(SOURCE_TYPE_LABELS).sort()).toEqual(
      [...SOURCE_TYPES].sort(),
    )
  })

  it('spells out the abbreviations a perfumer would not recognise', () => {
    expect(sourceTypeLabel('gsc')).toBe('The Good Scents Company')
    expect(sourceTypeLabel('ifra')).toBe('IFRA Standard')
  })
})

describe('humanize', () => {
  it('still only replaces underscores (material_type labels depend on it)', () => {
    expect(humanize('synthetic')).toBe('synthetic')
    expect(humanize('very_high')).toBe('very high')
  })
})
