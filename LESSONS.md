# Lessons log

Root cause + guardrail per shipped change, newest first. Consulted before new work —
grep the symptom before reproducing. Per-issue detail lives in `design-notes/`; this is
the by-symptom index.

<!-- ponytail: single file; split by area if it outgrows one screen-scroll -->

## Design-note links show `.html` as source, or route through a third-party proxy

- **Root cause:** GitHub renders a linked `.html` file as source, not a page; `raw.githack.com`
  works but is third-party and shows an interstitial.
- **Guardrail:** `deploy-design-notes.yml` publishes `design-notes/` to GitHub Pages
  (staged under `/design-notes/`, `.nojekyll`); the `explain-it` skill and
  `design-notes/README.md` point links at `marcintk.github.io/ha-card-shared/design-notes/`.
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
