# Lessons log

Root cause + guardrail per shipped change, newest first. Consulted before new work —
grep the symptom before reproducing. Per-issue detail lives in `docs/design-notes/`; this is
the by-symptom index.

<!-- ponytail: single file; split by area if it outgrows one screen-scroll -->

## `npm install` fails in a consumer with ENOENT on `.claude/settings.json`

- **Root cause:** pre-2.0 consumers symlink `.claude/settings.json` into
  `node_modules/ha-card-shared/.claude/`; v2 stopped shipping that directory, so the link dangles
  and `writeFileSync` — which follows symlinks — throws out of `postinstall`. Where the target
  survives, the write silently lands in `node_modules` and the next install discards it.
- **Guardrail:** `setup-claude.js` `lstat`s the path first and drops a symlink that dangles or
  resolves inside `node_modules`, before reading it. Covered by
  `test/scripts/setup-claude.test.ts`. Generally: never write to a path the installer did not
  create without checking what is actually there.
- **Ref:** [#33](https://github.com/marcintk/ha-card-shared/issues/33) · 2026-08-29

## Git hooks silently do nothing in a consumer repo

- **Root cause:** `core.hooksPath` named a directory that was missing or empty — git runs no hook
  and reports nothing — and `wireGitHooks` skipped any value not containing `ha-card-shared`, so
  the leftover was permanent.
- **Guardrail:** a hooksPath resolving to a missing or empty directory is treated as a leftover and
  taken over; a populated directory of the consumer's own is still left alone, now with a test that
  actually creates it. Checking a config _value_ is not the same as checking that it _does_
  anything.
- **Ref:** [#33](https://github.com/marcintk/ha-card-shared/issues/33) · 2026-08-29

## A test outside `src/` passes coverage but fails `tsc` with TS7016

- **Root cause:** coverage `include` (`src/**/*.ts`) and tsconfig `include`
  (`src/**/*.ts`, `test/**/*.ts`) are different scopes. A root-level test is free for coverage,
  but importing an untyped `.mjs` config from it is an implicit `any` under `strict`.
- **Guardrail:** shared `.mjs` entry points that tests import ship a sibling declaration file —
  `rollup.base.d.mts` — listed in `package.json` `files` so consumers get the types too. Reach for
  a `.d.mts`, not a `@ts-expect-error`.
- **Ref:** [#32](https://github.com/marcintk/ha-card-shared/issues/32) · 2026-08-29

## `process.env.X = undefined` does not unset the variable

- **Root cause:** assigning to `process.env` coerces the value to a string, so the property becomes
  the literal `"undefined"` — truthy, and it silently defeats a `name || "card"` fallback, making a
  fallback test pass for the wrong reason or fail confusingly.
- **Guardrail:** `delete process.env.X` is the only real unset; restore in `afterEach` by branching
  on whether the original was `undefined`. Noted inline in `test/rollup-base.test.ts`.
- **Ref:** [#32](https://github.com/marcintk/ha-card-shared/issues/32) · 2026-08-29

## Design-note links show `.html` as source, or route through a third-party proxy

- **Root cause:** GitHub renders a linked `.html` file as source, not a page; `raw.githack.com`
  works but is third-party and shows an interstitial.
- **Guardrail:** the notes live in `docs/design-notes/` and GitHub Pages is set to deploy
  from `main` `/docs` (`docs/.nojekyll` disables Jekyll), so
  `docs/design-notes/<file>.html` serves at
  `marcintk.github.io/ha-card-shared/design-notes/<file>.html` — the URL the `explain-it`
  skill and `docs/design-notes/README.md` link to.
- **Ref:** [#25](https://github.com/marcintk/ha-card-shared/issues/25) · 2026-08-28

## Workflow relied on checklist discipline, not enforcement

- **Root cause:** the procedure lived in `CLAUDE-SHARED.md` as prose — nothing stopped a direct
  commit to `main`, a non-draft release, or a run that skipped a step.
- **Guardrail:** `pre-commit` blocks commits to `main`; release workflows always create the
  GitHub Release as a draft; the pipelines moved into `disable-model-invocation` skill files;
  the `skill-guard` hook (`hooks/skill-guard.*`) blocks operations outside the active skill's
  or subagent role's remit (see below).
- **Ref:** [#25](https://github.com/marcintk/ha-card-shared/issues/25) · 2026-08-28

## Pipeline depended on third-party plugins a fresh consumer never had

- **Root cause:** `/fix-it` etc. referenced `ponytail`, `caveman`, `tdd-guard` (marketplace
  plugins) and `grilling`, `improve-codebase-architecture` (user-global skills) — none shipped
  in the package, so a bare `npm install` gave a pipeline full of dangling commands.
- **Guardrail:** every dependency vendored into `skills/` / `agents/` / `hooks/` or folded
  into a built-in (`/code-review`, `/simplify`). `package.json` `files` ships `agents/` +
  `hooks/`; `setup-claude.js` symlinks them and merges the `skill-guard` hooks. No marketplace
  install step remains.
- **Ref:** [#25](https://github.com/marcintk/ha-card-shared/issues/25) · 2026-08-28
