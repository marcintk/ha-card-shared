# Migrate ha-card-shared 1.4.1 → 2.0.1

**What changed:** the Claude Code skill harness is now fully self-contained. Marketplace
plugins (`ponytail`, `caveman`, `tdd-guard`) and user-global skills (`grilling`,
`improve-codebase-architecture`) are gone; their essentials are vendored into `skills/`,
`agents/`, and `hooks/`. A new `skill-guard` PreToolUse hook enforces per-skill / per-role
guardrails. `explain-diff-gfm` folded into `explain-it`.

The **npm package API is unchanged** — every `ha-card-shared/*` export is the same. Only the
Claude Code agent workflow changed, so this is `major` purely because it needs the one-time
steps below. If you never open Claude Code in this repo, only step 1 matters.

## 1. Bump the pins

Bump both the npm dep and the workflow refs to `v2.0.1`, same as any release:

```bash
# package.json:  "ha-card-shared": "github:marcintk/ha-card-shared#v2.0.1"
# .github/workflows/*.yml:  uses: marcintk/ha-card-shared/.github/workflows/*.yml@v2.0.1
npm install
```

`postinstall` (`scripts/setup-claude.js`) then, automatically:

- merges the `skill-guard` hooks into `.claude/settings.json` — `PreToolUse ×Skill → enter`,
  `PreToolUse ×Bash|Edit|Write|MultiEdit|NotebookEdit → check`, `Stop → clear`;
- removes the old "missing required plugins" `SessionStart` hook;
- symlinks `skills/` and `agents/` into `.claude/`;
- prunes its own now-dangling symlinks (e.g. `.claude/skills/explain-diff-gfm`).

The hook command is written **repo-relative** (`node_modules/ha-card-shared/hooks/…`), so
`.claude/settings.json` is safe to commit if you want.

## 2. Ignore the generated `.claude/` bits

The symlinks under `.claude/skills/` and `.claude/agents/` point into `node_modules/` with
absolute paths, and `.claude/skill-guard/` is per-session runtime state. None of it belongs in
git. Add to `.gitignore` (skip any line you already have):

```gitignore
.claude/skills/
.claude/agents/
.claude/skill-guard/
```

If you currently commit `.claude/skills/explain-diff-gfm` or a `SessionStart` plugin-check
hook, `git rm --cached` them after `npm install` regenerates `.claude/`.

## 3. Check the Claude Code version

The guard needs a build that: exposes an `agents/` directory, fires `PreToolUse` for the
`Skill` tool, includes `agent_type` in the hook payload, and supports the `Stop` hook.
Verified on `claude-code` **2.1.x**.

```bash
claude --version        # want ≥ 2.1
npm i -g @anthropic-ai/claude-code@latest   # if older
```

Older Claude Code degrades gracefully: the guard fails open (no `agent_type` → generic
subagents → allowed) and the pipelines still run — just unguarded.

## 4. Drop the retired plugins (optional, user-global)

If you installed these only for ha-card-shared, remove them:

```bash
claude plugin uninstall tdd-guard@tdd-guard      # replaced by skill-guard
claude plugin uninstall ponytail@ponytail        # only if you don't use it as a persona
claude plugin uninstall caveman@caveman          # only if you don't use it as a persona
```

`ponytail` / `caveman` as your own always-on personas are unaffected — keep them.

## 5. Reload and verify

`/reload` in an open Claude Code session (or start a new one), then:

```bash
ls .claude/skills/     # brainstorm-it commit-it improve-it pr-it explain-it fix-it feature-it ship-it
                       # and NO explain-diff-gfm
ls .claude/agents/     # pipeline-explore pipeline-test-writer pipeline-coder pipeline-reviewer .md
grep -o 'skill-guard.mjs" [a-z]*' .claude/settings.json | sort -u   # clear / check / enter
echo '{}' | node node_modules/ha-card-shared/hooks/skill-guard.mjs check ; echo "exit $?"   # exit 0
```

## What the pipelines do differently now

- **`/fix-it`, `/feature-it`** — spawn named guarded subagents (`pipeline-explore`,
  `pipeline-test-writer`, `pipeline-coder`, `pipeline-reviewer`); the review step is
  `/code-review` + `/simplify` (was `/ponytail-review`); the commit message comes from
  `commit-it`; the commit→push→PR→merge tail runs through `pr-it`.
- **`/ship-it`** — step 2 is `/code-review` repo-wide (was `/ponytail-audit`); step 4 runs
  `/improve-it` (was `/improve-codebase-architecture`).
- **`LESSONS.md`** at the repo root — the pipelines create and maintain it (a committed
  by-symptom log of root cause + guardrail). Consulted before new work.
- **`brainstorm-it`** replaces `grilling`, and also drafts an issue from a raw idea.
- **Escape hatch:** `SKILL_GUARD_OFF=1` in the environment disables the guard entirely if it
  ever blocks something it shouldn't.
