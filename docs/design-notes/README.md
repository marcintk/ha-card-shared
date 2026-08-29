# Design notes

One HTML note per issue, owned by the `explain-it` skill (which `/design-it`, `/code-it`, and
`/ship-it` call) and committed in that issue's PR. Two files per issue once it ships:

- `issue-<n>-<slug>.html` — the design note (status `in progress` → `approved`)
- `issue-<n>-explain-diff.html` — the explain-diff render (`explain-it finalize`), archived from the PR

Both open automatically when the skill produces them. The table links point at **GitHub Pages**
(`marcintk.github.io/ha-card-shared/design-notes/…`), which serves the committed `.html`
rendered — GitHub itself shows a linked `.html` file as source, not a page. Pages deploys from
`main` `/docs`, so this folder (`docs/design-notes/`) is served under `/design-notes/`;
`docs/.nojekyll` stops Jekyll from reprocessing the files.

| Issue                                                       | Note                                                                                                                               | Explain-diff                                                                                      | Status   | PR  |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | --- |
| [#38](https://github.com/marcintk/ha-card-shared/issues/38) | [Hygiene batch](https://marcintk.github.io/ha-card-shared/design-notes/issue-38-hygiene-batch.html)                                | [Explain-diff](https://marcintk.github.io/ha-card-shared/design-notes/issue-38-explain-diff.html) | approved | #47 |
| [#37](https://github.com/marcintk/ha-card-shared/issues/37) | [Four verbs](https://marcintk.github.io/ha-card-shared/design-notes/issue-37-four-entry-points.html)                               | [Explain-diff](https://marcintk.github.io/ha-card-shared/design-notes/issue-37-explain-diff.html) | approved | #46 |
| [#36](https://github.com/marcintk/ha-card-shared/issues/36) | [Union, not override](https://marcintk.github.io/ha-card-shared/design-notes/issue-36-skill-guard-phase-role.html)                 | [Explain-diff](https://marcintk.github.io/ha-card-shared/design-notes/issue-36-explain-diff.html) | approved | #45 |
| [#35](https://github.com/marcintk/ha-card-shared/issues/35) | [Gates for the gatekeeper](https://marcintk.github.io/ha-card-shared/design-notes/issue-35-harness-lint-typecheck-gates.html)      | [Explain-diff](https://marcintk.github.io/ha-card-shared/design-notes/issue-35-explain-diff.html) | approved | #42 |
| [#34](https://github.com/marcintk/ha-card-shared/issues/34) | [Releasing without touching main](https://marcintk.github.io/ha-card-shared/design-notes/issue-34-release-path-vs-main-guard.html) | [Explain-diff](https://marcintk.github.io/ha-card-shared/design-notes/issue-34-explain-diff.html) | approved | #41 |
| [#33](https://github.com/marcintk/ha-card-shared/issues/33) | [Unsticking the installer](https://marcintk.github.io/ha-card-shared/design-notes/issue-33-postinstall-symlink-and-hookspath.html) | [Explain-diff](https://marcintk.github.io/ha-card-shared/design-notes/issue-33-explain-diff.html) | approved | #40 |
| [#32](https://github.com/marcintk/ha-card-shared/issues/32) | [Naming the bundle](https://marcintk.github.io/ha-card-shared/design-notes/issue-32-build-project-js.html)                         | [Explain-diff](https://marcintk.github.io/ha-card-shared/design-notes/issue-32-explain-diff.html) | approved | #39 |
