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

## Required files

Every project using this shared context must have both files at the repo root:

- **`README.md`** — describes the card's purpose, configuration, and usage.
- **`TODO.md`** — tracks planned work, known issues, and deferred tasks.

If either is missing, stop and report it to the user before proceeding.

## Workflow

> To change this workflow, edit `CLAUDE-SHARED.md` in the `ha-card-shared` repo. Iterate until the content is final, then tag **once**. Do not tag intermediate states. If the repo isn't accessible locally, stop and ask the user.

Follow this process for every task.

### Phase 1 — Clarify before coding

- Restate the task: approach, files touched, trade-offs.
- Grill the user — ask every open question until nothing is ambiguous.
- One concern per PR — if scope creeps, push extras to `TODO.md` and proceed with one.
- Do not code until the user says go ahead.

### Phase 2 — Implementation

- Never commit directly to `main` — always work on a feature branch (`feat/`, `fix/`, `chore/`, `docs/`).
- Add the failing test first (`test/*.test.ts`). Skip for docs/rules/TODO-only changes.
- Implement; loop locally until all pass: `npm test && npm run test:coverage && npm run check:ci`.
- Do not commit anything yet.

### Phase 3 — User review

- Summarise how the goal was achieved.
- Wait for explicit user approval before proceeding.

### Phase 4 — Post Implementation

- Commit all implementation work; loop until pre-commit hooks pass for each commit.
- Update `README.md` and `TODO.md` if behavior or interface changed; commit.
- Ensure working tree is clean — nothing uncommitted before audit.
- Run `/ponytail-audit`; apply each fix as its own commit, re-run `npm run check:ci` after each. Repeat the full audit up to 2–3 rounds total.
- Push branch.

### Phase 5 — Merge

- `gh pr create`
- `gh run watch` — blocks until CI is green. If red: fix on the branch, push, re-run `gh run watch`.
- `gh pr merge --squash --delete-branch`
- `git checkout main && git pull`

### Phase 6 — Ship

- Only when 3–5 PRs have merged since the last release.
- Never trigger autonomously — recommend to the user, then wait for approval.
- Verify all recent CI runs on `main` show ✓: `gh run list --branch main --limit 5`
- Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z` *(replace X.Y.Z with the actual version)*
