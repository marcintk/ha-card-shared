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

Required — install before use, missing plugins are warned at session start:

- **ponytail** — active all session (lazy senior dev mode); `/ponytail-review` runs in Phase 2, `/ponytail-audit` (optional) in Phase 4
  ```bash
  claude plugin marketplace add DietrichGebert/ponytail && claude plugin install ponytail@ponytail
  ```
- **Caveman** — active all session (65% fewer output tokens); `/caveman-commit` runs in Phase 4
  ```bash
  claude plugin marketplace add JuliusBrussee/caveman && claude plugin install caveman@caveman
  ```

Recommended:

- **Serena** — MCP server; symbol search and diagnostics during implementation
- **RTK** — token proxy; reduces API usage transparently via hooks

## Required files

Every project must have:

- **`README.md`** — card purpose, configuration, usage.
- **`TODO.md`** — backlog. Never auto-implement; suggest items only when user asks. Always update when scope changes.
- **`test/snapshot.test.ts`** — all `toMatchSnapshot()` calls live here and nowhere else. Use `snapHtml` from `ha-card-shared/test-utils` to normalize Lit marker IDs before snapshotting HTML.

## Task files

- **`PLAN.md`** — fully specified task. Pick it up at session start before anything else. Mid-session: finish current commit unit first, then implement. Delete after pushing the branch.

## Workflow

> Edit `CLAUDE-SHARED.md` in `ha-card-shared` to change this workflow. Iterate until final, then tag **once** — no intermediate tags. If the repo isn't accessible locally, stop and ask.

### Phase 1 — Clarify before coding

- Restate the task: approach, files touched, trade-offs.
- Grill the user — ask every open question until nothing is ambiguous.
- One concern per PR — if scope creeps, push extras to `TODO.md` and proceed with one.
- Do not code until the user says go ahead.

### Phase 2 — Implementation

- Never commit directly to `main` — always work on a feature branch (`feat/`, `fix/`, `chore/`, `docs/`).
- Add the failing test first (`test/*.test.ts`). Skip for docs/rules/TODO-only changes.
- Implement; loop locally until all pass: `npm test && npm run test:coverage && npm run check:ci`.
- Run `/ponytail-review`; apply fixes, re-run `npm test && npm run check:ci`.
- Do not commit anything yet.

### Phase 3 — User review

- Summarise how the goal was achieved.
- Wait for explicit user approval before proceeding.

### Phase 4 — Post Implementation

- Commit all implementation work using `/caveman-commit`; loop until pre-commit hooks pass for each commit.
- Update `README.md` and `TODO.md` if behavior or interface changed; commit.
- Ensure working tree is clean — nothing uncommitted before audit.
- Ask user: "Run `/ponytail-audit` (full repo scan)?" — proceed only on yes. Apply each fix as its own commit, re-run `npm run check:ci` after each.
- Push branch.

### Phase 5 — Merge

- `gh pr create`
- `gh run watch` — blocks until CI is green. If red: fix on the branch, push, re-run `gh run watch`.
- `gh pr merge --squash --delete-branch`
- `git checkout main && git pull`

### Phase 6 — Ship

- Never trigger autonomously — recommend to the user, then wait for approval.
- Verify all recent CI runs on `main` show ✓: `gh run list --branch main --limit 5`
- Bump version following semver:
  - **patch** — bug fixes, docs, no API change. Batch freely.
  - **minor** — new export or toolchain feature, backward-compatible. Ship after 2–3 PRs.
  - **major** — any breaking change (removed/renamed export, changed signature, consumers must update). Ship immediately after merge.
- Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`
