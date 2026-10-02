import { describe, expect, it } from 'vitest'

import { parseReviewArgs, ReviewUsageError } from '@/lib/review/args'

/**
 * The first version of this CLI took `--revoke` as a flag, and
 * `npm run db:review --revoke civetone` (no `--`) reached the script as just
 * `civetone`, which PUBLISHED it. Every case below that is not a clean verb
 * must be a usage error, never a publish.
 */
describe('parseReviewArgs', () => {
  it.each([
    [['list'], { verb: 'list' }],
    [['refresh'], { verb: 'refresh' }],
    [['show', 'iso-e-super'], { verb: 'show', slug: 'iso-e-super' }],
    [['revoke', 'civetone'], { verb: 'revoke', slug: 'civetone' }],
    [
      ['publish', 'javanol', '0123456789abcdef'],
      { verb: 'publish', slug: 'javanol', fingerprint: '0123456789abcdef' },
    ],
  ])('parses %j', (argv, expected) => {
    expect(parseReviewArgs(argv)).toEqual(expected)
  })

  it.each([
    [['civetone'], 'a bare slug (what npm leaves after eating --revoke)'],
    [['publish', 'javanol'], 'publish without the fingerprint that was shown'],
    [['--revoke', 'civetone'], 'the old flag form'],
    [['revoke', '--', 'civetone'], 'a stray separator'],
    [['show'], 'show without a slug'],
    [['list', 'extra'], 'list with an argument'],
    [['revoke', 'a', 'b'], 'two slugs'],
    [[], 'nothing'],
  ])('refuses %j (%s)', (argv) => {
    expect(() => parseReviewArgs(argv)).toThrow(ReviewUsageError)
  })

  it('refuses when npm swallowed one of our flags', () => {
    expect(() =>
      parseReviewArgs(['civetone'], { npm_config_revoke: 'true' })
    ).toThrow(/npm consumed --revoke/)
  })
})
