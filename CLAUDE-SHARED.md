# HA Cards — Shared Development Context

TypeScript + Rollup → `dist/card.js` | Vitest | Biome + Prettier | HACS plugin

## Commands

```bash
npm install
npm run build          # bundle src/ → dist/card.js
npm run build:prod     # minified build (VERSION env var stamps the bundle)
npm run dev            # rollup watch mode
npm test               # run tests
npm run test:watch     # vitest watch mode
npm run test:coverage  # run with coverage (must stay at 100%)
npm run typecheck      # tsc --noEmit
npm run check          # biome lint + format (src/ and test/, auto-fix)
npm run format:md      # prettier for markdown files
npm run check:ci       # CI gate: typecheck + biome check + prettier check
```

## Claude Code plugins

Required, active all session — install per README. A SessionStart hook warns when either is missing.

- **Ponytail** — lazy senior dev mode; `/ponytail-review` runs in Phase 2, `/ponytail-audit` in Phase 5.
- **Caveman** — 65% fewer output tokens; `/caveman-commit` runs in Phase 3.

Recommended: **Serena** (MCP symbol search + diagnostics), **RTK** (token proxy via hooks).

## Required files

Every project must have:

- **`README.md`** — card purpose, configuration, usage.
- **`test/snapshot.test.ts`** — all `toMatchSnapshot()` calls live here and nowhere else. Use `snapHtml` from `ha-card-shared/test-utils` to normalize Lit marker IDs before snapshotting HTML.
- **`.claude/settings.json`** — managed by ha-card-shared's `postinstall` (`scripts/setup-claude.js`); merges the required SessionStart hook automatically on every `npm install`.
- **`CLAUDE.md`** — `@node_modules/ha-card-shared/CLAUDE-SHARED.md` on line 1, then `## Design Invariants` and `## Architecture Notes` sections with card-specific content.

> To change this workflow: edit `CLAUDE-SHARED.md` in `ha-card-shared`, iterate until final, then tag **once** — no intermediate tags. If the repo isn't accessible locally, stop and ask.

## Workflow

**Each phase is a checklist.** Work its boxes top to bottom, one at a time:

1. Print the box as `- [ ] …` before starting it.
2. Execute the step.
3. Print the box as `- [x] …` once done.
4. Move to the next box.

Any box you cannot honestly check → STOP: satisfy it, or ask the user. NEVER advance a phase with an unchecked box. Before advancing to the next phase, re-emit the full phase with every box `- [x]`.

### Phase 1 — Clarify Before Coding

> **Rule:** Do not write any code until the user explicitly says go ahead.

- [ ] Restate the task: approach, files touched, trade-offs.
- [ ] Grill the user — ask every open question until nothing is ambiguous.
- [ ] One concern per PR — if scope creeps, open a GH issue for extras and proceed with one.
- [ ] Wait for user to say **"go ahead"**.

### Phase 2 — Implementation

> **Rule:** Never commit directly to `main` — always work on a feature branch (`feat/`, `fix/`, `chore/`, `docs/`).

- [ ] Create and switch to a feature branch: `git checkout -b <type>/description`.
- [ ] Add the failing test first (`test/*.test.ts`). Skip for docs/rules-only/chore changes.
- [ ] Implement; loop locally until all pass: `npm run test:coverage && npm run check:ci`.
- [ ] Run `/ponytail-review`; apply fixes, re-run `npm run test:coverage && npm run check:ci`.
- [ ] Update `README.md` if behavior or interface changed (skip and mark done if neither changed).
- [ ] Run `/explain-diff-gfm` — generates `/tmp/YYYY-MM-DD-explanation-<slug>.md` (used in Phase 3).
- [ ] Share artifact path → wait for explicit user approval before proceeding.

### Phase 3 — Commit & PR

- [ ] Commit all work using `/caveman-commit`; loop until pre-commit hooks pass for each commit.
- [ ] Ensure working tree is clean — nothing uncommitted.
- [ ] Push branch.
- [ ] `gh pr create`.
- [ ] `gh pr comment --body-file /tmp/YYYY-MM-DD-explanation-<slug>.md` (artifact from Phase 2)
- [ ] Share PR URL → wait for user to say **"merge it"**.

### Phase 4 — Merge

- [ ] `gh run watch` — blocks until CI is green. If red: fix on the branch, push, re-run `gh run watch`.
- [ ] `gh pr merge --squash --delete-branch`.
- [ ] `git checkout main && git pull`.
- [ ] Analyze commits since the last tag and recommend whether a release is warranted — one line, e.g. _"patch ready: 3 bug fixes since v1.2.0 — say 'ship' to release."_ If nothing satisfies semver criteria, say so.

### Phase 5 — Ship

> **Rule:** Never trigger autonomously. Only enter this phase when the user says **"ship"** or **"release it"**.

- [ ] Verify all recent CI runs on `main` show ✓: `gh run list --branch main --limit 5`.
- [ ] Run `/ponytail-audit` (full repo scan). Any finding → fix on a branch, PR, merge, then re-run. Only continue when the audit comes back clean.
- [ ] Determine semver bump:
  - **patch** — bug fixes, docs, no API change. Batch freely.
  - **minor** — new export or toolchain feature, backward-compatible. Ship after 2–3 PRs.
  - **major** — any breaking change (removed/renamed export, changed signature, consumers must update). Ship immediately after merge.
- [ ] Bump version: `npm version patch|minor|major` (updates `package.json`, commits, and creates local tag).
- [ ] Push commit + tag: `git push --follow-tags`.
