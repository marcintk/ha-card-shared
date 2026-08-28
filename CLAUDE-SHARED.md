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

> To change this workflow: edit `CLAUDE-SHARED.md` and/or `skills/fix-it`, `skills/feature-it`, `skills/ship-it`, `skills/explain-it` in `ha-card-shared`, iterate until final, then tag **once** — no intermediate tags. If the repo isn't accessible locally, stop and ask.

## Making a change

Every change starts from a GH issue and runs through one of two skills — no third path, including chores, docs, and trivial edits:

- **`/fix-it <issue#>`** — a bug fix. Reproduce, red test, minimal fix, one PR.
- **`/feature-it <issue#>`** — everything else. Design + grill, red-green per slice, one PR or a small queue. Trivial changes still go through it — the steps just move fast.

No issue number yet → file the issue first, then run the skill. The skill files own the full
procedure; nothing here duplicates it.

Both pipelines maintain `SOLUTIONS.md` at the repo root — one greppable entry per shipped
change that taught something reusable: symptom, root cause, the guardrail now preventing
recurrence. Grep it for the symptom before reproducing or designing; append to it before the
PR. Per-issue detail stays in `design-notes/`.
