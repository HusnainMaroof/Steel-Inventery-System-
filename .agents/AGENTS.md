# Agents workflow

How the supervisor (the lead Claude Code session) runs free coding agents on
this repo: it loads the right skills, plans, picks a model per task at run
time, delegates, reviews every result, and only then applies it.

The design follows two sources:

- **OpenHands** agent infrastructure ([software-agent-sdk](https://github.com/OpenHands/software-agent-sdk)):
  file-based agent definitions, keyword-triggered skills, a model router,
  a task tracker, an event log, a stuck detector, a confirmation policy for
  risky actions, isolated workspaces, and a critic with iterative refinement.
- **Karpathy guidelines** for LLM coding: think before coding, simplicity
  first, surgical changes, goal-driven execution.

Everything here is in the repo except run data (`.e2e-tmp/runs/`, git-ignored).
To start a run, the owner says "run agents on <task>" and the supervisor
follows the `run-agents` skill (`.claude/skills/run-agents/SKILL.md`).

---

## 1. The loop at a glance

```text
 owner request
      |
 [1 INTAKE]      supervisor states goal, interpretations, assumptions, "done when"
      |
 [2 SKILLS]      load skills by trigger (skills-map.md), keep the rules that apply
      |
 [3 INVESTIGATE] reproduce, measure, root cause (supervisor; investigator agent for wide reads)
      |
 [4 PLAN]        tasks with profile, files, risk, workspace, "-> verify" per step (plan.md)
      |
 [5 APPROVE]     high-risk tasks wait for the owner's yes (confirmation policy)
      |
 [6 ROUTE]       router picks tool:model per task from live free models + scorecard
      |
 [7 DELEGATE]    brief.md -> launch in a worktree or in place; watch for stuck patterns
      |
 [8 CRITIC]      automated check.md + supervisor score /100 (+ reviewer agent if big)
      |            90+ approve | 60-89 critique.md -> relaunch --resume (max 3) | <60 reroute
 [9 APPLY]       worktree patch -> main tree, re-verify, browser test
      |
 [10 GOAL CHECK] every "done when" holds? report to owner, score the model, commit
```

---

## 2. Principles (Karpathy, applied to supervisor and agents)

| Principle | Supervisor does | Agent is told (rules files) | Review checks |
|---|---|---|---|
| **Think before coding** | Writes goal, interpretations, assumptions and a simpler alternative in plan.md. Asks the owner when two readings give different results. | Write "Assumptions" in the report; when two readings exist, take the safer and say so. Agents never ask (they run unattended). | Assumptions written and sensible. |
| **Simplicity first** | Plans the smallest change that meets the goal; pushes back on extra scope. | Minimum code; no options, abstractions or error handling nobody asked for. | "Simple" score. |
| **Surgical changes** | Lists exact allowed files; asks for the exact lines to change. | Touch only what the task needs; no drive-by edits; report unrelated problems instead of fixing them. | "Surgical" score; `check` flags files outside scope, stray files, line-ending rewrites. |
| **Goal-driven execution** | Turns every task into "done when" checks and every plan step into "step -> verify: check". | Loop until each check passes; paste the proof. | "Goal met" and "Verified" scores; supervisor re-runs the proof. |

When the supervisor explains a run to the owner, it uses the
`andrej-karpathy` teaching style: start from the simple idea, show the real
numbers, explain why.

---

## 3. OpenHands ideas and where they live here

| OpenHands | Here | File |
|---|---|---|
| File-based agents (`.agents/agents/*.md`, frontmatter + body) | One profile per role: task type, mode, tier, preferred tools, skills, rules, risk, workspace, time limit | `.agents/agents/*.md` |
| Skills with keyword triggers | Trigger table; the supervisor loads skills and copies the rules that apply into briefs | `.agents/skills-map.md` |
| `RouterLLM` / task-based model routing | Router ranks live free models per task type | `.agents/router.json`, `agents.cjs route` |
| `TaskTrackerTool` | plan.md task table with status | `.agents/templates/plan.md` |
| Event-sourced conversation | `events.jsonl` per run: created, worktree, launch, exit, fallback, watch, check, score, apply, cleanup | `.e2e-tmp/runs/<id>/events.jsonl` |
| `StuckDetector` (5 patterns) | `agents.cjs watch`: same call 4x, same error 3x, ping-pong 6 cycles, context-window errors, plus log idle 10 min | `agents.cjs` |
| Confirmation policy (`ConfirmRisky`) | Risk levels; high risk needs the owner's yes | section 7 |
| `DockerWorkspace` isolation | git worktree per run outside the repo, `node_modules` linked, no `.env` files inside | `agents.cjs worktree` |
| Critic + iterative refinement (threshold, max 3) | Score /100, refine below 90, at most 3 attempts | `.agents/templates/review.md` |
| Goal completion loop | Final goal check against plan.md "done when" | phase 10 |
| Agent hooks (pre/post tool use) | Post-run `check` (scope, churn, tsc, eslint vs HEAD, jest) | `agents.cjs check` |

---

## 4. Files

| Path | What |
|---|---|
| `.agents/AGENTS.md` | This workflow. |
| `.agents/agents/*.md` | Agent profiles: investigator, backend-fixer, feature-builder, ui-polisher, test-writer, browser-tester, reviewer, doc-writer. |
| `.agents/rules/*.txt` | Rules pasted at the top of every prompt: `code`, `ui`, `browser`, `readonly`. |
| `.agents/templates/` | `plan.md`, `brief.md`, `review.md`. |
| `.agents/skills-map.md` | Which skills to load for which task. |
| `.agents/router.json` | Tools, excluded models, tiers, cooldowns, routing weights. |
| `.agents/scorecard.json` | Every reviewed attempt (tool, model, task type, score). The router learns from it. |
| `.agents/bin/agents.cjs` | Supervisor CLI (section 5). |
| `.claude/skills/run-agents/SKILL.md` | The skill the supervisor follows when the owner says "run agents". |
| `.e2e-tmp/runs/<id>/` | Run folder (git-ignored): plan, brief, prompts, logs, report, check, critique, review, patch, events. |
| `.e2e-tmp/agents-state/` | Router state (git-ignored): `models.json` live model list, `health.json` cooldowns. |
| `.e2e-tmp/freebuff/` | Freebuff TUI driver (git-ignored, copy by hand to a new machine). |
| `../inventry-wt/<id>/` | Worktrees, outside the repo. |

---

## 5. Supervisor CLI

Run from the repo root in Git Bash. Long commands (`launch`, `watch`) go in
Claude Code `run_in_background`, never with a shell `&` (no exit
notification then).

| Command | Does |
|---|---|
| `node .agents/bin/agents.cjs new <id> "<title>"` | Creates `.e2e-tmp/runs/<id>/` with plan.md, brief.md, review.md. |
| `... models [--refresh]` | Live free models from Cline (API), OpenCode (`opencode models`), Kilo (`kilo models`) and Freebuff (static), minus excludes, with tier and cooldown. Auto-refresh after 24 h. |
| `... route <profile> [--worktree] [--top N]` | Ranked candidates for a profile, with the reason. |
| `... worktree <id>` | Isolated worktree at HEAD in `../inventry-wt/<id>`, `node_modules` linked by junction. |
| `... launch <id> <profile> [--model tool:model] [--resume] [--no-fallback]` | Builds the prompt (rules + role + workspace + brief [+ critique]), picks the model with the router, runs the tool with git disabled, logs events. On rate limit, auth, unknown model or a crash in the first 2 minutes it cools that model down and falls back to the next one (up to 2 times). |
| `... watch <id> [--once]` | Stuck detector; exits with the reason (done, idle, stuck pattern). |
| `... check <id>` | Writes check.md: scope (OK / OUT / STRAY), line-ending churn, client tsc, client eslint compared with HEAD, server tsc, server jest for changed folders. |
| `... score <id> <0-100> [note]` | Records the review score for the last attempt in scorecard.json (90+ approve, 60-89 refine, below 60 reroute). |
| `... scorecard` | Runs, approvals and average score per tool:model. |
| `... apply <id>` | Worktree changes -> `patch.diff` -> `git apply --3way` on the main tree. The changes arrive **staged**: review with `git diff --cached`; undo with `git restore --staged --worktree --source=HEAD -- <files>` (a plain `git checkout` does not undo staged changes). |
| `... cleanup <id>` | Removes the worktree. It deletes the `node_modules` junctions FIRST; removing a worktree through a junction would delete the real `node_modules`. |
| `... status` | Every run with its last event. |

---

## 6. The phases in detail

### Phase 1. Intake (think before coding)

Write plan.md section 1: the owner's words, the possible readings, the
assumptions, a simpler approach if one exists, the goal in one sentence and
"done when" checks. If two readings lead to different work, ask the owner
before planning. Status replies to the owner are Hinglish, short, tables,
no em dashes, no emojis.

### Phase 2. Skills

Match the request against `.agents/skills-map.md`, load each matching skill
(Claude Code `Skill` tool, or its search script, for example
`python ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux -n 5`),
and write in plan.md which skills were loaded and the 3 to 8 rules that
apply. Load skills before planning; they change the plan.

### Phase 3. Investigate

The supervisor reproduces the problem (browser, API read, test), measures
it, and finds the root cause with file:line. For wide questions it may run
the `investigator` profile (read-only) and verify each finding itself.
Agents do well with precise specs and badly with vague ones, so this phase
is never delegated blindly.

### Phase 4. Plan (task tracker)

Fill plan.md section 4, one row per task: profile, allowed files, risk,
workspace, dependencies, status. Rules:

- One task = one profile = one set of files. Parallel only when file sets do
  not overlap.
- Cross-cutting changes (global CSS, shared components, auth, money logic)
  are done by the supervisor, not delegated.
- A fix of a few lines is done by the supervisor.
- Each step has "-> verify: <check>".

### Phase 5. Approve (confirmation policy)

| Risk | Examples | Policy |
|---|---|---|
| Low | Read-only analysis, docs, tests, UI polish in place | Agent runs without asking (`NeverConfirm`). |
| Medium | Logic changes in allowed files, browser tests that only read | Agent runs; supervisor reviews before anything is kept. |
| High | Any database write (test DB too), browser tests that change data, killing a process, dependencies, env or secrets, deploy, auth or money logic without tests | Supervisor asks the owner first with the command and the reason, then waits (`ConfirmRisky`). |

Always forbidden for agents: reading env files, git, npm install, starting
or stopping servers, direct database access, production.

### Phase 6. Route (dynamic models)

No profile names a model. `launch` asks the router, which:

1. takes the live free-model list (`models.json`), minus `router.json`
   excludes (safety classifiers, tiny models, vision models, gateways that
   need keys);
2. keeps models whose tool supports the profile's mode (`edit`, `readonly`,
   `browser`), that work in a worktree if the run has one (Freebuff does
   not), that meet the profile's tier (`strong` or `any`), and that are not
   cooling down;
3. ranks them: `0.6 x expected score on this task type + 0.4 x expected
   score overall + preferred-tool bonus + strong-tier bonus - recent
   failures`. Expected score = (sum of review scores + 0.6 x 2) / (runs + 2),
   so untested models start at 0.6 and proven ones rise above them.

Check the choice with `route <profile>` before launching. Override with
`--model tool:model` when there is a reason (write it in plan.md). Every
`score` updates the ranking for the next run, so routing learns.

Cooldowns after a failure: rate limit 30 min, auth 1 day, unknown model 7
days, crash 15 min (`router.json`).

### Phase 7. Delegate

1. `new <id>`, fill brief.md from the template: allowed files (with line
   endings), what it looks like now, root cause, "done when", exact changes
   with "-> verify", skill guidance, tests, self-check, assumptions.
2. Workspace:
   - **worktree** (default for server code and tests): `worktree <id>`. The
     agent edits a copy; nothing reaches the main tree before review. No
     `.env` files exist there.
   - **in place** (UI that needs the running dev server and browser): the
     main tree must be clean first, so `git diff` is the agent's proposal and
     `git checkout -- <file>` rejects it.
3. `launch <id> <profile>` in the background. Keep working on files the
   agent does not own.
4. `watch <id>` in the background for long runs.

### Phase 8. Critic (review)

1. `check <id>` and read check.md.
2. Read the report (assumptions first) and the full diff with the code
   around it.
3. For large or risky diffs, run the `reviewer` profile as a second opinion.
   The supervisor still decides.
4. Score with review.md (Goal met, Surgical, Simple, Verified; 25 each),
   then `score <id> <n>`.
5. Verdict:
   - **90 to 100 approve**: small touch-ups by the supervisor are fine.
   - **60 to 89 refine**: write critique.md as numbered exact fixes, then
     `launch <id> <same profile> --resume`. At most 3 attempts per task.
   - **below 60, or a 3rd failure: reroute** to the next candidate from
     `route`, with a better brief, or the supervisor does it.
   - **safety problem** (secrets, git, DB, out-of-scope rewrite): reject,
     restore the files, score it low so the router learns.

### Phase 9. Apply

Worktree runs: `apply <id>`, then review the main-tree diff again,
`cleanup <id>`. In-place runs: already in the tree. Then run tsc, eslint,
the relevant tests, and check every changed screen with agent-browser at
1440x960 and 390x844.

### Phase 10. Goal check and report

Tick every "done when" in plan.md with its proof. Commit once per finished
piece of work (message ends with the `Co-Authored-By` line). Report to the
owner: what changed, which agent and model did what, review scores and what
the supervisor fixed, what was verified and how, what was not verified, and
anything that needs their yes (DB writes, process kills, push). Push only
when the owner says "push it", then watch CI and Deploy Production.

---

## 7. Monitoring, stuck agents and restarts

| Signal | How | Meaning |
|---|---|---|
| Exit notification | Claude Code tells the supervisor when the background `launch` ends | Finished, fell back, or failed. |
| Progress | `watch <id> --once` (log age, iteration, report state, stuck patterns) | Still working if the iteration grows. |
| Report stable 60 s | `watch` | Done, even if the process has not exited (Freebuff). |
| Same call 4x / same error 3x / ping-pong 6 cycles / context errors | `watch` | Stuck (OpenHands patterns). |
| Log idle 10 min | `watch` | Stuck or ended without a report. |

Restart rules:

1. Read the log tail and the report.
2. Ended early by a tool problem: `launch` already cooled the model down and
   fell back. If all fallbacks failed, `models --refresh` and launch again.
3. Stuck or looping: ask the owner before killing it
   (`taskkill //PID <pid> //T //F`), close its browser session, put the
   correction in critique.md (for example the right URL), relaunch with
   `--resume`.
4. Restarts must not leave junk: `check` flags stray files.

---

## 8. Keeping the owner updated

- Before a run: the plan table (task, profile, chosen model, risk).
- While it runs: one line when something changes (finding, fallback,
  restart, change of plan). On "status": a table of every run with its
  task, model, attempt, progress and blockers. On long runs about every
  30 minutes.
- After: section 6 phase 10.

---

## 9. Tool reference

All tools run with `GIT_DIR=/tmp/no-git-for-agents` and the npm global bin
on PATH; `launch` builds these commands. They are listed for manual use and
debugging.

| Tool | Command | Notes |
|---|---|---|
| Cline | `cline -t <sec> -m <model> --json "<prompt>" < /dev/null` | Act mode, auto-approve. `cline auth -p cline` if it asks to re-authenticate. Auto-update is off on purpose (`~/.cline/data/settings/global-settings.json`). |
| OpenCode | `XDG_DATA_HOME="$HOME/.opencode-free" opencode run --standalone --agent build --auto -m <model> --title <t> "<prompt>"` | The keyless data dir is required (stored keys are expired). `--agent plan` for read-only. All `opencode/*-free` models share one quota. Stagger parallel starts by 5 to 8 s. |
| Kilo | `kilo run --auto --agent code -m <model> --title <t> "<prompt>"` | Separate quota. Once ran `git restore`; the fake GIT_DIR prevents that. |
| Freebuff | `FREEBUFF_MODEL="<picker name>" node .e2e-tmp/freebuff/drive.js run <prompt.txt> <minutes> <report>` | TUI driven through ConPTY. The driver picks the model (retry if it misses), auto-answers question menus and "continue", and finishes when the report is stable for 60 s. Daily hour budget. In place only. |

Updating tools: `npm i -g cline`, `npm i -g @opencode/cli`,
`npm i -g @kilocode/cli` by hand; then `models --refresh` and one short
read-only run. If Freebuff screens change, `node .e2e-tmp/freebuff/drive.js probe`.

---

## 10. Environment

| What | Where |
|---|---|
| Client dev | `http://localhost:3000` (`cd client; TIJARATT_API_URL=http://127.0.0.1:4100 CLIENT_ORIGIN=http://localhost:3000 npx next dev -p 3000`) |
| API dev | `http://127.0.0.1:4100` (`cd server; npm run start:dev`, loads `server/.env.e2e`, the test DB) |
| Test DB | Neon `tijaratt_test`; test data scripts in `.e2e-tmp/fresh/` (write data: ask first) |
| Production | `https://tijartt.com`, deployed by GitHub Actions on push to `main`; never used for tests |

Reuse running servers; never start a second one. The GitHub repo is public:
no passwords in repo files. Test owner passwords are in
`.e2e-tmp/fresh/seed-logins.json`; the super admin login is in
`server/.env.e2e` and only the supervisor reads it (to log the `admin`
browser session in). agent-browser sessions: `owner` (Al-Noor Steel
Traders), `madina` (Madina Cement Depot), `admin` (super admin).

Browser testing notes: re-run `snapshot -i` before every click (a stale ref
once clicked Sign out); fill React fields from `eval` with the native value
setter plus an `input` event; saving anything writes to the test DB.

---

## 11. Lessons that shaped this workflow

| What happened | Rule it produced |
|---|---|
| Kilo ran `git restore` and wiped work | Fake `GIT_DIR` for every agent; worktrees for code tasks |
| Freebuff waited 40 min on a question menu | Agents never ask; the driver auto-answers; `watch` |
| Agent D fixed one call site, missed the sibling | "Same bug elsewhere?" in review; root cause in the brief |
| Agent G could not see layout problems | UI work always gets a supervisor browser check at 1440 and 390 |
| Agent E looped on a wrong URL | Stuck patterns in `watch`; correct URLs in briefs |
| Agents left `fix.py`, `tsc_err.txt`, `jest-output.txt` | `check` flags STRAY files |
| A launch with `&` gave no exit notification | Always `run_in_background` |
| Test passwords nearly went into a public repo | No secrets in repo files |
| A model list changed (MiniMax became free) | Models are discovered live, never fixed in profiles |
