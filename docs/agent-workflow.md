# Agent workflow

How work on this repo is split between the lead session (Claude Code) and
free coding agents (Cline, OpenCode, Kilo, Freebuff). Read this before you
launch or review an agent.

The lead session does the investigation, writes a precise brief, launches
the agent, reviews every change like a senior developer, tests it in a real
browser, and commits. An agent's edit is a proposal until it passes review.

Paths below are for the owner's Windows machine (Git Bash):
repo `C:/Users/husna/Desktop/inventry-system`, global npm bin
`C:/Users/husna/AppData/Roaming/npm`.

---

## 0. When to use an agent

| Use an agent | Do it yourself |
|---|---|
| The owner asked for agents | A fix of a few lines |
| Work you can specify exactly (files, cause, fix, tests) | The cause is still unknown: investigate first |
| Independent pieces on separate files (run in parallel) | Cross-cutting changes (global CSS, shared components, auth) |
| Long browser test runs | Anything that needs secrets or a DB write |

Always do the investigation and measurement yourself first. Agents execute
well-specified work well and vague tasks badly.

---

## 1. Ground rules (never break these)

| Rule | Why |
|---|---|
| Agents never read `.env`, `.env.production`, `.env.e2e`, `client/.env*` | No secrets leave the machine. The lead session logs browsers in itself. |
| Agents run with `GIT_DIR=/tmp/no-git-for-agents` | A Kilo agent once ran `git restore` and wiped uncommitted work. With a fake `GIT_DIR` no git command can touch the repo. |
| Agents never write to a database directly, start, stop or kill a server | `AGENTS.md`: DB writes and process kills need the owner's yes first. A browser test agent may change test data through the app UI only when the owner said yes and the brief lists the exact changes and how to restore them. |
| Never touch production (DB, keys, env) | Tests use the test DB only. |
| No secrets or passwords in repo files | The GitHub repo is public. Test passwords stay in git-ignored files. |
| One agent per set of files | Two agents in parallel only when their ALLOWED FILES do not overlap. |
| Push to `main` only when the owner says "push it" | A push to `main` deploys to production. |
| Commit once per finished piece of work | Not after every small fix. |

The lead session itself follows the same `AGENTS.md` rules: ask before any
database write (also on the test DB) and before killing a process; say the
command and the reason, then wait.

---

## 2. Environments

| What | Where | Notes |
|---|---|---|
| Client dev | `http://localhost:3000` | `cd client; TIJARATT_API_URL=http://127.0.0.1:4100 CLIENT_ORIGIN=http://localhost:3000 npx next dev -p 3000` |
| API dev | `http://127.0.0.1:4100` | `cd server; npm run start:dev`. `start:dev` loads `server/.env.e2e` (test DB), see `server/src/load-env.ts`. Watch mode reloads on save. |
| Test DB | Neon database `tijaratt_test` | Only DB agents and tests may use. Read-only checks use a `default_transaction_read_only=on` connection. |
| Production | `https://tijartt.com` | Deployed by GitHub Actions. Never used for tests. |

If a client or server is already running, reuse it. Do not start a second one.

**Test logins** (test DB only). This repo is public, so passwords are never
written in it: owner passwords are in `.e2e-tmp/fresh/seed-logins.json`
(git-ignored), and the super admin login is `ADMIN_EMAIL` /
`ADMIN_PASSWORD` in `server/.env.e2e` (only the lead session reads it,
never an agent).

| Business | Owner email | agent-browser session |
|---|---|---|
| Al-Noor Steel Traders | `ahmed@alnoor-steel.test` | `owner` |
| Madina Cement Depot | `tariq@madina-cement.test` | `madina` |
| Super admin | from `server/.env.e2e` | `admin` |

**Fresh test data**: `.e2e-tmp/fresh/wipe-test-db.cjs` (refuses any DB that
is not `tijaratt_test`, needs `--apply`) and `.e2e-tmp/fresh/seed-test-db.cjs`
(creates variants before purchases and passes `variantId` on lines). Both
write data, so ask first.

---

## 3. The agents

| Agent | Best for | Model |
|---|---|---|
| **Cline CLI** | Focused fixes, server logic, tests, browser test runs. Most reliable free option. | `poolside/laguna-s-2.1:free` |
| **OpenCode** | Deep analysis, multi-file fixes. Often rate limited. | `opencode/deepseek-v4.1-flash-free` |
| **Kilo Code CLI** | Fallback when OpenCode is rate limited (separate quota). | `kilo/kilo-auto/free` |
| **Freebuff** | Precise multi-file UI edits (TUI only, driven through a script). | `GPT-6 Luna`, `DeepSeek V4.1 Flash` |

### 3.1 Cline

```bash
export PATH="$PATH:/c/Users/husna/AppData/Roaming/npm"
GIT_DIR=/tmp/no-git-for-agents \
  cline -t 2700 -m poolside/laguna-s-2.1:free --json \
  "$(cat .e2e-tmp/agent-rules-base.txt .e2e-tmp/<dir>/<brief>.txt)" \
  < /dev/null > .e2e-tmp/<dir>/cline-<ID>.log 2>&1
```

- `-t` is the timeout in seconds. `--json` writes one event per line;
  `"iteration":N` in the log shows progress.
- Act mode with auto-approve is on, so it edits files and runs shell
  commands (including `agent-browser`).
- If it says "requires re-authentication": `cline auth -p cline`.
- Auto-update is disabled in `~/.cline/data/settings/global-settings.json`
  (a self-update loop once broke the login). Keep it off.
- Other free models that answer: `nvidia/nemotron-3-ultra-550b-a55b:free`,
  `nvidia/nemotron-3-super-120b-a12b:free`, `cohere/north-mini-code:free`.

### 3.2 OpenCode

```bash
GIT_DIR=/tmp/no-git-for-agents XDG_DATA_HOME="$HOME/.opencode-free" \
  opencode run --standalone --agent build --auto -m opencode/deepseek-v4.1-flash-free \
  --title "<short title>" "<brief>" < /dev/null > /tmp/<name>.txt 2>&1
```

- `XDG_DATA_HOME="$HOME/.opencode-free"` is required: that data dir has no
  stored keys, so free models run keyless (the stored keys are expired).
- `--agent plan` is read-only (analysis, reviews).
- All `opencode/*-free` models share one quota. "Rate limit exceeded" blocks
  all of them for a while: switch to Kilo.
- Several `--standalone` runs started at the same second can crash. Stagger
  starts by 5 to 8 seconds.

### 3.3 Kilo

```bash
GIT_DIR=/tmp/no-git-for-agents \
  kilo run --auto --agent code -m kilo/kilo-auto/free --title "<t>" "<brief>" < /dev/null
```

Last resort. Watch it closely.
Check that no `kilo.exe` is left running afterwards (`tasklist | grep kilo`).

### 3.4 Freebuff

Freebuff has no prompt argument, so `.e2e-tmp/freebuff/drive.js` drives
its TUI through a Windows ConPTY (`node-pty` from the global
`@openchamber/web` package):

```bash
GIT_DIR=/tmp/no-git-for-agents FREEBUFF_MODEL="GPT-6 Luna" \
  node .e2e-tmp/freebuff/drive.js run <prompt.txt> <maxMinutes> <reportPath>
node .e2e-tmp/freebuff/read.js <run-...raw.log> 80   # read the transcript
```

- The prompt file is typed as one line.
- `FREEBUFF_MODEL` must match the picker name exactly. The driver opens
  `/model`, selects it and confirms it in the status bar (exit 3 if not).
  The picker misses about half the time on the first try: retry.
- It auto-answers "Some questions for you" menus (so it never waits on the
  owner), answers "continue" up to 10 times, and confirms the wallet screen.
- Done = the report file (4th argument) exists and has not changed for
  60 seconds. Its ads keep redrawing, so "screen idle" alone may never fire;
  read the transcript instead of waiting for the driver to exit.
- Watch the "N/21 hours remaining" budget.
- It sometimes rewrites LF files as CRLF; check line endings in review.

---

### 3.5 Free models in use

Everything runs on free models; no paid key is needed. Which tool to pick
depends on the job and on which quota is still open.

| Tool | Model id | Notes |
|---|---|---|
| Cline | `poolside/laguna-s-2.1:free` | Default for fixes, tests and browser test runs. Did agents A, D, E, F, G. |
| Cline | `nvidia/nemotron-3-ultra-550b-a55b:free`, `nvidia/nemotron-3-super-120b-a12b:free` | Larger, slower; second opinion. |
| Cline | `cohere/north-mini-code:free` | Small, quick edits. |
| OpenCode | `opencode/deepseek-v4.1-flash-free` | Default for analysis and multi-file fixes (agent C, print tab). |
| OpenCode | `opencode/glm-5.3-flash-free` | Focused edits, test fixes. |
| OpenCode | `opencode/space-bunny-free` | Second opinion, parallel work. |
| OpenCode | `opencode/mimo-v2.6-flash-free`, `opencode/nemotron-3.5-*-free`, `opencode/longcat-2.5-preview-free`, `opencode/beam-free` | Other free options. |
| Kilo | `kilo/kilo-auto/free` | Picks a free model itself; separate quota from OpenCode. |
| Freebuff | `GPT-6 Luna` | Precise multi-file UI edits (agent B, customer dues tab). |
| Freebuff | `DeepSeek V4.1 Flash`, `GLM 5.3 Flash`, `Nemotron 3.5 Lightning` | Other picker names (`FREEBUFF_MODEL`). |

Not usable: Cline MiniMax and Solar Mini (paid, the Cline balance is $0).

**Finding the current free list** (models change often):

```bash
curl -s https://api.cline.bot/api/v1/ai/cline/models   # Cline: ids ending in :free
XDG_DATA_HOME="$HOME/.opencode-free" opencode models     # OpenCode: ids ending in -free
```

Freebuff shows its list in the `/model` picker inside the TUI.

**Choosing a model when launching**: Cline `-m <id>`, OpenCode `-m <id>`,
Kilo `-m kilo/kilo-auto/free`, Freebuff env `FREEBUFF_MODEL="<picker name>"`.

**Quotas**

| Quota | Shared by | When it runs out |
|---|---|---|
| OpenCode free | every `opencode/*-free` model | "Rate limit exceeded": switch to Kilo, retry OpenCode every 5 minutes in the background, switch back when it answers. |
| Kilo free | Kilo only | Use Cline. |
| Cline free | Cline `:free` models | Use OpenCode or Freebuff. |
| Freebuff | Starter plan, daily hour budget | Watch "N/21 hours remaining" in its status bar. |

---

## 4. Writing the brief

A brief is two files concatenated into the prompt:

1. **Rules**, pick one:
   - `.e2e-tmp/agent-rules-code.txt`: code and logic work (server, store,
     bugs). Fix the cause, no refactors, Decimal money, no helper files.
   - `.e2e-tmp/design/rules.txt` (same text as
     `.e2e-tmp/agent-rules-base.txt`): UI polish only. It says "keep layout
     and structure, visual pass" and carries design system v2, so do not
     use it for logic work.

   Both say: edit only ALLOWED FILES, the REPORT path is always allowed,
   never ask questions, never read env files, no git / npm install /
   servers / DB, English only, no emojis, no em dashes, self-check.
2. **Task** (`.e2e-tmp/<dir>/<ID>-<name>.txt`), with these parts:

| Part | Content |
|---|---|
| `TASK <ID>` | One line: what to change. |
| `ALLOWED FILES` | Exact paths, and their line endings (LF/CRLF). |
| What it looks like now | Measured facts: numbers, screenshots described, the exact text on screen. |
| Root cause | Verified by the lead session, with `file:line`. Agents do well with a precise spec and badly with a vague one. |
| Fix | Numbered, exact changes. Copy for every new string. What must not change. |
| Tests | Which test to add, with concrete inputs and expected numbers. |
| Self-check | `npx tsc --noEmit`, `npx eslint <files>`, `npx jest <path> --runInBand`. |
| `REPORT` | Path of the markdown report: per file before -> after, what it could not do, self-check output. |

For UI work, run the `ui-ux-pro-max` skill search first and put its
guidance (tables, row actions, empty states, phone layouts) into the brief.
Agents cannot use the skills themselves:

```bash
python ~/.claude/skills/ui-ux-pro-max/scripts/search.py "admin data table row actions empty state" --domain ux -n 5
```

For a browser test task (no code changes) list the exact steps, which
`agent-browser` session to use, which data it may change through the UI,
and how to restore it at the end (see agent E in section 7).

---

## 5. Launching and watching

1. **Clean tree first.** Commit or note your own changes, so `git diff`
   after the run shows only the agent's work. Record
   `git status --porcelain | md5sum` for read-only runs.
2. **Launch in the background** with Claude Code `run_in_background`, one
   tool call per agent, so the lead session is notified when it exits. Do
   not start agents with a shell `&`: there is no exit notification then
   (agent F had to be watched by hand). Stagger parallel launches by 5 to
   8 seconds.
3. **While it runs**, keep working on files the agent does not own. Check
   progress with `grep -o '"iteration":[0-9]*' <log> | tail -1` and the log age.
4. **Finish detection** for agents launched without a notification: a
   background loop that exits when the REPORT file is stable for 60 s or the
   log has been idle for 10 minutes.
5. **Stuck or early exit**: read the log tail and the report, then start a
   new run with the same brief plus a RESUME note (what is done, continue
   from step N, append to the same report). Killing a hung agent is a
   process kill: ask the owner first (`taskkill //PID <pid> //T //F`).

### 5.1 Monitoring and restarting

The owner wants every expired, stopped or stuck agent restarted, with
nothing else changing.

| Signal | How to see it | Meaning |
|---|---|---|
| Exit notification | Claude Code tells the lead session when a background run exits | Finished, or ended early. |
| Progress | `grep -o '"iteration":[0-9]*' <log> \| tail -1` (Cline), last `> build ·` line (OpenCode), `read.js` transcript (Freebuff) | Still working if the number grows. |
| Log age | `echo $(( $(date +%s) - $(stat -c %Y <log>) ))` seconds | Over 600 s with no report: stuck. |
| Report file | exists and stable for 60 s | Done, even if the process has not exited yet (Freebuff). |
| Repeating command | the same command in the log 3 or more times | Looping (agent E kept opening `/profit`, the real path is `/reports`). |

Watcher used for runs started without a notification:

```bash
cd .e2e-tmp/<dir>; while true; do
  if [ -f report-X.md ]; then s1=$(stat -c %s report-X.md); sleep 60
    [ "$s1" = "$(stat -c %s report-X.md)" ] && { echo "report stable"; break; }; fi
  [ $(( $(date +%s) - $(stat -c %Y cline-X.log) )) -gt 600 ] && { echo "log idle 10m"; break; }
  sleep 30; done
```

**Restart steps**

1. Read the log tail and the report to see how far it got.
2. Ended early (expired session, rate limit, timeout): start the same tool
   again, or the next tool in this order if its quota is gone: Cline ->
   OpenCode -> Kilo -> Freebuff. Same brief, plus:
   `RESUME: steps 1-4 are done (see REPORT). Continue from step 5. Append to the same report.`
3. Stuck or looping: ask the owner, kill only that run's process tree, close
   its browser session, then resume as in step 2. Add the correction to the
   brief (for example the right URL).
4. Restarts must not create junk: no new scripts, files or source edits.
   Check `git status --short` after every run.
5. Freebuff "would you like me to continue": the driver answers "continue"
   up to 10 times on its own. Its question menus are answered automatically
   so it never waits 40 minutes on a prompt again (that happened once).

### 5.2 Keeping the owner updated

- Before a run: say which agent and model gets which task and files.
- While agents run: short status lines when something changes (a finding,
  a restart, a change of plan), and on "status" a table of every agent with
  its task, progress and blockers. On long trips the owner asked for an
  update about every 30 minutes.
- After a run: what the agent changed, the review verdict and what was fixed
  by hand, test and browser results, anything not verified, and anything
  that needs the owner's yes (DB writes, process kills, push).
- Replies to the owner are in Hinglish, short, with tables and bullets, no
  em dashes and no emojis. Repo files stay in English.

### 5.3 Keeping the tools updated

- **Cline** auto-update is off on purpose
  (`~/.cline/data/settings/global-settings.json`). Update by hand with
  `npm i -g cline` only when needed, then check `cline auth -p cline` and
  one short run.
- **OpenCode / Kilo**: by hand with `npm i -g @opencode/cli` /
  `npm i -g @kilocode/cli` (the installed packages); keep using the keyless
  `XDG_DATA_HOME="$HOME/.opencode-free"` data dir for OpenCode.
- **Freebuff** (`~/.config/manicode/freebuff.exe`): when its screens change
  after an update, re-check that `drive.js` still finds the model picker,
  the question menus and the status bar (`node drive.js probe` prints the
  screen).
- **Free model lists** change: re-run the `curl` / `opencode models`
  commands in section 3.5 and update the table in this file and in
  `~/.claude/skills/use-opencode/SKILL.md`.

---

## 6. Review (never skip)

| Check | How |
|---|---|
| Scope | `git status --short`: only ALLOWED FILES changed. Delete stray helper files agents leave (seen: `fix.py`, `tsc_err.txt`, `jest-output.txt`, `_fix_*.py`). |
| Diff | Read the full diff and the code around it. Root cause fixed, or only the symptom? Same bug elsewhere? |
| Correctness | Null and empty cases, error paths, transactions and locks, money in `Decimal`. |
| Style | Matches the surrounding code. No "Fix #2" style comments. No em dashes, no emojis in copy. |
| Line endings | `git diff --stat` line counts. A whole file changing means CRLF/LF churn. Git Bash `sed -i` turns CRLF into LF; edit with node or the Edit tool instead. |
| Types and lint | `npx tsc --noEmit`; eslint on the changed files, compared with HEAD (`git stash`, eslint, `git stash pop`) so only new warnings count. |
| Tests | Run them yourself. Agent unit tests mock Prisma, so raw SQL bugs pass them: check against the test DB through the running API. |
| Browser | `agent-browser` at 1440x960 and 390x844. Screenshot and look at every changed screen and popup. |

Verdict: **approve**, **fix it yourself** when small, or **reject**
(`git checkout -- <file>` for files that were clean before) and redo with a
better brief. Tell the owner which agent did what, what review found, and
the test results.

Bugs caught in review so far: nested `<button>` in a `<button>`; a
product-scoped total still summing every line (agent D); a full-width
status filter and a tall empty activity card (agent G); mobile fixes that
broke desktop; unused imports in tests.

---

## 7. Browser testing with agent-browser

```bash
B="agent-browser --session owner"     # sessions: owner, admin, madina
$B open http://localhost:3000/al-noor-steel-traders/sales
$B snapshot -i                        # list interactive elements with @refs
$B click @e12                         # refs go stale after every click: snapshot again
$B fill @e4 "text"; $B type "<css selector>" "text"
$B eval "<js>"                        # read values, call /api/tijaratt/* (read-only)
$B set viewport 390 844               # phone; set back to 1440 960
$B screenshot --full ".e2e-tmp/<dir>/<name>.png"
```

- Re-run `snapshot -i` before every click and read the element name. A
  stale ref once clicked **Sign out** instead of Save.
- To fill a React-controlled field from `eval`, use the native value setter
  and dispatch an `input` / `change` event.
- Saving a sale, payment, product or plan writes to the test DB: ask first.
- The lead session logs the admin session in by reading `server/.env.e2e`
  into shell variables without printing them.

Example browser test brief (agent E, plan restrictions): note the current
plan of a business, create a test plan without Payments and Expenses,
assign it, sign in as that owner and check sidebar, account menu, phone
menu, direct URLs, dashboard links, reports, staff form and sales menu,
then restore the original plan and hide the test plan.

---

## 8. Finishing

1. Typecheck, lint and tests pass (client and server).
2. One commit for the finished piece, message ending with the
   `Co-Authored-By` line.
3. Report to the owner in Hinglish: what changed, which agent did what,
   what was verified and how, anything not verified, anything that needs
   their yes (DB writes, process kills, push).
4. Push only on "push it". Then watch CI and Deploy Production:

```bash
curl -s "https://api.github.com/repos/HusnainMaroof/Steel-Inventery-System-/actions/runs?per_page=4"
```

Deploy (`.github/workflows/deploy.yml`) records the running version, takes
a `pg_dump` backup, runs `prisma migrate deploy`, starts the new images,
checks readiness and rolls back on failure.

---

## 9. Files

| Path | What |
|---|---|
| `.e2e-tmp/` | Git-ignored workspace: briefs, logs, reports, screenshots, scripts. Not in a fresh clone: copy the rules files, `freebuff/` and `fresh/` to a new machine by hand. |
| `.e2e-tmp/agent-rules-code.txt` | Rules for code and logic agents. |
| `.e2e-tmp/agent-rules-base.txt` | Same text as `design/rules.txt` (UI rules). |
| `.e2e-tmp/design/rules.txt` | UI agent rules + design system v2. |
| `.e2e-tmp/freebuff/drive.js`, `read.js`, `screen.js` | Freebuff driver and transcript reader. |
| `.e2e-tmp/fresh/` | Test DB wipe and seed scripts, seed logins (with passwords). |
| `~/.claude/skills/use-opencode/SKILL.md` | The same workflow as a Claude Code skill. |
