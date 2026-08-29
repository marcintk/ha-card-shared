# Lessons log

Root cause + guardrail per shipped change, newest first. Consulted before new work —
grep the symptom before reproducing. Per-issue detail lives in `docs/design-notes/`; this is
the by-symptom index.

<!-- ponytail: single file; split by area if it outgrows one screen-scroll -->

## `/ship-it` cannot commit — `npm version` blocked by the main-branch guard

- **Root cause:** `harness/.githooks/pre-commit` blocks every commit on `main`, and the release
  step ran `npm version <bump>` there — which shells out to a plain `git commit` — so the guard
  meant for `/fix-it`/`/feature-it` also caught the one pipeline that never goes through a PR.
- **Guardrail:** `npm version <bump> --no-git-tag-version` runs on a `release/vX.Y.Z` branch,
  committed and merged through a normal PR; the tag is applied to `main` only after merge, since a
  tag is not a commit and never trips the hook. Asserted by `test/skills/ship-it.test.ts` against
  the skill's own prose.
- **Ref:** [#34](https://github.com/marcintk/ha-card-shared/issues/34) · 2026-08-29

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
