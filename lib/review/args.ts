/**
 * Argument parsing for `npm run db:review` (scripts/review.ts).
 *
 * Verbs are POSITIONAL and required, never flags. npm swallows any `--flag`
 * typed without a separating `--`: `npm run db:review --revoke civetone`
 * reaches the script as just `civetone`. With a flag-based CLI that turned a
 * revoke into a publish. With positional verbs, a swallowed or stray flag can
 * only ever produce a usage error. Any argument starting with `-` is refused
 * for the same reason, and so is any `npm_config_*` variable npm sets when it
 * eats one of ours.
 */
export const REVIEW_USAGE = [
  'usage: npm run db:review list',
  '       npm run db:review show <slug>',
  '       npm run db:review publish <slug> <fingerprint>',
  '       npm run db:review revoke <slug>',
  '       npm run db:review refresh',
].join('\n')

export type ReviewCommand =
  | { verb: 'list' }
  | { verb: 'refresh' }
  | { verb: 'show'; slug: string }
  | { verb: 'publish'; slug: string; fingerprint: string }
  | { verb: 'revoke'; slug: string }

export class ReviewUsageError extends Error {}

/** npm config keys our own flags would land in if npm swallowed them. */
const SWALLOWED = ['revoke', 'list', 'publish', 'show', 'refresh']

export function parseReviewArgs(
  argv: string[],
  env: Record<string, string | undefined> = {}
): ReviewCommand {
  const swallowed = SWALLOWED.filter(
    (name) => env[`npm_config_${name}`] !== undefined
  )
  if (swallowed.length > 0) {
    throw new ReviewUsageError(
      `npm consumed --${swallowed.join(', --')}; nothing was changed. ` +
        `Use the verb form, without dashes.\n${REVIEW_USAGE}`
    )
  }
  const flag = argv.find((arg) => arg.startsWith('-'))
  if (flag !== undefined) {
    throw new ReviewUsageError(
      `"${flag}" is not accepted; verbs take no dashes.\n${REVIEW_USAGE}`
    )
  }

  const [verb, ...rest] = argv
  const expect = (count: number): void => {
    if (rest.length !== count) throw new ReviewUsageError(REVIEW_USAGE)
  }
  switch (verb) {
    case 'list':
    case 'refresh':
      expect(0)
      return { verb }
    case 'show':
    case 'revoke':
      expect(1)
      return { verb, slug: rest[0] }
    case 'publish':
      expect(2)
      return { verb, slug: rest[0], fingerprint: rest[1] }
    default:
      throw new ReviewUsageError(REVIEW_USAGE)
  }
}
