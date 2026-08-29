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
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

/** @type {Policy} */
const policy = JSON.parse(readFileSync(join(HERE, "skill-guard.json"), "utf8"));
const phaseStaleMs = (policy.settings?.phase_stale_seconds ?? 28800) * 1000;
const redStaleMs = (policy.settings?.red_stale_seconds ?? 1800) * 1000;

const cwd = payload.cwd || process.cwd();
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
  const state = readTabbed(redFile);
  return !!state && Date.now() - Number(state[1]) < redStaleMs;
}

/** Strip git's global options — anything valid between `git` and the subcommand — so
 * `git -C /x --no-pager commit` reads as `git commit` for subcommand matching. Covers the
 * value-taking flags (quoted or bare) and the standalone toggles; an unrecognised global flag
 * still shifts the subcommand and is caught by the `stripQuotedSpans`-then-boundary matching. */
/** @param {string} cmd */
function stripGitGlobalFlags(cmd) {
  const value = `(?:"[^"]*"|'[^']*'|\\S+)`;
  const opt =
    `(?:\\s+-C\\s+${value}` +
    `|\\s+-c\\s+\\S+=\\S+` +
    `|\\s+(?:--git-dir|--work-tree|--namespace|--exec-path|--super-prefix)(?:=\\S+|\\s+${value})` +
    `|\\s+(?:--no-pager|--paginate|-P|--bare|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs))+`;
  return cmd.replace(new RegExp(`\\bgit${opt}`, "g"), "git");
}

/** Blank quoted spans so a deny pattern can't match text inside an argument — e.g. the
 * literal "git push" in `git commit -m "todo: git push later"`. Runs after
 * stripGitGlobalFlags, which needs the quotes intact to consume `-C "a b"`. */
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
  if (phaseState) {
    const [name, ts] = phaseState;
    if (Date.now() - Number(ts) < phaseStaleMs && policy.phases?.[name]) {
      phaseRules = policy.phases[name];
      phaseName = name;
    }
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
        if (new RegExp(re).test(cmd)) {
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
          if (path && new RegExp(re).test(path)) {
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
