# Skills map

The supervisor loads skills by trigger, like OpenHands keyword-triggered
skills. A skill is loaded by the supervisor (Claude Code `Skill` tool or the
skill's own search script); the useful guidance is then copied into the
brief, because free agents cannot run skills.

Always-on for every task: `AGENTS.md`, `docs/ARCHITECTURE.md`,
`docs/frontend-design.md` (UI) and this workflow.

| Trigger words in the task | Skills to load | What to copy into the brief |
|---|---|---|
| page, screen, popup, modal, table, card, layout, spacing, "ui", "ux", design, looks bad, glitch, overflow | `ui-ux-pro-max` (run `scripts/search.py ... --domain ux`), `frontend-design` | Table, toolbar, empty-state, row-action and form rules; phone layout rules |
| phone, mobile, responsive, breakpoint, wraps, overflowing | `responsive-design` | Mobile-first rules, no horizontal scroll, card layouts |
| animation, motion, transition, toast, notification | `animation-vocabulary`, `gsap-core`, `notifications-toasts` | Exact term, timing, reduced motion |
| API, endpoint, NestJS, service, guard, pipe, DTO, validation, error handling | `nodejs-backend-patterns` | Error handling, validation, layering |
| query, SQL, Prisma, index, slow, migration, Postgres | `supabase-postgres-best-practices` | Query and index rules, transaction scope |
| auth, login, session, token, permission, plan access, secret, upload, injection | `security-review` | OWASP checks for the touched code |
| refactor, architecture, structure, coupling, "where is X done" | `improve-codebase-architecture`, `use-codeatlas` | Module boundaries, the search results the investigator needs |
| SEO, landing page, marketing page | `seo-audit`, `frontend-design` | On-page SEO checks |
| new free agent tool, model list, agent CLI flags | `use-cline`, `use-opencode`, `use-kilocode`, `use-freebuff` | Exact flags and current free models |
| "find a skill", no skill fits | `find-skills` | Install only with the owner's yes |

Rules:

1. Load before planning, not after: skills change the plan.
2. Write in plan.md which skills were loaded and why.
3. Never paste a whole skill into a brief: copy the 3 to 8 rules that apply.
4. A skill's advice never overrides AGENTS.md or the design system docs.
