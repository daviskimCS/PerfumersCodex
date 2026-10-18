# Engineering backlog

What the October 2026 external code review found and what is still open. The review read `main` before PRs #39 to #43, so every item was checked against the code after them; items already fixed or no longer true are listed at the end with the reason. Search findings (the prefix leg, a database-backed gold-set test, a server-side minimum query length, the explicit similarity threshold, search speed) are tracked by the search work, not here. Rate limiting is tracked in the launch checklist.

Ordered by impact, highest first. "Re-review" means the item changes what `MaterialDetail` holds or how it is hashed, so every published material hides until the maker publishes it again; batch those items so the maker re-reviews once.

## Open

1. **IFRA categories cannot hold the Standards as published.** `usage_categories.id` is limited to 1–11 by a CHECK, but since the 49th Amendment IFRA publishes Categories 1–12 with 5A–5D, 7A/7B, 10A/10B and 11A/11B carrying different limits. The data stores the strictest subcategory (data repo DATA-DECISIONS D9, backlog S1), so Iso E Super's Category 5 shows 0.19 % (5D, baby products) where a body lotion (5A) may carry 5.1 %, and Category 12 is unstorable. Fix: key limits by IFRA's own code (`'5A'`, `'10B'`, `'12'`) or add a subcategory to the key; drop the 1–11 CHECK. Touches the data files, the validator, the seed, a migration and `lib/types.ts`. **Re-review.** Waiting on the maker's choice. Note that the category set is the QRA2 one (49th Amendment on); limits from older amendments used different category definitions and would need their own set.
2. **The fingerprint covers neighbours' names.** `loadMaterialForReview` hashes every live similar material by name and slug, so renaming an unpublished draft, or seeding a new draft into a published material's top neighbours, un-reviews the published page. Unpublished neighbours are already filtered at render time and a published neighbour's name is reviewed on its own page, so hashing `similar` by `(material id, tanimoto)` keeps the guarantee. **Re-review** (a new `FINGERPRINT_VERSION`); ship with item 1.
3. **Every material page reloads and re-hashes the whole material.** `getMaterialBySlug` runs about fifteen queries and a SHA-256 per view with no cache, and lists trust the stored `content_hash` instead, so after a seed that dies before its fingerprint refresh a list can link to a page that 404s. The plan that keeps the rule "never serve an unpublished page": one cheap read of `(reviewed_hash, content_hash, deleted_at)` per request decides published or not, then the heavy load is cached under the key `(slug, reviewed_hash)`. Publishing writes a new key and revoking clears the hash, so neither needs the review CLI to reach the Next cache. The neighbour filter stays outside the cache. This reverses the 2026-10-02 "no data cache" decision on its own terms (that decision rejected caches the CLI could not invalidate), so it ships as its own PR with that reasoning in the description.
4. **No script-src CSP.** `next.config.ts` skips it because a nonce makes pages render per request, but `next build` shows every HTML route is already dynamic, so the cost is near zero. The structure drawings are database SVG inlined with `dangerouslySetInnerHTML`; `lib/structure/svg.ts` is a careful allowlist, and a nonce CSP is the backstop for it. Do it after the sign-in protection PR (#44) lands, since that adds Cloudflare's script origin.
5. **Account deletion does not re-authenticate.** Changing a password asks for the current one; deleting the account asks only for the word DELETE, so a borrowed signed-in browser can delete the account. Require the current password where one exists, or a sign-in within the last few minutes for Google-only accounts. Queued behind #44, which owns the account actions.
6. **The review gate lives only in app code.** A `published_materials` view (or a stored generated `is_published` column) would put the predicate in one place for every future reader. It does **not** make "never Instant-Rollback past PR #20" unnecessary, as the review suggests: a deployment from before the gate reads `materials` with its own SQL and never sees the view, and the app connects as `postgres`, which no grant restrains. Only a dedicated read role for the app, allowed to read the view and not the table, would close that. Worth doing when a second reader (an admin page, an export) appears.
7. **The seed commits material by material.** A run that dies half-way leaves some materials changed and their stored fingerprints stale until the next run. Wrap the material writes and `refreshFingerprints` in one transaction and run `REFRESH MATERIALIZED VIEW CONCURRENTLY` after commit. Low impact at 18 materials; item 3 removes most of the visible harm.
8. **`refreshFingerprints` is sequential, about fifteen queries per material.** Fine at 18; at a few hundred it makes every seed slow. Load each child table once for all materials instead.
9. **The browser half of signed-in flows is untested.** AGENTS.md bans E2E tests in v1 to keep the toolchain small, and that rule is now the largest verification gap (the bookmark button, `/saved`, Google sign-in). One smoke test (sign in, bookmark, reload, `/saved`) against the local Supabase stack CI already runs would close most of it. It needs a new dev dependency and a change to the rule, so it is the maker's call.
10. **Comments drift.** Several long explanatory comments went wrong as the code moved (the review found five; three survived to this pass and are fixed). Prefer a test for an invariant over a paragraph describing it, and keep history in commit messages.

## Fixed in the PR that added this file

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
