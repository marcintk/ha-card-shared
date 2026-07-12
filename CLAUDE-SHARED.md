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

## Workflow

> To change this workflow, edit `CLAUDE-SHARED.md` in the `ha-card-shared` repo. Iterate until the content is final, then tag **once**. Do not tag intermediate states. If the repo isn't accessible locally, stop and ask the user.

Follow this process for every task.

### Phase 1 — Clarify before coding

Before writing any code: restate what you understood the task to be and how you plan to achieve it — the approach, which files will be touched, and any trade-offs. Ask any open questions. Only proceed when the user explicitly says to go ahead.

### Phase 2 — Implementation

Work on a feature branch (`feat/`, `fix/`, `chore/`, `docs/`). Direct push to `main` is allowed only for documentation, rules, and TODO updates.

For any code change: add the test to `test/*.test.ts` first, confirm it fails (`npm test`), then implement until it passes.

### Phase 3 — Pre-review gate

Before signalling ready for review, ensure pre-commit and pre-push hooks both pass. Verify that `README.md` and `TODO.md` are current with any behavior or interface changes.

### Phase 4 — User review

Give a brief summary of how the goal was achieved. Wait for explicit user approval before proceeding.

### Phase 5 — Ship

One concern per PR — no bundling of feature changes with refactors.

```bash
gh pr create
gh run list --limit 5   # wait for CI green before merging
gh pr merge --squash --delete-branch
git checkout main && git pull
```

### Phase 6 — Release *(skip unless 3–5 PRs have merged since the last release)*

Never trigger autonomously — recommend to the user, then wait for approval.

```bash
gh run list --branch main --limit 5   # all must show ✓
git tag v1.0.0 && git push origin v1.0.0
```
