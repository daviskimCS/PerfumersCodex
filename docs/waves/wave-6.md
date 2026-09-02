# Wave 6 — The personal layer closes

**Status: READY — dispatched 2026-09-02.** Orchestrator-owned; subagents read
it, only the orchestrator edits it. House rules, protocol and standing
constraints are [wave-3.md](./wave-3.md)'s, carried verbatim into every
prompt, plus wave-4's rate-limiting and caching deferral records, which
remain in force.

This wave finishes Phase 3. After it, every route in the v1 scope exists.

## Entry criteria

- [x] **Wave 5 committed and verified** _(2026-09-01)_ — browse, families,
      homepage and bookmarks are on the branch, suite green, verified against
      the seeded corpus.
- [x] **RLS is already in place** _(migration `0002_rls-deny-by-default`,
      applied 2026-08-30)_ — see the constraint below. This retires P3-B's
      migration deliverable exactly as it retired W5-B's.
- [x] **`components/material-card.tsx` and `lib/db/bookmarks.ts` exist**
      (W5-A/W5-B) — P3-B sits beside the save button in the same hero and
      follows the same Supabase-client discipline.
- [ ] **A real session for end-to-end verification** — the one thing still
      missing, and it is the maker's to supply. See the note under
      "After the wave".

## Wave shape

Two items, one subagent each, dispatched **concurrently**. File sets verified
disjoint: P3-B lives in the `/materials/[slug]` segment plus its own new
modules, P3-C entirely inside `app/account/`. Neither touches
`app/layout.tsx`, `components/site-*`, `db/**`, package manifests or CI.

| Item                    | Checklist ID | Exclusive files                                                                                                                                                                                                 | Proves it is done                                                              |
| ----------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| W6-A Private notes      | P3-B         | `lib/db/notes.ts`, `lib/validation/notes.ts`, `components/note-editor.tsx`, `app/materials/[slug]/actions.ts`, `app/materials/[slug]/page.tsx` (mount only), `app/materials/[slug]/loading.tsx` (skeleton only) | `npm run typecheck && npm run lint && npm run build` + orchestrator RLS probes |
| W6-B Account management | P3-C         | `app/account/page.tsx`, `app/account/actions.ts`, `app/account/loading.tsx`, `app/account/error.tsx`, `lib/validation/account.ts`, `components/account/**`                                                      | same + orchestrator cascade verification                                       |

**Deviation from the pacing note recorded in wave-5.md**, which said Wave 6
would run these sequentially. That was a preference, not a dependency: the
protocol permits a shared wave whenever file sets are disjoint, and these
are. Sequencing them would buy nothing but wall-clock.

`app/materials/[slug]/page.tsx` is contested only in the trivial sense — W6-A
mounts a note editor below the tabs the way W5-B mounted a save button in the
hero. W6-B does not touch that file at all.

## Wave-specific constraints (in addition to wave-3's standing set)

1. **No migrations. RLS already exists.** `0002_rls-deny-by-default` enables
   RLS on every table and creates owner policies on `user_notes` for
   SELECT / INSERT / UPDATE / DELETE, each `(select auth.uid()) = user_id`,
   with UPDATE carrying **both** `USING` and `WITH CHECK` so a row cannot be
   re-pointed at another user. P3-B's "RLS policies as a migration" is
   therefore already satisfied. An item that believes a policy is missing
   stops and reports rather than writing SQL.
2. **User data goes through the Supabase client, never Drizzle.** Drizzle
   connects as `postgres` and bypasses RLS entirely, so a single Drizzle call
   against `user_notes` would make every note readable by everyone while
   looking correct in review. `lib/db/notes.ts` must import no Drizzle client
   and no `db/schema.ts`, exactly as `lib/db/bookmarks.ts` does not.
3. **Account deletion is the most destructive action in the codebase.** It
   runs through the admin API with the secret key, in a server action, on the
   server only — the logged-in client cannot delete itself. It must
   re-verify the caller with `getUser()` immediately before deleting, delete
   only that id, and never accept a user id from the request. It requires an
   explicit confirmation step in the UI (typing an unambiguous confirmation,
   not a lone button). `ON DELETE CASCADE` on the user tables does the
   cleanup; the item does not hand-delete rows.
4. **Rate limiting is the Week 18 Upstash pass** for note saves and for the
   account mutations alike. This sentence is the deferral record; do not bolt
   it on, do not drop it from AGENTS.md's obligations.
5. **Caching stays `force-dynamic`** on every touched route.

## W6-A — Private notes (P3-B)

**Verbatim item:** "Per-material private note textarea, auto-save on blur
with optimistic UI, `user_notes` RLS policies as a migration, Supabase client
only. Rate limiting is the Week 18 pass — deferral recorded here, not
dropped."

Acceptance criteria:

- `lib/db/notes.ts`: `getNote(materialId)` → `string | null`,
  `upsertNote(materialId, body)`, `deleteNote(materialId)`. Supabase server
  client for every touch of `user_notes`; no Drizzle, no `db/schema.ts`.
  The table has a unique constraint on `(user_id, material_id)` — the editor
  upserts against it, which is what makes one-note-per-material true in the
  database rather than only in the UI.
- `lib/validation/notes.ts`: one Zod schema shared by client and server (D6),
  with a length cap. An empty or whitespace-only body **deletes** the note
  rather than storing a blank row — a cleared note is an absent note.
- `components/note-editor.tsx` (client): textarea, auto-save on blur (not on
  every keystroke), optimistic state with rollback on failure, a visible
  saved/saving/failed indicator that is announced politely, and a failure
  path that never loses what the user typed. Signed-out users see nothing at
  all — not a disabled box.
- Mounted **below the tabs** on the material page, in its own clearly
  personal region, never inside the Sources or Olfactive panels: a private
  note must not be confusable with cited editorial content (AGENTS.md).
- Server actions re-parse with `safeParse` and re-verify auth with
  `getUser()`. `loading.tsx` gains the editor's skeleton so the page does not
  jump.

## W6-B — Account management (P3-C)

**Verbatim item:** "Change email, change password, delete account. Deletion
runs through the Supabase admin API with the secret key in a server action;
`ON DELETE CASCADE` does the cleanup — verified with a throwaway account."

Acceptance criteria:

- `/account` grows three sections, each its own form with its own Zod schema
  in `lib/validation/account.ts`, shared client and server (D6).
- **Change email:** Supabase sends a confirmation to the new address; the UI
  must say so and must not claim the address changed before it did.
- **Change password:** requires the current password. Never echoes raw
  Supabase error internals; maps to plain language.
- **Delete account:** an explicit confirmation step (type the word, not a
  lone button), a server action that re-verifies with `getUser()` and deletes
  only that id through the admin client, then signs out and redirects. Copy
  states plainly and truthfully what is destroyed and that it cannot be
  undone. No soft-delete: user-owned rows are hard-deleted (GDPR, AGENTS.md).
- D4 states on the segment; every form follows the per-form checklist
  (inline messages, errors on blur not keystroke, submit shows loading,
  disabled while invalid).

## After the wave (orchestrator)

Full suite; combined diff; browser verification of both surfaces in both
modes at 375px and desktop; confirm `lib/db/notes.ts` imports no Drizzle;
RLS probes on `user_notes` (the same discriminating pair used for
`user_saved_materials`: a forged write must be refused `42501`, while the
legitimate control passes RLS and is stopped only by the foreign key —
without that control the probe proves nothing); one commit per item; tick
P3-B and P3-C.

**The verification this wave cannot finish by itself.** Account deletion's
`ON DELETE CASCADE` behaviour, and the signed-in halves of both items, need a
real session against a real account. Creating an account is not an action
available to an agent or to the orchestrator, so this is a maker step, and it
is genuinely important: deletion is irreversible and the cascade is the only
thing standing between "account deleted" and "rows orphaned". It is recorded
in [../maker-todo.md](../maker-todo.md) as a blocking pre-launch item, not as
a nice-to-have.
