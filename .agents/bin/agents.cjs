#!/usr/bin/env node
/*
 * Supervisor CLI for free coding agents (see .agents/AGENTS.md).
 *
 *   node .agents/bin/agents.cjs new <id> "<title>"          run folder + plan/brief/review templates
 *   node .agents/bin/agents.cjs models [--refresh]          live free models (tier, cooldown)
 *   node .agents/bin/agents.cjs route <profile> [--worktree] ranked models for a profile, with reasons
 *   node .agents/bin/agents.cjs worktree <id>               isolated git worktree for the run
 *   node .agents/bin/agents.cjs launch <id> <profile> [--model tool:model] [--resume] [--no-fallback]
 *   node .agents/bin/agents.cjs score <id> <0-100> [note]   record the review score (router learns)
 *   node .agents/bin/agents.cjs scorecard                   runs / approvals / average per model
 *   node .agents/bin/agents.cjs watch <id> [--once]         stuck detector
 *   node .agents/bin/agents.cjs check <id>                  automated review checks -> check.md
 *   node .agents/bin/agents.cjs apply <id>                  worktree diff -> patch.diff -> main tree
 *   node .agents/bin/agents.cjs cleanup <id>                remove the worktree safely
 *   node .agents/bin/agents.cjs status                      every run and its last event
 *
 * Runs live in .e2e-tmp/runs/<id>/ (git-ignored). Every step appends to events.jsonl,
 * so a run can always be explained and resumed.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const REPO = path.resolve(__dirname, "..", "..");
const AGENTS = path.join(REPO, ".agents");
const RUNS = path.join(REPO, ".e2e-tmp", "runs");
const WT_ROOT = path.resolve(REPO, "..", "inventry-wt");
const NPM_BIN = "/c/Users/husna/AppData/Roaming/npm";
const FAKE_GIT = "/tmp/no-git-for-agents";

const [cmd, ...args] = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] ?? true : undefined;
};
const die = (msg) => {
  console.error(`agents: ${msg}`);
  process.exit(1);
};
const runDir = (id) => {
  if (!id) die("missing run id");
  return path.join(RUNS, id);
};
const now = () => new Date().toISOString();
const event = (id, type, data = {}) =>
  fs.appendFileSync(path.join(runDir(id), "events.jsonl"), JSON.stringify({ t: now(), type, ...data }) + "\n");
const readEvents = (id) => {
  const f = path.join(runDir(id), "events.jsonl");
  return fs.existsSync(f)
    ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
};
const git = (cwd, ...a) => spawnSync("git", a, { cwd, encoding: "utf8" });
const bash = (script, opts = {}) => spawnSync("bash", ["-c", script], { encoding: "utf8", ...opts });
const toWin = (p) => p.replace(/\//g, "\\");

/* ---- profiles: .agents/agents/<name>.md, YAML-like frontmatter + markdown body ---- */
function loadProfile(name) {
  const file = path.join(AGENTS, "agents", `${name}.md`);
  if (!fs.existsSync(file)) die(`no profile ${name} (see .agents/agents/)`);
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) die(`profile ${name} has no frontmatter`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    meta[kv[1]] = v;
  }
  return { ...meta, body: m[2].trim() };
}

/* ---- tool command lines (all run under bash with git disabled) ---- */
function toolCommand({ tool, model, mode, promptFile, logFile, minutes, title, reportFile }) {
  const prompt = `"$(cat '${promptFile}')"`;
  const log = `> '${logFile}' 2>&1`;
  switch (tool) {
    case "cline":
      return `cline -t ${minutes * 60} -m ${model} --json ${prompt} < /dev/null ${log}`;
    case "opencode": {
      const agent = mode === "readonly" ? "--agent plan" : "--agent build --auto";
      return `XDG_DATA_HOME="$HOME/.opencode-free" opencode run --standalone ${agent} -m ${model} --title '${title}' ${prompt} < /dev/null ${log}`;
    }
    case "kilo": {
      const agent = mode === "readonly" ? "--agent plan" : "--auto --agent code";
      return `kilo run ${agent} -m ${model} --title '${title}' ${prompt} < /dev/null ${log}`;
    }
    case "freebuff": {
      const driver = path.join(REPO, ".e2e-tmp", "freebuff", "drive.js").replace(/\\/g, "/");
      if (!fs.existsSync(driver)) die("Freebuff driver missing: copy .e2e-tmp/freebuff/ to this machine");
      return `FREEBUFF_MODEL='${model}' node '${driver}' run '${promptFile}' ${minutes} '${reportFile}' ${log}`;
    }
    default:
      die(`unknown tool ${tool}`);
  }
}

/* ---- allowed files from brief.md: lines "- path" under "## Allowed files" ---- */
function allowedFiles(id) {
  const brief = fs.readFileSync(path.join(runDir(id), "brief.md"), "utf8").replace(/\r\n/g, "\n");
  const sec = brief.split(/\n## /).find((s) => /^Allowed files/i.test(s));
  if (!sec) return [];
  return sec
    .split("\n")
    .map((l) => l.match(/^\s*-\s*`?([^`\s]+)`?/))
    .filter(Boolean)
    .map((m) => m[1].replace(/\\/g, "/"))
    .filter((p) => p.includes("/") || p.includes("."));
}

/* ================= dynamic model routing (after OpenHands RouterLLM) =================
 * Profiles never name a model. At launch the router ranks every free model that is
 * live right now (models.json, refreshed from the tools daily), fits the profile's
 * mode and tier, and is not cooling down after a failure (health.json), by its
 * track record in scorecard.json for that task type. */
const STATE = path.join(REPO, ".e2e-tmp", "agents-state");
const ROUTER = JSON.parse(fs.readFileSync(path.join(AGENTS, "router.json"), "utf8"));
const SCORE_FILE = path.join(AGENTS, "scorecard.json");
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };
const excluded = (m) => ROUTER.exclude.some((p) => new RegExp(p, "i").test(m));
const tierOf = (m) =>
  ROUTER.tiers.strong.some((p) => m.includes(p)) ? "strong" : ROUTER.tiers.light.some((p) => m.includes(p)) ? "light" : "unknown";

function refreshModels() {
  const env = `export PATH="$PATH:${NPM_BIN}";`;
  const found = [];
  const cline = bash(`curl -s --max-time 30 https://api.cline.bot/api/v1/ai/cline/models`).stdout;
  for (const id of new Set(cline.match(/"[a-z0-9._/-]+:free"/gi) || [])) found.push({ tool: "cline", model: id.slice(1, -1) });
  const oc = bash(`${env} XDG_DATA_HOME="$HOME/.opencode-free" timeout 120 opencode models`).stdout;
  for (const l of oc.split("\n").map((s) => s.trim())) if (/(-free|:free)$/.test(l)) found.push({ tool: "opencode", model: l });
  const kilo = bash(`${env} timeout 120 kilo models`).stdout;
  for (const l of kilo.split("\n").map((s) => s.trim())) if (/^kilo\/.*free$/.test(l)) found.push({ tool: "kilo", model: l });
  for (const m of ROUTER.static_models.freebuff) found.push({ tool: "freebuff", model: m, source: "static" });
  const models = found.filter((x) => !excluded(x.model)).map((x) => ({ ...x, tier: tierOf(x.model) }));
  const reg = { refreshed: now(), models, excluded: found.filter((x) => excluded(x.model)).map((x) => `${x.tool}:${x.model}`) };
  writeJson(path.join(STATE, "models.json"), reg);
  return reg;
}
function loadModels(force) {
  const reg = readJson(path.join(STATE, "models.json"), null);
  if (force || !reg || Date.now() - Date.parse(reg.refreshed) > 24 * 3600 * 1000) return refreshModels();
  return reg;
}
const health = () => readJson(path.join(STATE, "health.json"), {});
function markHealth(key, reason) {
  const h = health();
  const mins = ROUTER.cooldown_minutes[reason] ?? 15;
  h[key] = { reason, until: new Date(Date.now() + mins * 60000).toISOString() };
  writeJson(path.join(STATE, "health.json"), h);
}
const attemptsOf = () => readJson(SCORE_FILE, { attempts: [] }).attempts;
// Expected review score (0..1), shrunk toward a prior so one lucky or unlucky run
// does not dominate: (sum of scores + prior * k) / (runs + k). Untested models get
// exactly the prior, so proven models rank above them and they still get a chance.
const expected = (rows) => {
  const { prior, prior_weight: k } = ROUTER.estimate;
  return (rows.reduce((s, r) => s + r.score / 100, 0) + prior * k) / (rows.length + k);
};

function route(p, { worktree = false } = {}) {
  const w = ROUTER.weights;
  const mode = p.mode || "edit";
  const h = health();
  const all = attemptsOf();
  const prefer = Array.isArray(p.prefer) ? p.prefer : p.prefer ? [p.prefer] : [];
  const out = [];
  for (const m of loadModels().models) {
    const key = `${m.tool}:${m.model}`;
    const tool = ROUTER.tools[m.tool];
    if (!tool || !tool.modes.includes(mode)) continue;
    if (worktree && !tool.worktree) continue;
    if (p.tier === "strong" && m.tier !== "strong") continue;
    const cool = h[key] && Date.parse(h[key].until) > Date.now() ? h[key] : null;
    if (cool) continue;
    const mine = all.filter((a) => `${a.tool}:${a.model}` === key);
    const task = mine.filter((a) => a.task_type === p.task_type);
    const recentFail = mine.slice(-2).filter((a) => a.score < 60).length;
    const rank = prefer.indexOf(m.tool);
    const score =
      w.task * expected(task) +
      w.overall * expected(mine) +
      (rank >= 0 ? w.prefer_tool_bonus / (rank + 1) : 0) +
      (m.tier === "strong" ? w.strong_tier_bonus : 0) -
      recentFail * w.recent_failure_penalty;
    out.push({ key, tool: m.tool, model: m.model, tier: m.tier, score: +score.toFixed(3),
      why: `${task.length} ${p.task_type} runs, ${mine.length} total, tier ${m.tier}${prefer.includes(m.tool) ? ", preferred tool" : ""}${recentFail ? `, ${recentFail} recent fail` : ""}` });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* failure class from an agent log, for cooldowns and automatic fallback */
function failureOf(log, minutes, report) {
  const t = fs.existsSync(log) ? fs.readFileSync(log, "utf8").slice(-30000) : "";
  if (/rate.?limit|429|quota exceeded|too many requests/i.test(t)) return "rate_limit";
  if (/re-?authenticat|unauthori[sz]ed|\b401\b|invalid api key|not logged in/i.test(t)) return "auth";
  if (/model not found|unknown model|no such model|model .* is not available/i.test(t)) return "not_found";
  if (!report && minutes < 2) return "crash";
  return null;
}

const worktreePath = (id) => path.join(WT_ROOT, id);
const workBase = (id) => (fs.existsSync(worktreePath(id)) ? worktreePath(id) : REPO);

/* ================= commands ================= */
const commands = {
  new() {
    const [id, title = id] = args;
    const dir = runDir(id);
    if (fs.existsSync(dir)) die(`run ${id} exists`);
    fs.mkdirSync(dir, { recursive: true });
    for (const t of ["plan.md", "brief.md", "review.md"]) {
      const src = fs.readFileSync(path.join(AGENTS, "templates", t), "utf8");
      fs.writeFileSync(path.join(dir, t), src.replace(/\{\{ID\}\}/g, id).replace(/\{\{TITLE\}\}/g, title));
    }
    event(id, "created", { title });
    console.log(`run ${id}: ${path.relative(REPO, dir)} (plan.md, brief.md, review.md)`);
  },

  worktree() {
    const [id] = args;
    runDir(id);
    const wt = worktreePath(id);
    if (fs.existsSync(wt)) die(`worktree exists: ${wt}`);
    fs.mkdirSync(WT_ROOT, { recursive: true });
    const r = git(REPO, "worktree", "add", "--detach", wt, "HEAD");
    if (r.status !== 0) die(r.stderr);
    // share installed packages through junctions (no install, no copy)
    for (const pkg of ["client", "server"]) {
      const link = toWin(path.join(wt, pkg, "node_modules"));
      const target = toWin(path.join(REPO, pkg, "node_modules"));
      const j = spawnSync("cmd", ["/c", "mklink", "/J", link, target], { encoding: "utf8" });
      if (j.status !== 0) die(`junction failed: ${j.stderr || j.stdout}`);
    }
    event(id, "worktree", { path: wt, head: git(REPO, "rev-parse", "--short", "HEAD").stdout.trim() });
    console.log(`worktree for ${id}: ${wt} (no .env files inside; node_modules linked)`);
  },

  launch() {
    const [id, profileName] = args;
    const dir = runDir(id);
    if (!profileName) die("usage: launch <id> <profile> [--model tool:model] [--resume] [--no-fallback]");
    const p = loadProfile(profileName);
    const base = workBase(id);
    const inWorktree = base !== REPO;
    const override = flag("--model");
    const candidates = override
      ? [(([tool, model]) => ({ tool, model, why: "chosen by the supervisor" }))(String(override).split(/:(.+)/))]
      : route(p, { worktree: inWorktree });
    if (!candidates.length) die(`no free model fits ${profileName} right now (all cooling down or excluded): run "models --refresh" or pass --model`);
    const maxTries = args.includes("--no-fallback") || override ? 1 : 1 + ROUTER.max_auto_fallbacks;
    const reportFile = path.join(dir, "report.md").replace(/\\/g, "/");
    const rules = fs.readFileSync(path.join(AGENTS, "rules", `${p.rules || "code"}.txt`), "utf8");
    const brief = fs.readFileSync(path.join(dir, "brief.md"), "utf8");
    const critique = path.join(dir, "critique.md");
    const minutes = Number(p.max_minutes || 45);

    const tryLaunch = (i) => {
      const { tool, model, why } = candidates[i];
      const attempt = readEvents(id).filter((e) => e.type === "launch").length + 1;
      const parts = [
        rules.trim(),
        `ROLE (${p.name}):\n${p.body}`,
        `WORKSPACE: ${base.replace(/\\/g, "/")} (work only inside it).\nREPORT: ${reportFile}`,
        brief.trim(),
      ];
      if (args.includes("--resume") && fs.existsSync(critique)) {
        parts.push(`RESUME (attempt ${attempt}): your last attempt was reviewed. Fix every point in ${critique.replace(/\\/g, "/")}, keep what was approved, and append a "## Attempt ${attempt}" section to the same REPORT.`);
      }
      const promptFile = path.join(dir, `prompt-${attempt}.txt`).replace(/\\/g, "/");
      fs.writeFileSync(promptFile, parts.join("\n\n") + "\n");
      const logFile = path.join(dir, `${tool}-${attempt}.log`).replace(/\\/g, "/");
      const line = toolCommand({
        tool, model, mode: p.mode, promptFile, logFile, minutes,
        title: `${id}-${profileName}`.slice(0, 60), reportFile,
      });
      const script = `export PATH="$PATH:${NPM_BIN}"; export GIT_DIR=${FAKE_GIT}; cd '${base.replace(/\\/g, "/")}' && ${line}`;
      event(id, "launch", { attempt, profile: profileName, task_type: p.task_type, tool, model, why, base, log: logFile });
      console.log(`launch ${id} #${attempt}: ${profileName} -> ${tool}:${model} (${why})`);
      const started = Date.now();
      const child = spawn("bash", ["-c", script], { stdio: "inherit" });
      child.on("exit", (code) => {
        // OpenCode / Kilo read-only ("plan") agents cannot write files: their answer is the
        // text after the last agent header in the log, so save that as the report.
        if (!fs.existsSync(reportFile) && p.mode === "readonly" && (tool === "opencode" || tool === "kilo") && fs.existsSync(logFile)) {
          const text = fs.readFileSync(logFile, "utf8").replace(/\x1b\[[0-9;]*m/g, "");
          const parts = text.split(/^> (?:plan|build|code|ask) · .*$/m);
          const answer = parts.length > 1 ? parts[parts.length - 1].trim() : "";
          if (answer.length > 40) fs.writeFileSync(reportFile, `# Report ${id} (saved from the ${tool} log)\n\n${answer}\n`);
        }
        const report = fs.existsSync(reportFile);
        const mins = +((Date.now() - started) / 60000).toFixed(1);
        const failure = report ? null : failureOf(logFile, mins, report);
        event(id, "exit", { attempt, code, minutes: mins, report, failure });
        console.log(`exit ${id} #${attempt}: code ${code}, ${mins} min, report ${report ? "written" : "MISSING"}${failure ? `, failure ${failure}` : ""}`);
        if (failure) markHealth(`${tool}:${model}`, failure);
        if (failure && i + 1 < Math.min(maxTries, candidates.length)) {
          event(id, "fallback", { from: `${tool}:${model}`, reason: failure, to: `${candidates[i + 1].tool}:${candidates[i + 1].model}` });
          console.log(`fallback: ${failure} on ${tool}:${model}, trying ${candidates[i + 1].tool}:${candidates[i + 1].model}`);
          return tryLaunch(i + 1);
        }
        process.exit(code ?? 1);
      });
    };
    tryLaunch(0);
  },

  models() {
    const reg = loadModels(args.includes("--refresh"));
    const h = health();
    console.log(`free models (refreshed ${reg.refreshed}):`);
    for (const m of reg.models) {
      const key = `${m.tool}:${m.model}`;
      const cool = h[key] && Date.parse(h[key].until) > Date.now() ? `  cooling (${h[key].reason}) until ${h[key].until.slice(11, 16)}` : "";
      console.log(`  ${m.tier.padEnd(7)} ${key}${cool}`);
    }
    console.log(`excluded by router.json: ${reg.excluded.length}`);
  },

  route() {
    const [profileName] = args;
    if (!profileName) die("usage: route <profile> [--worktree]");
    const p = loadProfile(profileName);
    const ranked = route(p, { worktree: args.includes("--worktree") });
    console.log(`route ${profileName} (task ${p.task_type}, mode ${p.mode}, tier ${p.tier || "any"}):`);
    ranked.slice(0, Number(flag("--top") || 6)).forEach((c, i) => console.log(`  ${i + 1}. ${c.score.toFixed(3)}  ${c.key}  (${c.why})`));
  },

  score() {
    const [id, value, ...note] = args;
    const s = Number(value);
    if (!id || !Number.isFinite(s)) die("usage: score <id> <0-100> [note]");
    const launches = readEvents(id).filter((e) => e.type === "launch");
    const l = launches[launches.length - 1];
    if (!l) die("no launch to score");
    const verdict = s >= 90 ? "approve" : s >= 60 ? "refine" : "reroute";
    const data = readJson(SCORE_FILE, { attempts: [] });
    data.attempts.push({ t: now().slice(0, 10), run: id, attempt: l.attempt, profile: l.profile, task_type: l.task_type, tool: l.tool, model: l.model, score: s, verdict, note: note.join(" ") });
    writeJson(SCORE_FILE, data);
    event(id, "score", { attempt: l.attempt, score: s, verdict });
    console.log(`scored ${id} #${l.attempt} (${l.tool}:${l.model}): ${s} -> ${verdict}`);
  },

  scorecard() {
    const rows = attemptsOf();
    const by = {};
    for (const a of rows) (by[`${a.tool}:${a.model}`] ||= []).push(a);
    console.log("tool:model                                         runs  approve  avg  task types");
    for (const [k, list] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
      const avg = list.reduce((x, a) => x + a.score, 0) / list.length;
      const ok = list.filter((a) => a.score >= 90).length;
      console.log(`${k.padEnd(50)} ${String(list.length).padStart(4)}  ${String(ok).padStart(7)}  ${avg.toFixed(0).padStart(3)}  ${[...new Set(list.map((a) => a.task_type))].join(", ")}`);
    }
  },

  watch() {
    const [id] = args;
    const dir = runDir(id);
    const once = args.includes("--once");
    let lastSize = -1;
    let stableSince = 0;
    const tick = () => {
      const launches = readEvents(id).filter((e) => e.type === "launch");
      if (!launches.length) die("no launch yet");
      const { log } = launches[launches.length - 1];
      const text = fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
      const age = fs.existsSync(log) ? (Date.now() - fs.statSync(log).mtimeMs) / 1000 : 0;
      const verdicts = stuckPatterns(text);
      const report = path.join(dir, "report.md");
      let reportState = "none";
      if (fs.existsSync(report)) {
        const size = fs.statSync(report).size;
        // first look: trust the file's own modified time; later looks: size changes
        if (lastSize === -1) { lastSize = size; stableSince = fs.statSync(report).mtimeMs; }
        else if (size !== lastSize) { lastSize = size; stableSince = Date.now(); }
        reportState = (Date.now() - stableSince) / 1000 >= 60 ? "stable" : "changing";
      }
      const iter = (text.match(/"iteration":(\d+)/g) || []).pop();
      const status = { logAgeSec: Math.round(age), iteration: iter ? iter.split(":")[1] : "?", report: reportState, stuck: verdicts };
      if (once) return console.log(JSON.stringify(status, null, 1));
      let reason = null;
      if (reportState === "stable") reason = "report stable 60s (done)";
      else if (age > 600) reason = "log idle 10 min (stuck or finished without report)";
      else if (verdicts.length) reason = `stuck: ${verdicts.join("; ")}`;
      if (reason) {
        event(id, "watch", { reason, ...status });
        console.log(`watch ${id}: ${reason}`);
        process.exit(0);
      }
      setTimeout(tick, 30000);
    };
    tick();
  },

  check() {
    const [id] = args;
    const dir = runDir(id);
    const base = workBase(id);
    const out = [];
    const st = git(base, "status", "--porcelain").stdout.split("\n").filter(Boolean);
    const changed = st.map((l) => ({ code: l.slice(0, 2).trim(), file: l.slice(3).trim().replace(/^"|"$/g, "") }));
    const allowed = allowedFiles(id);
    out.push(`# Check ${id}\n\nWorkspace: \`${base}\`\n`);
    out.push(`## Scope\n`);
    let fail = 0;
    for (const c of changed) {
      const ok = allowed.some((a) => c.file === a || c.file.startsWith(a.endsWith("/") ? a : a + "/"));
      const stray = c.code === "??" && !ok;
      if (!ok) fail++;
      out.push(`- ${ok ? "OK  " : stray ? "STRAY" : "OUT "} ${c.code} ${c.file}`);
    }
    if (!changed.length) out.push("- (no changes)");
    out.push(`\nAllowed: ${allowed.join(", ") || "(none listed in brief.md)"}\n`);

    out.push(`## Line endings\n`);
    for (const c of changed.filter((x) => x.code !== "??" && x.code !== "D")) {
      const ns = git(base, "diff", "--numstat", "--", c.file).stdout.trim().split(/\s+/);
      const lines = fs.existsSync(path.join(base, c.file)) ? fs.readFileSync(path.join(base, c.file), "utf8").split("\n").length : 0;
      const touched = Number(ns[1] || 0);
      if (lines > 40 && touched > lines * 0.8) { fail++; out.push(`- CHURN ${c.file}: ${touched}/${lines} lines removed (CRLF/LF rewrite?)`); }
    }
    out.push("- checked\n");

    const files = changed.filter((c) => c.code !== "D").map((c) => c.file);
    const clientTs = files.filter((f) => /^client\/src\/.*\.(ts|tsx)$/.test(f));
    const serverTs = files.filter((f) => /^server\/src\/.*\.ts$/.test(f));
    const run = (label, cwd, script) => {
      const r = bash(script, { cwd, maxBuffer: 1 << 26 });
      const tail = (r.stdout + r.stderr).trim().split("\n").slice(-12).join("\n");
      if (r.status !== 0) fail++;
      out.push(`## ${label}: ${r.status === 0 ? "PASS" : "FAIL"}\n\n\`\`\`\n${tail || "(no output)"}\n\`\`\`\n`);
    };
    if (clientTs.length) {
      run("client tsc", path.join(base, "client"), "npx tsc --noEmit");
      // eslint now vs the same files at HEAD (via stdin), so only new problems count
      const rel = clientTs.map((f) => f.replace(/^client\//, ""));
      const count = (s) => { const m = s.match(/(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/); return m ? { e: +m[2], w: +m[3] } : { e: 0, w: 0 }; };
      let now = { e: 0, w: 0 }, before = { e: 0, w: 0 };
      for (const f of rel) {
        const a = count(bash(`npx eslint '${f}'`, { cwd: path.join(base, "client") }).stdout);
        const head = git(REPO, "show", `HEAD:client/${f}`);
        const b = head.status === 0
          ? count(spawnSync("bash", ["-c", `npx eslint --stdin --stdin-filename '${f}'`], { cwd: path.join(REPO, "client"), input: head.stdout, encoding: "utf8" }).stdout)
          : { e: 0, w: 0 };
        now = { e: now.e + a.e, w: now.w + a.w }; before = { e: before.e + b.e, w: before.w + b.w };
      }
      const worse = now.e > before.e || now.w > before.w;
      if (worse) fail++;
      out.push(`## client eslint: ${worse ? "FAIL" : "PASS"}\n\nnow ${now.e} errors / ${now.w} warnings, HEAD ${before.e} / ${before.w}\n`);
    }
    if (serverTs.length) {
      run("server tsc", path.join(base, "server"), "npx tsc --noEmit -p tsconfig.json");
      const dirs = [...new Set(serverTs.map((f) => path.posix.dirname(f.replace(/^server\//, ""))))];
      run("server jest (changed folders)", path.join(base, "server"), `npx jest ${dirs.join(" ")} --runInBand --passWithNoTests`);
    }
    out.unshift(`RESULT: ${fail ? `${fail} problem(s)` : "all automated checks pass"}\n`);
    fs.writeFileSync(path.join(dir, "check.md"), out.join("\n"));
    event(id, "check", { problems: fail });
    console.log(`check ${id}: ${fail ? `${fail} problem(s)` : "PASS"} -> ${path.relative(REPO, path.join(dir, "check.md"))}`);
  },

  apply() {
    const [id] = args;
    const dir = runDir(id);
    const wt = worktreePath(id);
    if (!fs.existsSync(wt)) die("no worktree for this run (in-place runs need no apply)");
    git(wt, "add", "-A", "--", ".", ":!client/node_modules", ":!server/node_modules");
    const diff = git(wt, "diff", "--cached", "--binary", "HEAD");
    const patch = path.join(dir, "patch.diff");
    fs.writeFileSync(patch, diff.stdout);
    if (!diff.stdout.trim()) die("worktree has no changes");
    const r = git(REPO, "apply", "--3way", patch);
    event(id, "apply", { ok: r.status === 0, patch });
    if (r.status !== 0) die(`apply failed:\n${r.stderr}`);
    // --3way applies through the index, so the change arrives STAGED
    console.log(`applied ${id} to the main tree and STAGED it: review with "git diff --cached"; undo with "git restore --staged --worktree --source=HEAD -- <files>".`);
  },

  cleanup() {
    const [id] = args;
    const wt = worktreePath(id);
    if (!fs.existsSync(wt)) die("no worktree");
    // remove the junctions FIRST: removing the worktree through a junction would delete the real node_modules
    for (const pkg of ["client", "server"]) {
      const link = toWin(path.join(wt, pkg, "node_modules"));
      if (fs.existsSync(link)) spawnSync("cmd", ["/c", "rmdir", link]);
    }
    const r = git(REPO, "worktree", "remove", "--force", wt);
    git(REPO, "worktree", "prune");
    event(id, "cleanup", { ok: r.status === 0 });
    console.log(r.status === 0 ? `worktree removed: ${wt}` : `remove failed: ${r.stderr}`);
  },

  status() {
    if (!fs.existsSync(RUNS)) return console.log("no runs");
    for (const id of fs.readdirSync(RUNS).sort()) {
      const ev = readEvents(id);
      const last = ev[ev.length - 1];
      const launches = ev.filter((e) => e.type === "launch");
      const l = launches[launches.length - 1];
      console.log(`${id.padEnd(28)} ${last ? `${last.type} ${last.t.slice(0, 16)}` : "-"}  ${l ? `${l.profile} ${l.tool}:${l.model} #${l.attempt}` : ""}`);
    }
  },
};

/* ---- stuck patterns (after OpenHands StuckDetector) over the agent log ---- */
function stuckPatterns(text) {
  const found = [];
  const calls = [...text.matchAll(/"(?:command|query|path)":"((?:[^"\\]|\\.){4,300})"/g)].map((m) => m[1]);
  const tail = calls.slice(-12);
  const counts = {};
  for (const c of tail) counts[c] = (counts[c] || 0) + 1;
  const rep = Object.entries(counts).find(([, n]) => n >= 4);
  if (rep) found.push(`same call ${rep[1]}x: ${rep[0].slice(0, 80)}`);
  const errs = [...text.matchAll(/"(?:error|message)":"([^"]*(?:error|Error|failed|not found)[^"]{0,120})"/g)].map((m) => m[1]).slice(-10);
  const ec = {};
  for (const e of errs) ec[e] = (ec[e] || 0) + 1;
  const er = Object.entries(ec).find(([, n]) => n >= 3);
  if (er) found.push(`same error ${er[1]}x: ${er[0].slice(0, 80)}`);
  if (tail.length >= 12) {
    const a = tail.slice(-12);
    const pingpong = a.every((c, i) => c === a[i % 2]) && a[0] !== a[1];
    if (pingpong) found.push("alternating between two calls 6+ cycles");
  }
  if (/context (window|length)|maximum context/i.test(text.slice(-20000))) found.push("context window errors");
  return found;
}

if (!commands[cmd]) {
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
  process.exit(cmd ? 1 : 0);
}
commands[cmd]();
