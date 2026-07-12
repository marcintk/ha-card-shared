import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const MARKER = 'ha-card-shared: checking required plugins';
const MATCHER = 'startup|resume|clear|compact';
const HOOK = {
  type: 'command',
  command: 'missing=""; [ -f ~/.claude/.ponytail-active ] || missing="ponytail "; grep -q caveman ~/.claude/settings.json 2>/dev/null || missing="${missing}caveman "; [ -n "$missing" ] && echo "⚠️  Missing required plugins: ${missing}— install per CLAUDE-SHARED.md" || true',
  timeout: 5,
  statusMessage: MARKER,
};

const root = process.env.INIT_CWD ?? process.cwd();
const claudeDir = join(root, '.claude');
const settingsPath = join(claudeDir, 'settings.json');

let settings = {};
try {
  settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
} catch {
  // file missing or invalid JSON — start fresh
}

settings.hooks ??= {};
settings.hooks.SessionStart ??= [];

let entry = settings.hooks.SessionStart.find(e => e.matcher === MATCHER);
if (!entry) {
  entry = { matcher: MATCHER, hooks: [] };
  settings.hooks.SessionStart.push(entry);
}
entry.hooks ??= [];

// Replace existing marker hook so updates propagate on npm install
entry.hooks = entry.hooks.filter(h => h.statusMessage !== MARKER);
entry.hooks.push(HOOK);

mkdirSync(claudeDir, { recursive: true });
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log('ha-card-shared: plugin check hook installed in .claude/settings.json');
