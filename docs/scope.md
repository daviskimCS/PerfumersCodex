# Scope: V1 vs V2

## V1 — what ships at launch (Month 6)

### Public, anonymous browsing
- Search by name, synonym, CAS number, IUPAC name
- Material detail pages with: hero, safety, olfactive, usage, sources tabs
- Browse by olfactive family
- Citations on every fact, linked to original source

### Authenticated features (signup required)
- Bookmark materials ("save")
- Private free-text notes per material
- Account management (change email/password, delete account)

### Admin/internal
- Private admin dashboard at `/admin` (locked to maker's email): signup count, search count, top searches, error rate
- Submit-a-correction form for users to suggest data fixes (editorial-controlled review by maker)

### Operational
- Public GitHub repo
- Custom .com domain, HTTPS
- Privacy policy, terms of service
- Sentry error tracking, Plausible analytics
- 35–50 hand-curated materials

## V2 — deferred features (post-launch, no commitment yet)

### Personal layer (the major v2 push)
- Stock/inventory tracking (what materials you own, where bought, current quantity)
- Formulation logs (recipes, ratios, dates, smell-test notes)
- Session journal (free-form notes from perfumery sessions, linkable to materials)
- Use-by-date tracking and rotation reminders

### Community layer
- Trusted-contributor system with tiered edit permissions
- Public discussion threads per material (carefully moderated)
- User-submitted "I've used this in:" entries

### Discovery
- Recommended pairings ("materials that work well with X")
- Family/accord exploration views
- "Smell-alike" comparisons

### Optional embedded companion (originally Part 2, dropped from v1)
- Bench device that lights up the corresponding bottle when a material is opened on the laptop
- Defer until v1 is shipped and proves out — may never happen, that's fine

## Decisions and reasoning

### Why personal layer is partly in v1 (bookmarks + notes only)

Originally personal layer was fully v2. Pulled forward to a *minimal* form because public signup with no logged-in value is meaningless. Bookmarks + notes is the lightest possible "reason to sign up" without triggering the v2 scope explosion.

Full personal layer (formulation logs, stock, session journal) stays v2 because:
- Triples v1 implementation scope (per-user data shapes, sync, mobile-first entry, privacy auditing)
- Mobile UX matters much more for those features (perfumer at the bench with phone, not laptop)
- Better to ship the public reference well than the personal app poorly

### Why no embedded companion in v1

Originally pitched as a "Part 2" satellite device. Dropped because:
- Maker chose "polished software over all"
- Splitting attention between web app polish and a hardware project would compromise both
- Can be added as a separate small project later if desired

### Why curated, not comprehensive

50 materials hand-curated with full citations beats 500 materials with shallow data. Quality is the differentiator. Coverage can grow forever after launch.

### Why English-only

Adding i18n triples copywriting work and adds significant engineering complexity. Most of the international perfumery community reads English. English-only doesn't preclude i18n later — designs should not depend on hardcoded English in shared components, but no localization pipeline in v1.
