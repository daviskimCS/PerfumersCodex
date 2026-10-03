import { describe, expect, it } from 'vitest'

import { adaptStructureSvg, isSafeStructureSvg } from './svg'

/** A trimmed copy of what RDKit 2025.03 emits for one bond and one label. */
const RAW = `<?xml version='1.0' encoding='iso-8859-1'?>
<svg version='1.1' baseProfile='full'
              xmlns='http://www.w3.org/2000/svg'
                      xmlns:rdkit='http://www.rdkit.org/xml'
                      xmlns:xlink='http://www.w3.org/1999/xlink'
                  xml:space='preserve'
width='640px' height='480px' viewBox='0 0 640 480'>
<!-- END OF HEADER -->
<rect style='opacity:1.0;fill:#00000000;stroke:none' width='640.0' height='480.0' x='0.0' y='0.0'> </rect>
<path class='bond-0 atom-0 atom-1' d='M 143.9,350.5 L 235.2,293.7' style='fill:none;stroke:#000000;stroke-width:1.4px' />
<path class='atom-2' d='M 300,100 L 310,110' fill='#FF0000' />
</svg>
`

describe('adaptStructureSvg', () => {
  const adapted = adaptStructureSvg(RAW)

  it('starts at the <svg> root: no prolog, no comments', () => {
    expect(adapted).not.toBeNull()
    expect(adapted!.startsWith('<svg ')).toBe(true)
    expect(adapted).not.toContain('<?xml')
    expect(adapted).not.toContain('<!--')
  })

  it('removes the transparent background rect instead of mangling its colour', () => {
    expect(adapted).not.toContain('<rect')
    expect(adapted).not.toMatch(/currentColor[0-9a-f]/i)
  })

  it('inks pure black with currentColor and keeps heteroatom colours', () => {
    expect(adapted).toContain('stroke:currentColor')
    expect(adapted).toContain("fill='#FF0000'")
  })

  it('drops the root size but keeps the viewBox, and only on the root', () => {
    const root = adapted!.slice(0, adapted!.indexOf('>'))
    expect(root).not.toMatch(/\swidth=|\sheight=/)
    expect(root).toContain("viewBox='0 0 640 480'")
  })

  it('returns null for input that is not an SVG', () => {
    expect(adaptStructureSvg('RDKit error')).toBeNull()
  })

  it('produces markup the safety check accepts', () => {
    expect(isSafeStructureSvg(adapted!)).toBe(true)
  })
})

describe('isSafeStructureSvg', () => {
  const ok = "<svg viewBox='0 0 1 1'><path d='M 0,0 L 1,1' /></svg>"

  it('accepts a plain drawing', () => {
    expect(isSafeStructureSvg(ok)).toBe(true)
  })

  it.each([
    [
      'a script element',
      "<svg viewBox='0 0 1 1'><script>alert(1)</script></svg>",
    ],
    ['an event handler', "<svg viewBox='0 0 1 1' onload='alert(1)'></svg>"],
    [
      'a double-quoted event handler',
      '<svg viewBox="0 0 1 1"><path d="M0" onclick="x()"/></svg>',
    ],
    [
      'a link',
      "<svg viewBox='0 0 1 1'><a href='javascript:x'><path d='M0'/></a></svg>",
    ],
    [
      'an xlink:href on an allowed element',
      "<svg><path xlink:href='#x' d='M0'/></svg>",
    ],
    ['foreignObject', '<svg><foreignObject><div></div></foreignObject></svg>'],
    [
      'a CSS url()',
      "<svg><path style='fill:url(https://example.com/t)' d='M0'/></svg>",
    ],
    ['an entity', "<svg><path d='M0' style='&#106;avascript'/></svg>"],
    ['a CDATA section', '<svg><![CDATA[<script>x()</script>]]></svg>'],
    ['an unquoted attribute', '<svg><path d=M0 onload=x() /></svg>'],
    ['text outside the root', `${ok}<img src=x onerror=alert(1)>`],
    ['two roots', `${ok}${ok}`],
    ['a stray angle bracket', "<svg><path d='M0'/>< script></svg>"],
    ['an empty string', ''],
  ])('rejects %s', (_label, svg) => {
    expect(isSafeStructureSvg(svg)).toBe(false)
  })
})
