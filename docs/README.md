# Perfumers Codex — Design Docs

| Doc                                            | Purpose                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [overview.md](./overview.md)                   | What this project is, why it exists, target users                                                    |
| [scope.md](./scope.md)                         | What ships in v1, what's deferred, why                                                               |
| [tech-stack.md](./tech-stack.md)               | Locked stack with reasoning and cut points                                                           |
| [data-strategy.md](./data-strategy.md)         | Sourcing, licensing, ethical/legal handling                                                          |
| [database-schema.md](./database-schema.md)     | Tables, relationships, design decisions                                                              |
| [architecture.md](./architecture.md)           | Code-level decisions: module layout, search boundary, type contracts, page states, tests, validation |
| [cheminformatics.md](./cheminformatics.md)     | RDKit features, the structure–odor experiment, evaluation methodology                                |
| [licensing.md](./licensing.md)                 | MIT (code) + CC-BY-SA (data), reasoning                                                              |
| [quality-checklist.md](./quality-checklist.md) | The "boring quality" bar the app is held to                                                          |

These docs are canonical: they describe what the project is and how it's
built, they're versioned with the code they describe, and they're public on
purpose. Change them here, not in a copy.

The codebase _rules_ — the constraints an agent or contributor works under —
live one level up in [`AGENTS.md`](../AGENTS.md), loaded automatically via
`CLAUDE.md`.

Personal planning (time budget, week-by-week milestones, cut-point strategy,
career framing) is deliberately **not** in this repo. It's private, it changes
weekly, and none of it is needed to understand or build the project.
