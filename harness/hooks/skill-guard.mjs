#!/usr/bin/env node
// skill-guard — phase/role-aware PreToolUse guardrails for the design-it / code-it / ship-it /
// release-it pipeline. One script, dispatched by argv[2]:
//
//   phase <design|code|ship|release>   set the active phase (survives Stop; expires after
//   phase clear                       settings.phase_stale_seconds)
//   red <test-file>                    mark a slice red (a failing test exists)
//   green                              clear the red marker (slice accepted)
//   status                             print the phase/red state and recent decisions
//   check   (PreToolUse × Bash|Edit|Write|MultiEdit|…)   allow (exit 0) or block (exit 2)
//
// A call is denied if EITHER the active phase's rules deny it OR the active agent_type role's
// rules deny it — a union, not "one beats the other". Policy lives in skill-guard.json next to
// this file. SKILL_GUARD_OFF=1 disables all checks. Every "check" decision is appended to
// .claude/skill-guard/log — fail-open stays the default on any read error, but it's no longer
// silent.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} HookPayload
 * @property {string} [cwd]
 * @property {string} [tool_name]
 * @property {string} [agent_type]
 * @property {{skill?: string, file_path?: string, notebook_path?: string, command?: string}} [tool_input]
 */
/**
 * @typedef {object} GuardRules
 * @property {string[]} [deny_write]
 * @property {string[]} [deny_bash]
 * @property {boolean} [tdd]
 * @property {string} reason
 */
/**
 * @typedef {object} Policy
 * @property {{phase_stale_seconds?: number, red_stale_seconds?: number}} [settings]
 * @property {Record<string, GuardRules>} [phases]
 * @property {Record<string, GuardRules>} [roles]
 */

const sub = process.argv[2];
const HERE = dirname(fileURLToPath(import.meta.url));

const ok = () => process.exit(0);
/** @param {string} msg */
const deny = (msg) => {
  process.stderr.write(`skill-guard: ${msg}\n`);
  process.exit(2);
};

if (process.env.SKILL_GUARD_OFF) ok();

/** @type {HookPayload} */
let payload = {};
if (sub === "check") {
  // Only the PreToolUse check consumes a stdin payload. The phase/red/green/status
  // sub-commands must not touch stdin: a JSON.parse throw on inherited pipe data would hit the
  // catch below and exit 0 before the dispatch further down — the marker silently never written,
  // the guardrail inert for the rest of the run.
  try {
    payload = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    ok(); // unreadable payload — fail open
  }
}

/**
 * Walk up from `start` to the nearest directory holding a `.git` — the project root — so the
 * phase file and the `^src/` / `^test/` anchors resolve correctly from a subdirectory session.
 * The walk stops at the home directory: a not-yet-`git init`'d card under a dotfiles/monorepo
 * repo must not resolve to that outer root (shared state, wrong anchors). Falls back to `start`.
 * @param {string} start
 */
function findProjectRoot(start) {
  const home = resolve(homedir());
  let dir = resolve(start);
  while (dir !== home) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

/**
 * A tab-separated `<value>\t<epoch-ms>` marker is "fresh" when the timestamp parses and is
 * within `staleMs` of now. A malformed line (no tab, truncated write) parses to NaN — treated
 * as not-fresh, but noisily, so a dropped guard isn't silent.
 * @param {[string, string] | null} state
 * @param {number} staleMs
 */
function markerFresh(state, staleMs) {
  if (!state) return false;
  const ts = Number(state[1]);
  if (!Number.isFinite(ts)) {
    process.stderr.write(
      `skill-guard: malformed marker (${JSON.stringify(state[0])}) — ignoring\n`
    );
    return false;
  }
  return Date.now() - ts < staleMs;
}

/** @type {Policy} */
let policy = {};
try {
  policy = JSON.parse(readFileSync(join(HERE, "skill-guard.json"), "utf8"));
} catch (e) {
  // A broken policy file must not throw (Node would exit 1, which Claude Code treats as
  // non-blocking — the guard would be off and unlogged). Fail open, but say so.
  process.stderr.write(`skill-guard: policy unreadable, allowing — ${e}\n`);
  ok();
}
const phaseStaleMs = (policy.settings?.phase_stale_seconds ?? 28800) * 1000;
const redStaleMs = (policy.settings?.red_stale_seconds ?? 1800) * 1000;

const cwd = findProjectRoot(payload.cwd || process.cwd());
const stateDir = join(cwd, ".claude", "skill-guard");
const phaseFile = join(stateDir, "phase");
const redFile = join(stateDir, "red");
const logFile = join(stateDir, "log");

function ensureStateDir() {
  mkdirSync(stateDir, { recursive: true });
  try {
    writeFileSync(join(stateDir, ".gitignore"), "*\n", { flag: "wx" });
  } catch {}
}

/**
 * @param {string} phase
 * @param {string} role
 * @param {string} tool
 * @param {"allow" | "deny"} verdict
 * @param {string} reason
 */
function logDecision(phase, role, tool, verdict, reason) {
  try {
    ensureStateDir();
    const line = `${new Date().toISOString()}\t${phase}\t${role}\t${tool}\t${verdict}\t${reason}\n`;
    appendFileSync(logFile, line);
  } catch {}
}

/** @param {string} file */
function readTabbed(file) {
  try {
    const raw = readFileSync(file, "utf8").trim().split("\t");
    return /** @type {[string, string]} */ ([raw[0], raw[1]]);
  } catch {
    return null;
  }
}

function isRed() {
  return markerFresh(readTabbed(redFile), redStaleMs);
}

/** Strip git's global options — anything valid between `git` and the subcommand — so
 * `git -C /x --no-pager commit` reads as `git commit` for subcommand matching. The two
 * separate-value short flags (`-C path`, `-c k=v`) are matched explicitly; every long flag is
 * caught by a generic `--flag` / `--flag=value` alternative, so an option this list has never
 * heard of still can't shift the subcommand past the deny check. */
/** @param {string} cmd */
function stripGitGlobalFlags(cmd) {
  const value = `(?:"[^"]*"|'[^']*'|\\S+)`;
  const opt =
    `(?:\\s+-C\\s+${value}` + // -C <path>
    `|\\s+-c\\s+\\S+?=${value}` + // -c <key>=<value>
    `|\\s+--(?:git-dir|work-tree|namespace|exec-path|super-prefix|attr-source|config-env)(?:=|\\s+)${value}` +
    `|\\s+-[Pp]` + // -P / -p
    `|\\s+--[a-z][a-z-]*(?:=${value})?)+`; // any other long flag, bare or --flag=value
  return cmd.replace(new RegExp(`\\bgit${opt}`, "g"), "git");
}

/** Blank quoted spans before subcommand matching. A deny word inside any quoted argument — a
 * commit message, a `gh pr --body`, an `echo` string — is prose, not a command, and must not
 * trip the guard. A `$(…)` the shell runs sits *outside* quotes and is still caught by the `(`
 * command-position anchor. Runs after stripGitGlobalFlags, which needs quotes for `-C "a b"`. */
/** @param {string} cmd */
function stripQuotedSpans(cmd) {
  return cmd.replace(/"[^"]*"|'[^']*'/g, " ");
}

/**
 * realpathSync tolerant of a path that doesn't exist yet (a file being created): walks up to the
 * nearest existing ancestor, resolves that, and reattaches the not-yet-created segments.
 * @param {string} absPath
 */
function realpathTolerant(absPath) {
  /** @type {string[]} */
  const pending = [];
  let dir = absPath;
  for (;;) {
    try {
      const real = realpathSync(dir);
      return pending.length ? join(real, ...pending.reverse()) : real;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return absPath; // hit the filesystem root — give up, use as-is
      pending.push(basename(dir));
      dir = parent;
    }
  }
}

/**
 * Resolve `raw` (a file_path/notebook_path, absolute or relative) against `root` into a
 * forward-slash path relative to root, tolerant of symlinks and a non-canonical root. Returns
 * null when the target resolves outside root.
 * @param {string} raw
 * @param {string} root
 */
function toProjectRelativePath(raw, root) {
  if (!raw) return "";
  const absTarget = isAbsolute(raw) ? raw : resolve(root, raw);
  let realRoot;
  try {
    realRoot = realpathSync(root);
  } catch {
    realRoot = resolve(root);
  }
  const realTarget = realpathTolerant(absTarget);
  const rel = relative(realRoot, realTarget);
  if (rel === "") return "";
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return rel.split(sep).join("/");
}

if (sub === "phase") {
  const name = process.argv[3];
  if (name === "clear") {
    try {
      rmSync(phaseFile);
    } catch {}
    process.exit(0);
  }
  if (!name || !policy.phases?.[name]) {
    const known = Object.keys(policy.phases ?? {}).join(", ");
    process.stderr.write(`skill-guard: unknown phase "${name}" — want one of: ${known}\n`);
    process.exit(1);
  }
  ensureStateDir();
  writeFileSync(phaseFile, `${name}\t${Date.now()}\n`);
  process.stdout.write(`phase: ${name}\n`);
  process.exit(0);
}

if (sub === "red") {
  const testFile = process.argv[3];
  if (!testFile) {
    process.stderr.write("skill-guard: usage: skill-guard.mjs red <test-file>\n");
    process.exit(1);
  }
  ensureStateDir();
  writeFileSync(redFile, `${testFile}\t${Date.now()}\n`);
  process.stdout.write(`red: ${testFile}\n`);
  process.exit(0);
}

if (sub === "green") {
  try {
    rmSync(redFile);
  } catch {}
  process.stdout.write("green\n");
  process.exit(0);
}

if (sub === "status") {
  const phaseState = readTabbed(phaseFile);
  const phaseActive = phaseState && Date.now() - Number(phaseState[1]) < phaseStaleMs;
  process.stdout.write(`phase: ${phaseActive && phaseState ? phaseState[0] : "none"}\n`);
  process.stdout.write(`red: ${isRed() ? readTabbed(redFile)?.[0] : "none"}\n`);
  try {
    const lines = readFileSync(logFile, "utf8").trim().split("\n");
    process.stdout.write("recent decisions:\n");
    for (const line of lines.slice(-5)) process.stdout.write(`  ${line}\n`);
  } catch {}
  process.exit(0);
}

if (sub === "check") {
  /** @type {GuardRules | null} */
  let phaseRules = null;
  let phaseName = "-";
  const phaseState = readTabbed(phaseFile);
  if (phaseState && markerFresh(phaseState, phaseStaleMs) && policy.phases?.[phaseState[0]]) {
    phaseRules = policy.phases[phaseState[0]];
    phaseName = phaseState[0];
  }

  const agentType = payload.agent_type ?? "-";
  /** @type {GuardRules | null} */
  const roleRules = agentType !== "-" && policy.roles?.[agentType] ? policy.roles[agentType] : null;

  if (!phaseRules && !roleRules) ok(); // no guarded context — fail open

  const tool = payload.tool_name ?? "";
  const input = payload.tool_input || {};

  /** @param {GuardRules | null} rules @param {string} label */
  const evalRules = (rules, label) => {
    if (!rules) return;
    const why = `${label}: ${rules.reason}`;

    if (tool === "Bash" && rules.deny_bash) {
      const cmd = stripQuotedSpans(stripGitGlobalFlags(String(input.command || "")));
      for (const re of rules.deny_bash) {
        // A denied binary counts only in command position: start of string, or right after a
        // real shell separator — whitespace, `;`, `&&`, `||`, `|`, or `(` (covers `$(…)` and a
        // subshell). Not `/`, a quote, or a backtick: `legit push` and prose stay clear, and an
        // AST-level bypass like `bash -c '…'` isn't the honest-mistake this guard is for.
        let hit = false;
        try {
          hit = new RegExp(`(?:^|[\\s;&|(])(?:${re})`).test(cmd);
        } catch (e) {
          process.stderr.write(`skill-guard: bad deny_bash pattern ${JSON.stringify(re)} — ${e}\n`);
        }
        if (hit) {
          logDecision(phaseName, agentType, tool, "deny", why);
          deny(why);
        }
      }
    }

    if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
      const raw = input.file_path || input.notebook_path || "";
      const path = toProjectRelativePath(raw, cwd);
      if (rules.deny_write) {
        // An out-of-root target can't be checked against a repo-relative deny_write pattern, so
        // treat it as denied — but only under a rule set that actually restricts writes. A phase
        // like `code` carries no deny_write and is meant to allow writes anywhere (/tmp handoffs,
        // ~/.claude), so it must not trip this.
        if (raw && path === null) {
          const outsideMsg = `${label}: target resolves outside the project root`;
          logDecision(phaseName, agentType, tool, "deny", outsideMsg);
          deny(outsideMsg);
        }
        for (const re of rules.deny_write) {
          let hit = false;
          try {
            hit = !!path && new RegExp(re).test(path);
          } catch (e) {
            process.stderr.write(
              `skill-guard: bad deny_write pattern ${JSON.stringify(re)} — ${e}\n`
            );
          }
          if (hit) {
            logDecision(phaseName, agentType, tool, "deny", why);
            deny(why);
          }
        }
      }
      if (rules.tdd && path && /^src\//.test(path) && !isRed()) {
        const redMsg = `${label}: no failing test marked — run \`skill-guard.mjs red <test-file>\` first`;
        logDecision(phaseName, agentType, tool, "deny", redMsg);
        deny(redMsg);
      }
    }
  };

  evalRules(phaseRules, `phase ${phaseName}`);
  evalRules(roleRules, `role ${agentType}`);
  logDecision(phaseName, agentType, tool, "allow", "-");
  ok();
}

ok(); // unknown sub-command
