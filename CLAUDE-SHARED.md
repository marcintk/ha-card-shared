# HA Cards — Shared Development Context

TypeScript + Rollup → `dist/<project>.js` | Vitest | Biome + Prettier | HACS plugin

## Commands

Every consumer card defines these (a shared convention, not exports of `ha-card-shared` itself —
`ha-card-shared`'s own `package.json` is narrower, since it isn't a card being bundled or watched):

```bash
npm install
npm run build          # bundle src/ → dist/<project>.js (name from package.json)
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

> To change this workflow: edit `CLAUDE-SHARED.md` and/or the pipeline files in `ha-card-shared` — `harness/skills/{design-it,code-it,ship-it,release-it,explain-it,commit-it,brainstorm-it,show-it}`, `harness/design-methods/`, `harness/agents/`, `harness/hooks/skill-guard.*` — iterate until final, then tag **once** — no intermediate tags. If the repo isn't accessible locally, stop and ask.

## Making a change

Every change starts from a GH issue and runs through the same four steps — no third path,
including chores, docs, and trivial edits:

- **`/design-it <issue#>`** — design phase. Reproduce or scope, grill, design it twice for
  anything non-trivial, approved design note with slices declared.
- **`/code-it <issue#>`** — TDD phase. Red test, minimal fix, review, `show-it`, then a commit —
  per slice, until the note is fully implemented.
- **`/ship-it`** — finalize commit, PR, explain-diff + cost-digest comment, rebase-merge (each
  slice commit lands on `main`).
- **`/release-it`** — batched across several merged PRs: bump semver, tag, draft release notes.

No issue yet? `/design-it` with no number scans the repo for a deepening opportunity and files
the issue itself. A fuzzy idea already in mind → run `brainstorm-it` first; it interviews you to
a spec and drafts the issue, then `/design-it <issue#>`. The skill files own the full procedure;
nothing here duplicates it.

The pipeline maintains `LESSONS.md` at the repo root — one greppable entry per shipped
change that taught something reusable: symptom, root cause, the guardrail now preventing
recurrence. Grep it for the symptom before reproducing or designing; append to it before the
PR. Per-issue detail stays in `docs/design-notes/`.

`/code-it` runs `/show-it` at each slice's review gate to render what the change looks like — a
browser preview for a UI bundle, a before/after HTML report for a library or CLI change. A card
opts in by adding a `show` npm script or a `## Show-It` block to its `CLAUDE.md` (`kind:`
`web` | `other-ui` | `non-ui`, plus `build:`, `serve-dir:`, `entry:`, `port:`, `inputs:` as
needed); with neither, `/show-it` auto-detects and falls back to an annotated diff.

`node .claude/tools/pr-cost.mjs <pr#> [--since <ref>] [--all]` prints the token / dollar digest
for the session(s) that produced a PR — `Used Σ191k(⊕289,⇄99.8%) ↑174 | $0.0407 4.0AIU` —
from the `Claude-Session` trailers `commit-it` stamps on every commit. `/ship-it` appends it to
the PR comment; `/release-it` puts the batch total in the release notes. Local transcripts only,
so it runs on the dev box, not CI.
