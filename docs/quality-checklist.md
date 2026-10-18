# Quality checklist

The "boring quality" bar every surface is held to. It is a bar, not a record:
the boxes stay unticked, and each audit records its findings in its pull
request.

## Every page

- [ ] Empty state designed (shared `components/empty-state.tsx`, never blank)
- [ ] Loading skeleton matches the final layout
- [ ] Error state says what happened and offers a retry
- [ ] Mobile layout intentional, checked on a real phone
- [ ] Keyboard navigable, with visible, consistent focus indicators
- [ ] ARIA labels on icon-only buttons; WCAG AA contrast in both themes
- [ ] Title, description and Open Graph metadata
- [ ] Lighthouse > 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] Renders correctly in Safari

## Every form

- [ ] Inline, field-level messages, shown after blur, announced to screen readers
- [ ] Submit button shows a pending state
- [ ] Server re-validates with the same Zod schema
- [ ] Destructive actions confirm first
- [ ] Success feedback after submission

## Every table

- [ ] Primary key; foreign keys with deliberate `ON DELETE`
- [ ] `NOT NULL` and `CHECK` wherever they hold
- [ ] Indexes on the columns used to filter, join and sort
- [ ] RLS enabled; user tables tested with two accounts
- [ ] Changed only through a migration

## Every route handler and server action

- [ ] Authentication and authorization checked, or explicitly public
- [ ] Input parsed with Zod
- [ ] Correct status codes; no secrets in logs
- [ ] Rate limited if public (sign-up, sign-in, search)

## Before public sign-up

- [ ] Rate limiting on sign-up, sign-in and search
- [ ] A custom SMTP sender (the built-in one reaches only the project team)
- [ ] Password reset and account deletion verified end to end
- [ ] No secrets in the client bundle
- [ ] Privacy policy and terms final, not drafts
- [ ] Error monitoring catches and reports errors

## Before launch

- [ ] Every published page's citations resolve
- [ ] Open Graph cards and favicon look right when shared
- [ ] Light and dark themes both polished
- [ ] Any model output labelled experimental, with its model version
- [ ] Repository: README with screenshot and live URL, CI green on `main`,
      branch protection, no secrets in history
