#!/usr/bin/env node
// skill-guard — skill/role-aware PreToolUse guardrails for the fix-it / feature-it / ship-it
// pipelines. One script, dispatched by argv[2]:
//
//   enter   (PreToolUse × Skill)                          record the active pipeline skill
//   clear   (Stop)                                        forget it
//   check   (PreToolUse × Bash|Edit|Write|MultiEdit|…)    allow (exit 0) or block (exit 2)
//
// Active context resolves as: payload.agent_type (a subagent role) beats the recorded skill.
// Policy lives in skill-guard.json next to this file. SKILL_GUARD_OFF=1 disables all checks.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const sub = process.argv[2];
const HERE = dirname(fileURLToPath(import.meta.url));

const ok = () => process.exit(0);
const deny = (msg) => {
  process.stderr.write(`skill-guard: ${msg}\n`);
  process.exit(2);
};

if (process.env.SKILL_GUARD_OFF) ok();

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  ok(); // unreadable payload — fail open
}

const policy = JSON.parse(readFileSync(join(HERE, 'skill-guard.json'), 'utf8'));
const staleMs = (policy.settings?.stale_seconds ?? 1800) * 1000;

const cwd = payload.cwd || process.cwd();
const stateDir = join(cwd, '.claude', 'skill-guard');
const currentFile = join(stateDir, 'current');

if (sub === 'enter') {
  const skill = payload.tool_input?.skill;
  if (skill && policy.skills?.[skill]) {
    mkdirSync(stateDir, { recursive: true });
    try {
      writeFileSync(join(stateDir, '.gitignore'), '*\n');
    } catch {}
    writeFileSync(currentFile, `${skill}\t${Date.now()}\n`);
  }
  ok();
}

if (sub === 'clear') {
  try {
    rmSync(currentFile);
  } catch {}
  ok();
}

if (sub === 'check') {
  let rules = null;
  let label = null;

  const agentType = payload.agent_type;
  if (agentType && policy.roles?.[agentType]) {
    rules = policy.roles[agentType];
    label = `role ${agentType}`;
  } else if (existsSync(currentFile)) {
    const [name, ts] = readFileSync(currentFile, 'utf8').trim().split('\t');
    if (name && Date.now() - Number(ts) < staleMs && policy.skills?.[name]) {
      rules = policy.skills[name];
      label = `skill ${name}`;
    }
  }
  if (!rules) ok(); // no guarded context — fail open

  const tool = payload.tool_name;
  const input = payload.tool_input || {};
  const why = `${label}: ${rules.reason}`;

  if (tool === 'Bash' && rules.deny_bash) {
    const cmd = String(input.command || '');
    for (const re of rules.deny_bash) if (new RegExp(re).test(cmd)) deny(why);
  }

  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const raw = input.file_path || input.notebook_path || '';
    const path = raw.startsWith(cwd) ? raw.slice(cwd.length).replace(/^[/\\]/, '') : raw;
    if (rules.deny_write) {
      for (const re of rules.deny_write) if (path && new RegExp(re).test(path)) deny(why);
    }
    if (rules.tdd && /^src\//.test(path) && suiteGreen(cwd)) {
      deny(`${label}: no failing test — write a red test first`);
    }
  }
  ok();
}

ok(); // unknown sub-command

function suiteGreen(dir) {
  try {
    execSync('npx vitest run --silent --reporter=dot', { cwd: dir, stdio: 'ignore' });
    return true; // exit 0 → all pass → green → block the src/ edit
  } catch {
    return false; // non-zero → a test is failing → red → allow
  }
}
