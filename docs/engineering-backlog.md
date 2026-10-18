# Engineering backlog

What the October 2026 external code review found and what is still open. The review read `main` before PRs #39 to #43, so every item was checked against the code after them; items already fixed or no longer true are listed at the end with the reason. Search findings (the prefix leg, a database-backed gold-set test, a server-side minimum query length, the explicit similarity threshold, search speed) are tracked by the search work, not here. Rate limiting is tracked in the launch checklist.

Ordered by impact, highest first. A change to what `MaterialDetail` holds or how it is hashed hides every published material until the maker publishes it again, so such changes are batched to cost one re-review.

## Open

1. **No script-src CSP.** `next.config.ts` skips it because a nonce makes pages render per request, but `next build` shows every HTML route is already dynamic, so the cost is near zero. The structure drawings are database SVG inlined with `dangerouslySetInnerHTML`; `lib/structure/svg.ts` is a careful allowlist, and a nonce CSP is the backstop for it. Include the Cloudflare Turnstile script origin that #44 added.
2. **Account deletion does not re-authenticate.** Changing a password asks for the current one; deleting the account asks only for the word DELETE, so a borrowed signed-in browser can delete the account. Require the current password where one exists, or a sign-in within the last few minutes for Google-only accounts.
3. **The review gate lives only in app code.** A `published_materials` view (or a stored generated `is_published` column) would put the predicate in one place for every future reader. It does **not** make "never Instant-Rollback past PR #20" unnecessary, as the review suggests: a deployment from before the gate reads `materials` with its own SQL and never sees the view, and the app connects as `postgres`, which no grant restrains. Only a dedicated read role for the app, allowed to read the view and not the table, would close that. Worth doing when a second reader (an admin page, an export) appears.
4. **The seed commits material by material.** A run that dies half-way leaves some materials changed and their stored fingerprints stale until the next run. Lists trust the stored `content_hash` while detail pages recompute it, so in that window a list can link to a published page that 404s (never to unreviewed content). Wrap the material writes and `refreshFingerprints` in one transaction, which means threading a transaction through `loadMaterialForReview`, and run `REFRESH MATERIALIZED VIEW CONCURRENTLY` after commit. Low impact at 18 materials; re-running the seed repairs it.
5. **`refreshFingerprints` is sequential, about fifteen queries per material.** Fine at 18; at a few hundred it makes every seed slow. Load each child table once for all materials instead.
6. **The browser half of signed-in flows is untested.** AGENTS.md bans E2E tests in v1 to keep the toolchain small, and that rule is now the largest verification gap (the bookmark button, `/saved`, Google sign-in). One smoke test (sign in, bookmark, reload, `/saved`) against the local Supabase stack CI already runs would close most of it. It needs a new dev dependency and a change to the rule, so it is the maker's call.
7. **Comments drift.** Several long explanatory comments went wrong as the code moved (the review found five; three survived to this pass and are fixed). Prefer a test for an invariant over a paragraph describing it, and keep history in commit messages.
8. **Cache material pages: not now.** The review suggested caching `getMaterialBySlug` (about fifteen queries and a SHA-256 per view). The design that keeps "never serve an unpublished page" is known: one cheap read of `(reviewed_hash, content_hash, deleted_at)` decides published or not, the heavy load is cached under `(slug, reviewed_hash)` and only filled when its fingerprint equals that hash, and the neighbour filter stays outside. It is not worth building yet. Functions run in `iad1` next to the database, the queries after the first run in parallel, so the load costs a few round trips of 1–2 ms each, and the cached version still needs two of them plus a cache fetch. Search measured about 170 ms per request with the database at about 10 ms (2026-10-18); the rest is distance and cold starts, which a data cache does not touch. Revisit with a `Server-Timing` measurement of a material page if it shows the database above about 30 ms.

## Fixed

In the IFRA category PR (migration 0012, fingerprint v2; one re-review):

- **IFRA categories are keyed by IFRA's own code** ("4", "5A", "10B", "12"). The old integer key, CHECKed to 1–11, held only each split category's strictest subcategory (Iso E Super's Category 5 showed 0.19 %, 5D, where a body lotion, 5A, may carry 5.1 %) and could not hold Category 12. `no_restriction` stores IFRA's printed "No Restriction".
- **The fingerprint no longer covers `similar`.** Renaming an unpublished draft, or seeding one into a published material's top neighbours, used to hide the published page. Unpublished neighbours are still dropped at render time.

In the PR that added this file:

- `next build` runs in CI. Typecheck and lint pass on code that fails to build, so a broken build was first seen on Vercel after merge.
- `updated_at` moves when a material's fingerprint changes, so a new IFRA row or hazard counts as an update for "recently updated", search tie-breaks and the sitemap.
- `db:review publish` is a compare-and-set on `content_hash`, so a seed that refreshes the hash mid-publish makes the publish refuse instead of writing a stale hash.
- Migration 0011: an index on `landmark_uses.material_id`, and one live non-natural material per CAS number (DATA-DECISIONS D6; naturals exempt because two extracts of one plant share a CAS).
- Comments in `lib/db/bookmarks.ts` and `lib/db/notes.ts` named `getUser()` where the code calls `getClaims()`.
- `shadcn` moved to devDependencies (it is a CLI plus a CSS file imported at build); `eslint-config-next` matches `next` 16.3.8.

## Already resolved, or not changing

- **Gate allowlist hole** (`/sitemap.xml`, `/robots.txt` bypassed the pre-launch gate): the gate was removed in #40, and the sitemap lists published materials only.
- **Unlock form throttling, gate key memoisation:** removed with the gate.
- **AGENTS.md listing Upstash Redis and forbidding Redis:** the stack no longer lists Upstash.
- **Overlapping docs** (CHECKLIST, five wave files): deleted in #39.
- **create-next-app SVGs in `public/`:** deleted in #42.
- **"The repo is still private":** it is public; AGENTS.md now says so.
- **Supabase project ref in `docs/maker-todo.md`:** kept. It is the public API host every browser already receives in `NEXT_PUBLIC_SUPABASE_URL`, and the Google step needs it verbatim. The home-directory path the review saw is already gone.
- **Empty `hooks/`:** kept; `components.json` points shadcn's generated hooks there.
