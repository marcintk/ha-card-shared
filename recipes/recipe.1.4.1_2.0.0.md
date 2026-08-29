# Migrate ha-card-shared 1.4.1 → 2.0.0

**What changed:** two things.

1. **The bundle is named after your card.** `cardBundle` now emits `dist/<project>.js` instead
   of `dist/card.js`, taking the name from `package.json`. Every card's Lovelace resource URL
   becomes recognisable instead of ending in the same generic `card.js`. This needs the
   one-time consumer work in step 2 — **including an end-user action**.
2. **The Claude Code skill harness is fully self-contained.** Marketplace plugins (`ponytail`,
   `caveman`, `tdd-guard`) and user-global skills (`grilling`, `improve-codebase-architecture`)
   are gone; their essentials are vendored into `harness/`. A new `skill-guard` PreToolUse hook
   enforces per-skill / per-role guardrails. `explain-diff-gfm` folded into `explain-it`.

The **npm package API is unchanged** — every `ha-card-shared/*` export is the same. Steps 1–2
apply to every consumer; steps 3–6 only matter if you open Claude Code in this repo.

## 1. Bump the pins

Bump both the npm dep and the workflow refs to `v2.0.0`, same as any release:

```bash
# package.json:  "ha-card-shared": "github:marcintk/ha-card-shared#v2.0.0"
# .github/workflows/*.yml:  uses: marcintk/ha-card-shared/.github/workflows/*.yml@v2.0.0
npm install
```

`postinstall` (`harness/setup-claude.js`) then, automatically:

- merges the `skill-guard` hooks into `.claude/settings.json` — `PreToolUse ×Skill → enter`,
  `PreToolUse ×Bash|Edit|Write|MultiEdit|NotebookEdit → check`, `Stop → clear`;
- removes the old "missing required plugins" `SessionStart` hook;
- symlinks `skills/` and `agents/` into `.claude/`;
- prunes its own now-dangling symlinks (e.g. `.claude/skills/explain-diff-gfm`).

The hook command is written **repo-relative** (`node_modules/ha-card-shared/harness/hooks/…`), so
`.claude/settings.json` is safe to commit if you want.

## 2. Rename the shipped bundle

`npm run build` now emits `dist/<repo>.js`. Four files still name the old asset — do them in
this order, because the first is load-bearing.

1. **`hacs.json` — do this one first.** HACS reads `filename` to decide which release asset to
   install. Publish a `2.0.0` release without it and **HACS installs break for your users**.

   ```json
   { "filename": "<repo>.js" }
   ```

2. **`README.md`** — the manual-install download name and the
   `/local/<repo>/<repo>.js` resource URL.
3. **`docs/index.html`** — `import "./<repo>.js"`.
4. **`ha-planetary-solar-system-card` only** — the demo recorder rig
   (`scripts/demo/record-demo.mjs` and its `.json`, `record-harness.html`) references
   `docs/<repo>.js`.

Then rebuild and confirm the filename:

```bash
npm run build && ls dist/
```

**Your end users must act too.** After they update the card, their Lovelace resource URL still
points at `…/card.js` and 404s until they re-point it to `…/<repo>.js`. Say so in your release
notes.

## 3. Ignore the generated `.claude/` bits

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

## 4. Check the Claude Code version

The guard needs a build that: exposes an `agents/` directory, fires `PreToolUse` for the
`Skill` tool, includes `agent_type` in the hook payload, and supports the `Stop` hook.
Verified on `claude-code` **2.1.x**.

```bash
claude --version        # want ≥ 2.1
npm i -g @anthropic-ai/claude-code@latest   # if older
```

Older Claude Code degrades gracefully: the guard fails open (no `agent_type` → generic
subagents → allowed) and the pipelines still run — just unguarded.

## 5. Drop the retired plugins (optional, user-global)

If you installed these only for ha-card-shared, remove them:

```bash
claude plugin uninstall tdd-guard@tdd-guard      # replaced by skill-guard
claude plugin uninstall ponytail@ponytail        # only if you don't use it as a persona
claude plugin uninstall caveman@caveman          # only if you don't use it as a persona
```

`ponytail` / `caveman` as your own always-on personas are unaffected — keep them.

## 6. Reload and verify

`/reload` in an open Claude Code session (or start a new one), then:

```bash
ls .claude/skills/     # brainstorm-it commit-it improve-it pr-it explain-it fix-it feature-it ship-it
                       # and NO explain-diff-gfm
ls .claude/agents/     # pipeline-explore pipeline-test-writer pipeline-coder pipeline-reviewer .md
grep -o 'skill-guard.mjs" [a-z]*' .claude/settings.json | sort -u   # clear / check / enter
echo '{}' | node node_modules/ha-card-shared/harness/hooks/skill-guard.mjs check ; echo "exit $?"   # exit 0
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
