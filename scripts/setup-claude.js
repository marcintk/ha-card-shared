import { readFileSync, writeFileSync, mkdirSync, symlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const MARKER = 'ha-card-shared: checking required plugins';
const MATCHER = 'startup|resume|clear|compact';
const HOOK = {
  type: 'command',
  command: 'missing=""; [ -f ~/.claude/.ponytail-active ] || missing="ponytail "; grep -q caveman ~/.claude/settings.json 2>/dev/null || missing="${missing}caveman "; [ -n "$missing" ] && echo "⚠️  Missing required plugins: ${missing}— install per ha-card-shared README" || true',
  timeout: 5,
  statusMessage: MARKER,
};

const root = process.env.INIT_CWD ?? process.cwd();
const claudeDir = join(root, '.claude');
const sharedRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function mergeSessionStartHook() {
  const settingsPath = join(claudeDir, 'settings.json');
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {}

  settings.hooks ??= {};
  settings.hooks.SessionStart ??= [];

  let entry = settings.hooks.SessionStart.find(e => e.matcher === MATCHER);
  if (!entry) {
    entry = { matcher: MATCHER, hooks: [] };
    settings.hooks.SessionStart.push(entry);
  }
  entry.hooks ??= [];
  entry.hooks = entry.hooks.filter(h => h.statusMessage !== MARKER);
  entry.hooks.push(HOOK);

  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

function symlinkSkills() {
  const skillsDir = join(claudeDir, 'skills');
  mkdirSync(skillsDir, { recursive: true });
  try {
    symlinkSync(join(sharedRoot, 'skills', 'explain-diff-gfm'), join(skillsDir, 'explain-diff-gfm'));
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

mergeSessionStartHook();
symlinkSkills();
