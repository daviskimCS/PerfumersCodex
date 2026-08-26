# Quality Checklist

The "boring quality" work that separates a portfolio project from a real one. ~25-30% of total project hours go here. It's correct.

This is a checklist, not a milestone. Apply continuously. Audit explicitly during polish weeks (15 and 21).

## Per-page checklist

For every public page (search, material detail, family page, account, etc.):

- [ ] Empty state designed and implemented (not blank)
- [ ] Loading state matches final layout (skeleton, no visual jump)
- [ ] Error state with helpful messaging (what happened, what to do)
- [ ] Mobile layout intentional (not just "doesn't break")
- [ ] Keyboard navigable (Tab, Enter, Escape, arrow keys where applicable)
- [ ] Focus indicators visible and consistent
- [ ] ARIA labels on icon-only buttons
- [ ] Color contrast passes WCAG AA (Chrome DevTools audit)
- [ ] Page metadata: title, description, Open Graph tags
- [ ] Lighthouse score >90 (Performance, Accessibility, Best Practices, SEO)
- [ ] Renders correctly in Safari (where things break)

## Per-form checklist

For every form (search, signup, login, settings, notes):

- [ ] Inline validation messages (not "fields contain errors")
- [ ] Errors appear after blur, not on every keystroke
- [ ] Submit button shows loading state when active
- [ ] Disabled state for invalid forms
- [ ] Server-side validation matches client-side (defense in depth)
- [ ] Confirmation for destructive actions (delete account, etc.)
- [ ] Success feedback after submission (toast, page change, etc.)

## Per-database-table checklist

For every table:

- [ ] Primary key defined
- [ ] Foreign keys with appropriate ON DELETE behavior
- [ ] NOT NULL constraints on every column that should never be null
- [ ] CHECK constraints on bounded values (percentages 0-100, etc.)
- [ ] Indexes on columns used in WHERE / JOIN / ORDER BY
- [ ] If user-owned: Row-Level Security policies tested with multiple accounts
- [ ] Migrations are reversible where reasonable
- [ ] No ad-hoc DB edits — all changes via Drizzle migrations

## Per-API-route checklist

For every route handler:

- [ ] Authentication checked (or explicitly public)
- [ ] Authorization checked for protected resources
- [ ] Input validated (Zod schema or equivalent)
- [ ] Errors return appropriate status codes (4xx for client, 5xx for server)
- [ ] No secrets logged
- [ ] Rate limited if exposed publicly (signup, login, search)
- [ ] Structured logging on error paths

## Per-component checklist

For every component:

- [ ] Props typed strictly (no `any`)
- [ ] Default state handled (no broken renders on missing props)
- [ ] Re-renders minimized where it matters
- [ ] Animation/transition feels intentional, not generic

## Repository checklist

- [ ] README has: project description, screenshot, live URL, setup instructions, architecture overview
- [ ] LICENSE file (MIT)
- [ ] LICENSE-DATA file (CC-BY-SA)
- [ ] CONTRIBUTING.md (even if minimal — sets expectations)
- [ ] Issue templates (bug, feature request, data correction)
- [ ] PR template
- [ ] CI passes on main
- [ ] No secrets in commit history (verify with `git log -p` or a tool)
- [ ] `.env.example` documents required env vars
- [ ] Branch protection on main (require PR, require CI pass)

## Pre-launch security checklist

Before opening signup to the public:

- [ ] All RLS policies verified with multi-account tests
- [ ] Rate limiting on signup, login, search
- [ ] CSP headers configured
- [ ] No client-side secrets (verify production bundle)
- [ ] Auth flow handles edge cases (expired tokens, deleted users, etc.)
- [ ] Session timeout reasonable
- [ ] Password reset flow works end-to-end
- [ ] Account deletion truly deletes data
- [ ] Privacy policy live, accurate, accessible
- [ ] Terms of service live and accessible
- [ ] Sentry catches and reports errors
- [ ] Analytics anonymizes IPs (or doesn't collect them)

## Pre-launch product checklist

- [ ] Homepage compelling for first-time visitor
- [ ] Onboarding for new users (3 screens max)
- [ ] About page tells the story honestly
- [ ] All material data citations present and links work
- [ ] Open Graph image looks good when shared
- [ ] Favicon present and correct in all common sizes
- [ ] 404 page handled gracefully
- [ ] Empty search returns useful "try these instead" content
- [ ] Mobile responsive verified on real iPhone and real Android phone
- [ ] All hover states work, all focus states work
- [ ] Light + dark mode both look polished
- [ ] Demo video recorded and embedded somewhere
- [ ] Launch blog post drafted, reviewed, and ready to publish

## How to use this checklist

- During phase work: keep it visible, check items as you go
- During polish weeks (15 and 21): explicit walkthrough, page by page
- Pre-launch (Week 21–22): full checklist run; nothing in production until everything's checked

## What this checklist enforces

The difference between projects that read as real, finished products and ones that don't.
