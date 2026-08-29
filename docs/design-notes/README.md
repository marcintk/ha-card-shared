# Design notes

One HTML note per issue, owned by the `explain-it` skill (which `/fix-it` and `/feature-it`
call) and committed in that issue's PR. Two files per issue once it ships:

- `issue-<n>-<slug>.html` — the design note (status `in progress` → `approved`)
- `issue-<n>-explain-diff.html` — the explain-diff render (`explain-it finalize`), archived from the PR

Both open automatically when the skill produces them. The table links point at **GitHub Pages**
(`marcintk.github.io/ha-card-shared/design-notes/…`), which serves the committed `.html`
rendered — GitHub itself shows a linked `.html` file as source, not a page. Pages deploys from
`main` `/docs`, so this folder (`docs/design-notes/`) is served under `/design-notes/`;
`docs/.nojekyll` stops Jekyll from reprocessing the files.

| Issue                                                       | Note                                                                                                       | Explain-diff                                                                                      | Status   | PR  |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | --- |
| [#32](https://github.com/marcintk/ha-card-shared/issues/32) | [Naming the bundle](https://marcintk.github.io/ha-card-shared/design-notes/issue-32-build-project-js.html) | [Explain-diff](https://marcintk.github.io/ha-card-shared/design-notes/issue-32-explain-diff.html) | approved | #39 |
