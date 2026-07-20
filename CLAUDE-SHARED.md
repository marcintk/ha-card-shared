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

- **Ponytail** — lazy senior dev mode; `/ponytail-review` runs in Phase 2, `/ponytail-audit` in Phase 6.
- **Caveman** — 65% fewer output tokens; `/caveman-commit` runs in Phase 4.

Recommended: **Serena** (MCP symbol search + diagnostics), **RTK** (token proxy via hooks).

## Required files

Every project must have:

- **`README.md`** — card purpose, configuration, usage.
- **`test/snapshot.test.ts`** — all `toMatchSnapshot()` calls live here and nowhere else. Use `snapHtml` from `ha-card-shared/test-utils` to normalize Lit marker IDs before snapshotting HTML.
- **`.claude/settings.json`** — managed by ha-card-shared's `postinstall` (`scripts/setup-claude.js`); merges the required SessionStart hook automatically on every `npm install`.
- **`CLAUDE.md`** — `@node_modules/ha-card-shared/CLAUDE-SHARED.md` on line 1, then `## Design Invariants` and `## Architecture Notes` sections with card-specific content.

## Workflow

> Edit `CLAUDE-SHARED.md` in `ha-card-shared` to change this workflow. Iterate until final, then tag **once** — no intermediate tags. If the repo isn't accessible locally, stop and ask.

**Each phase is a checklist.** Work its boxes top to bottom. Before advancing, re-emit the phase with every box `- [x]`. Any box you cannot honestly check → STOP: satisfy it, or ask the user. NEVER advance a phase with an unchecked box.

### Phase 1 — Clarify Before Coding

- [ ] Restate the task: approach, files touched, trade-offs.
- [ ] Grill the user — ask every open question until nothing is ambiguous.
- [ ] One concern per PR — if scope creeps, open a GH issue for extras and proceed with one.
- [ ] DO NOT code until the user says go ahead.

### Phase 2 — Implementation

- [ ] NEVER commit directly to `main` — always work on a feature branch (`feat/`, `fix/`, `chore/`, `docs/`).
- [ ] Add the failing test first (`test/*.test.ts`). Skip for docs/rules-only changes.
- [ ] Implement; loop locally until all pass: `npm run test:coverage && npm run check:ci`.
- [ ] Run `/ponytail-review`; apply fixes, re-run `npm run test:coverage && npm run check:ci`.
- [ ] DO NOT commit anything yet.

### Phase 3 — User Review

- [ ] Summarize how the goal was achieved.
- [ ] Wait for explicit user approval before proceeding.

### Phase 4 — Post-Implementation

- [ ] Commit all implementation work using `/caveman-commit`; loop until pre-commit hooks pass for each commit.
- [ ] Update `README.md` if behavior or interface changed; commit.
- [ ] Ensure working tree is clean — nothing uncommitted.
- [ ] Push branch.

### Phase 5 — Merge

- [ ] `gh pr create`.
- [ ] `gh run watch` — blocks until CI is green. If red: fix on the branch, push, re-run `gh run watch`.
- [ ] `gh pr merge --squash --delete-branch`.
- [ ] `git checkout main && git pull`.

### Phase 6 — Ship

- [ ] NEVER trigger autonomously — recommend to the user, then wait for approval.
- [ ] Verify all recent CI runs on `main` show ✓: `gh run list --branch main --limit 5`.
- [ ] Run `/ponytail-audit` (full repo scan). Any finding → fix on a branch, PR, merge, then re-run. Only continue when the audit comes back clean.
- [ ] Bump version following semver:
  - **patch** — bug fixes, docs, no API change. Batch freely.
  - **minor** — new export or toolchain feature, backward-compatible. Ship after 2–3 PRs.
  - **major** — any breaking change (removed/renamed export, changed signature, consumers must update). Ship immediately after merge.
- [ ] Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
