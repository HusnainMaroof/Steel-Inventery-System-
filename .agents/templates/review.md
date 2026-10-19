# Review {{ID}}: {{TITLE}}

Supervisor review of one agent attempt (the critic step). Run
`node .agents/bin/agents.cjs check {{ID}}` first and read check.md.

Attempt: #
Agent: profile / tool:model

## Score (4 x 25 = 100)

| Dimension | What it means | Score /25 | Notes |
|---|---|---|---|
| Goal met (correctness) | Every "Done when" check holds; root cause fixed; edge cases, error paths, money in Decimal, locks and transactions | | |
| Surgical (scope and safety) | Only allowed files and only the needed lines; no drive-by edits, no stray files, no secrets, line endings kept; assumptions written down | | |
| Simple (quality) | Minimum code for the goal; no speculative options or abstractions; matches the surrounding style and the design system | | |
| Verified | Proof pasted and re-run by the supervisor: tsc, eslint (no new problems vs HEAD), tests, browser at 1440 and 390 | | |
| **Total** | | **/100** | |

## Verdict

- 90 to 100: **approve**. Small touch-ups by the supervisor are fine.
- 60 to 89: **refine**. Write critique.md (numbered, exact fixes) and relaunch
  with `--resume`. At most 3 attempts per task.
- Below 60, or a third failed attempt: **reroute** to the next model in the
  profile's fallback list with a better brief, or the supervisor does it.
- Any safety problem (secrets, DB write, git, out-of-scope rewrite):
  **reject**, restore the files, write it down in the scorecard.

Verdict:

## Found by review

-

## Fixed by the supervisor

-
