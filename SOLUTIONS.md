# Solutions log

Root cause + guardrail per shipped change, newest first. Consulted before new work —
grep the symptom before reproducing. Per-issue detail lives in `design-notes/`; this is
the by-symptom index.

<!-- ponytail: single file; split by area if it outgrows one screen-scroll -->

## Design-note links show `.html` as source, or route through a third-party proxy

- **Root cause:** GitHub renders a linked `.html` file as source, not a page; `raw.githack.com`
  works but is third-party and shows an interstitial.
- **Guardrail:** GitHub Pages deploys from `main` at repo root with `.nojekyll`; the
  `explain-it` skill and `design-notes/README.md` point links at `marcintk.github.io/ha-card-shared/`.
- **Ref:** [#25](https://github.com/marcintk/ha-card-shared/issues/25) · 2026-08-28

## Workflow relied on checklist discipline, not enforcement

- **Root cause:** the procedure lived in `CLAUDE-SHARED.md` as prose — nothing stopped a direct
  commit to `main`, a non-draft release, or a run without tdd-guard.
- **Guardrail:** `pre-commit` blocks commits to `main`; release workflows always create the
  GitHub Release as a draft; `setup-claude.js` warns on missing tdd-guard and symlinks every
  bundled skill; the pipelines moved into `disable-model-invocation` skill files.
- **Ref:** [#25](https://github.com/marcintk/ha-card-shared/issues/25) · 2026-08-28
