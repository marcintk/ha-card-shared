import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
  readdirSync,
  readlinkSync,
  statSync,
  rmSync,
} from 'fs';
import { join, dirname, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.INIT_CWD ?? process.cwd();
const claudeDir = join(root, '.claude');
const sharedRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Path to the hook, relative to the consumer root and slash-normalised, so a consumer that
// chooses to commit .claude/settings.json gets no per-machine churn. Falls back to absolute
// only if the package sits outside the tree (unusual: npm link, odd hoisting).
const relToShared = relative(root, sharedRoot);
const guardBase =
  relToShared && !relToShared.startsWith('..' + sep) && relToShared !== '..'
    ? relToShared.split(sep).join('/')
    : sharedRoot;
const guard = `${guardBase}/hooks/skill-guard.mjs`;

// Merge the skill-guard PreToolUse / Stop hooks into the consumer's .claude/settings.json.
// Idempotent: any hook entry whose command mentions skill-guard.mjs is replaced. Also drops
// the pre-1.5 "missing required plugins" SessionStart hook if it's still there.
function mergeHooks() {
  const settingsPath = join(claudeDir, 'settings.json');
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {}
  settings.hooks ??= {};

  const isGuard = (e) =>
    (e.hooks ?? []).some(
      (h) => typeof h.command === 'string' && h.command.includes('skill-guard.mjs'),
    );
  const keep = (arr) => (arr ?? []).filter((e) => !isGuard(e));
  const cmd = (arg) => ({ type: 'command', command: `node "${guard}" ${arg}`, timeout: 30 });

  settings.hooks.PreToolUse = [
    ...keep(settings.hooks.PreToolUse),
    { matcher: 'Skill', hooks: [cmd('enter')] },
    { matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit', hooks: [cmd('check')] },
  ];
  settings.hooks.Stop = [...keep(settings.hooks.Stop), { hooks: [cmd('clear')] }];

  if (settings.hooks.SessionStart) {
    settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
      (e) => !(e.hooks ?? []).some((h) => String(h.statusMessage).includes('ha-card-shared')),
    );
    if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
  }

  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

// Symlink every entry of <sharedRoot>/<name> into <claudeDir>/<name>, and prune any of our own
// symlinks there that no longer resolve (e.g. a skill removed in a newer ha-card-shared).
function linkInto(name) {
  const src = join(sharedRoot, name);
  const dest = join(claudeDir, name);
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
      if (e.code !== 'EEXIST') throw e;
    }
  }
}

mergeHooks();
linkInto('skills');
linkInto('agents');
