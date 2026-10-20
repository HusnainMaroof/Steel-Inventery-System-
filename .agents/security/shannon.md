# Security testing with Shannon (gated)

Shannon ([KeygraphHQ/shannon](https://github.com/KeygraphHQ/shannon)) is an
open-source white-box AI pentester for web apps and APIs: it reads the
source, finds attack vectors, and runs real proof-of-concept exploits
against a running copy of the app. Motto: "No exploit, no report."

This is authorized testing of our own app only. It is never an agent
profile and never runs on its own. The supervisor runs it by hand, and only
after the owner says yes, because it actively changes application state.

## Hard rules

- **Own app only.** Only against Tijaratt, which the owner owns.
- **Never production.** Only the local or test environment. It creates users,
  submits forms and changes data; it must never touch `tijartt.com` or the
  production or test Neon database that real owners use. Point it at a local
  app with a disposable local database.
- **Owner approval each time (high risk).** Say what will run and against
  what, then wait. Treat it like any data-changing action in `AGENTS.md`.
- **Human review of findings.** Shannon's report is a starting point. The
  supervisor verifies every finding in the code before telling the owner, and
  before any fix. Fixes go through the normal workflow (backend-fixer /
  feature-builder with tests), not straight from the report.
- **No exploit code in the repo.** Keep Shannon's workspace and reports under
  `.e2e-tmp/security/` (git-ignored). Do not commit exploit payloads.

## Requirements on this machine

Shannon needs Docker and WSL2; it does not run under native Windows or Git
Bash. As of this writing both WSL (Ubuntu) and Docker Desktop are installed
but stopped, so a run needs the owner to start them first. It also needs a
model provider API key, which is the owner's to add during `shannon setup`
(the supervisor does not hold or read it).

## Runbook (supervisor, after approval)

1. Owner starts WSL2 (`wsl -d Ubuntu`) and Docker Desktop, and runs
   `npx @keygraph/shannon@latest setup` once to store their provider key.
2. Bring up a local app against a **disposable local** database (not the
   shared test DB, not production). From the Docker worker the app is reached
   at `http://host.docker.internal:<port>`, not `localhost`.
3. Write a config file in `.e2e-tmp/security/shannon.yaml` (not committed):
   a `description`, `rules_of_engagement` (rate limits), an `authentication`
   block with throwaway local credentials and the login flow, a
   `success_condition`, and `rules.avoid` for `/logout` and any destructive
   or out-of-scope path. Booleans are quoted strings (`"true"`).
4. Validate the login first: `... start ... -c shannon.yaml --validate-auth`.
5. Run: `npx @keygraph/shannon@latest start -u http://host.docker.internal:<port> -r <repo> -c .e2e-tmp/security/shannon.yaml`.
   A full run is about 1 to 1.5 hours and costs the owner model credits.
   The repo is mounted read-only.
6. Reports come out as Markdown, PDF, JSON and SARIF in the Shannon
   workspace. Copy the Markdown summary into the run folder.
7. Verify each finding in the code. Then plan fixes as normal tasks (brief,
   backend-fixer or feature-builder, tests, review) and a re-run to confirm.

## Lighter option without Shannon

For a quick pass without Docker/WSL2, run the `security-review` skill over
the changed files (a static OWASP review by the supervisor or the `reviewer`
profile). It finds no live exploits but needs no infrastructure and no owner
credits. Use it on every auth, upload or money change; keep a full Shannon
run for before a release or when the owner asks.
