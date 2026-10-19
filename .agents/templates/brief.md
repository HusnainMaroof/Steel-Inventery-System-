TASK {{ID}}: {{TITLE}}

## Allowed files

- path/one.tsx
- path/two.ts

(Only these may change. The REPORT path is always allowed. Line endings: say LF or CRLF per file.)

## What it looks like now

Measured facts: the exact text on screen, numbers, what is wrong at which
width. No guesses.

## Root cause

Verified by the supervisor, with file:line.

## Done when

Verifiable goal (Karpathy: turn "fix X" into checks):
- [ ] check one, for example "test Y passes with input A giving B"
- [ ] check two, for example "at 390px the toolbar is one row, no horizontal scroll"

## Do

1. Exact change one (new copy written out in full) -> verify: how
2. Exact change two -> verify: how
3. What must NOT change.

## Assumptions

What the supervisor assumed while writing this brief. The agent adds its own
in the report.

## Skill guidance

Points copied from the skills loaded for this task (for example ui-ux-pro-max
rules for tables and empty states, nodejs-backend-patterns for error
handling). The agent cannot run skills itself.

## Tests

Which test to add or update, with concrete inputs and expected values.

## Self-check

Run and paste the output in the report:
- `cd client && npx tsc --noEmit` / `npx eslint <files>`
- `cd server && npx tsc --noEmit -p tsconfig.json` / `npx jest <path> --runInBand`

## Report

Write the REPORT file: per file what changed (before -> after), anything you
could not do and why, self-check output.
