import { execSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} GuardHookEntry
 * @property {string} [matcher]
 * @property {{type: string, command: string, timeout?: number, statusMessage?: string}[]} hooks
 */
/**
 * @typedef {object} ClaudeSettings
 * @property {{PreToolUse?: GuardHookEntry[], Stop?: GuardHookEntry[], SessionStart?: GuardHookEntry[]}} [hooks]
 */

const root = process.env.INIT_CWD ?? process.cwd();
const claudeDir = join(root, ".claude");
const sharedRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Both the check hook and the skill CLI steps invoke the guard through a stable
// `.claude/hooks/` symlink (created by linkInto below). A bare `harness/hooks/skill-guard.mjs`
// only resolves when cwd is this repo; under a consumer card the file lives in
// node_modules/ha-card-shared/. The .claude/-relative path is the same in both, and commits
// with no per-machine churn if the consumer checks in .claude/settings.json.
const guard = ".claude/hooks/skill-guard.mjs";

// Merge the skill-guard PreToolUse hook into the consumer's .claude/settings.json. Idempotent:
// any hook entry whose command mentions skill-guard.mjs is replaced. Also drops the pre-1.5
// "missing required plugins" SessionStart hook, and a pre-3.0 Stop hook, if still there.
// A pre-2.0 consumer has .claude/settings.json symlinked into node_modules. Writing through that
// link either throws (v2 stopped shipping .claude/, so the target is gone) or silently lands in
// the package copy, which the next install discards. Drop the link so a real file replaces it —
// but only when it points into node_modules or dangles; a link the consumer aims somewhere of
// their own (dotfiles, say) is theirs to keep.
/** @param {string} settingsPath */
function dropPackageSymlink(settingsPath) {
  let link;
  try {
    link = lstatSync(settingsPath);
  } catch {
    return; // nothing there
  }
  if (!link.isSymbolicLink()) return;
  let target;
  try {
    target = realpathSync(settingsPath);
  } catch {
    rmSync(settingsPath); // dangling
    return;
  }
  if (target.split(sep).includes("node_modules")) rmSync(settingsPath);
}

function mergeHooks() {
  const settingsPath = join(claudeDir, "settings.json");
  dropPackageSymlink(settingsPath);
  /** @type {ClaudeSettings} */
  let settings = {};
  let existing = "";
  try {
    existing = readFileSync(settingsPath, "utf8");
  } catch {}
  if (existing.trim()) {
    try {
      settings = JSON.parse(existing);
    } catch {
      // Don't silently overwrite a settings file we can't parse (a hand-edit typo, a merge
      // conflict) — that would wipe the consumer's permissions/env/hooks. Preserve it and skip.
      const backup = `${settingsPath}.corrupt-${Date.now()}.bak`;
      writeFileSync(backup, existing);
      process.stderr.write(
        `ha-card-shared: .claude/settings.json is not valid JSON — left it untouched, ` +
          `copied to ${backup}. Fix it and re-run \`npm install\` to wire the guard hook.\n`
      );
      return;
    }
  }
  settings.hooks ??= {};

  /** @param {GuardHookEntry} e */
  const isGuard = (e) =>
    (e.hooks ?? []).some(
      (h) => typeof h.command === "string" && h.command.includes("skill-guard.mjs")
    );
  /** @param {GuardHookEntry[] | undefined} arr */
  const keep = (arr) => (arr ?? []).filter((e) => !isGuard(e));
  /** @param {string} arg */
  const cmd = (arg) => ({ type: "command", command: `node "${guard}" ${arg}`, timeout: 30 });

  settings.hooks.PreToolUse = [
    ...keep(settings.hooks.PreToolUse),
    { matcher: "Bash|Edit|Write|MultiEdit|NotebookEdit", hooks: [cmd("check")] },
  ];

  // v2's guard was skill-state-based: a `PreToolUse × Skill` hook plus a `Stop` hook that cleared
  // it on every turn boundary — dead from day one, since it never survived past the first human
  // gate. v3 replaces it with an explicit phase a skill sets itself (`skill-guard.mjs phase …`),
  // so neither hook is wired going forward — but still strip a leftover guard entry from an
  // earlier install so an upgrade doesn't leave a stale `enter`/`clear` invocation behind.
  if (settings.hooks.Stop) {
    settings.hooks.Stop = keep(settings.hooks.Stop);
    if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
  }

  if (settings.hooks.SessionStart) {
    settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
      (e) => !(e.hooks ?? []).some((h) => String(h.statusMessage).includes("ha-card-shared"))
    );
    if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
  }

  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

// The symlinked directories point into this machine's node_modules — committing them (a
// teammate's checkout would get dangling links) is never right. Keep settings.json committable
// but self-ignore the generated link dirs, so it doesn't depend on the consumer's root
// .gitignore listing each one.
function writeClaudeGitignore() {
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(
    join(claudeDir, ".gitignore"),
    "/skills/\n/agents/\n/hooks/\n/design-methods/\n/skill-guard/\n"
  );
}

// Symlink every entry of <sharedRoot>/<srcRel> into <claudeDir>/<destName>, and prune any of our
// own symlinks there that no longer resolve (e.g. a skill removed in a newer ha-card-shared).
/** @param {string} srcRel @param {string} [destName] */
function linkInto(srcRel, destName = srcRel) {
  const src = join(sharedRoot, srcRel);
  const dest = join(claudeDir, destName);
  let entries;
  try {
    entries = readdirSync(src, { withFileTypes: true });
  } catch {
    return; // nothing to link
  }
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(dest, { withFileTypes: true })) {
    if (!entry.isSymbolicLink()) continue;
    const link = join(dest, entry.name);
    let target;
    try {
      target = readlinkSync(link);
    } catch {
      continue;
    }
    if (!target.startsWith(sharedRoot)) continue; // not ours — leave it
    try {
      statSync(link); // follows the link; throws if the target is gone
    } catch {
      rmSync(link);
    }
  }

  for (const entry of entries) {
    try {
      symlinkSync(join(src, entry.name), join(dest, entry.name));
    } catch (e) {
      if (/** @type {NodeJS.ErrnoException} */ (e).code !== "EEXIST") throw e;
    }
  }
}

// Point git at the bundled pre-commit / pre-push hooks. Skipped if the consumer isn't a git
// repo, or has already set core.hooksPath to something of their own (don't clobber that).
function wireGitHooks() {
  // Absolute: git resolves a relative core.hooksPath from the worktree root, which isn't
  // necessarily INIT_CWD (install from a subdirectory, a nested workspace package). A relative
  // value would then point nowhere and git would silently run no hooks.
  const desired = join(sharedRoot, "harness", ".githooks");
  /** @param {string} args @param {boolean} [capture] */
  const git = (args, capture) =>
    execSync(`git ${args}`, {
      cwd: root,
      stdio: capture ? ["ignore", "pipe", "ignore"] : "ignore",
    });
  // A value naming a missing or empty directory hooks nothing — git silently runs no hook. Treat
  // it as a leftover to take over, so a consumer isn't stranded with dead hooks forever.
  /** @param {string} p */
  const hasHooks = (p) => {
    try {
      return readdirSync(resolve(root, p)).length > 0;
    } catch {
      return false;
    }
  };

  try {
    const current = git("config --local --get core.hooksPath", true).toString().trim();
    if (current === desired) return; // already ours
    if (current && !current.includes("ha-card-shared") && hasHooks(current)) return; // theirs
  } catch {
    // unset, or not a git repo — the set below decides which
  }
  try {
    git(`config --local core.hooksPath "${desired}"`);
  } catch {
    // not a git repo — nothing to wire
  }
}

mergeHooks();
wireGitHooks();
writeClaudeGitignore();
linkInto("harness/hooks", "hooks");
linkInto("harness/skills", "skills");
linkInto("harness/agents", "agents");
linkInto("harness/design-methods", "design-methods");
