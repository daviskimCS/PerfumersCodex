# UI backlog

What the October 2026 UI audit found and left for later. Every screen was walked in light and dark at desktop and phone width; the eight highest-impact findings shipped in the PR that added this file. Each item below is presentation only unless it says otherwise, and none touches `MaterialDetail` or the stored drawings, so none moves a review fingerprint.

Ordered by impact, highest first.

## Material page

1. **Each section's small label repeats its heading.** "OLFACTIVE" sits over "Olfactive description", "SOURCES" over "Sources". Drop the label where the heading already says it, or make the label the heading.
2. **Computed properties sit below Sources and are missing from the "On this page" list.** They are structure-derived context, not cited facts, which is why they sit after the sections. They are still something readers jump to, so give them an entry in the list after Sources.
3. **An empty Usage section still renders two headings and two paragraphs.** "No usage guidance recorded yet" and "No landmark uses recorded yet" could be one line when both are empty.

## Lists and empty states

4. **The materials index shows its Sort controls above an empty list.** Hide the controls while nothing is published, or while a filter returns nothing.
5. **An invalid SMARTS pattern says "start from one of the presets below"** even while there are no presets (`components/structure-search/structure-search.tsx`). Drop the clause when the list is empty, the way the empty state already does.
6. **Error pages have no icon, unlike the empty states and the 404.** They also use straight apostrophes ("didn't", "doesn't") where the rest of the site uses curly ones ("haven’t"). Pick one, curly, and sweep `app/**/error.tsx` and `app/not-found.tsx`.

## Legal pages

7. **Privacy and Terms carry a "Draft, not yet reviewed" banner.** It reads as unfinished to anyone evaluating the site. It comes off when the maker reviews both documents (maker-todo).
8. **Both pages are about 7,500px long with no table of contents.** The material page's "On this page" list (`components/material/sections.tsx`) would fit them.

## Home

9. **"What makes this different" repeats what the intro says.** Since the intro was cut to one sentence the overlap is smaller. The three cards could still become one line, or give way to the families row.

## Account

10. **The account page's buttons sit disabled and washed out until you type.** That's correct under WCAG (disabled controls are exempt from contrast), but it reads as broken. Enabled buttons with inline validation on submit would match the sign-in forms.
