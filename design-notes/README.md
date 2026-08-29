# Design notes

One HTML note per issue, owned by the `explain-it` skill (which `/fix-it` and `/feature-it`
call) and committed in that issue's PR. Two files per issue once it ships:

- `issue-<n>-<slug>.html` — the design note (status `in progress` → `approved`)
- `issue-<n>-explain-diff.html` — the explain-diff render (`explain-it finalize`), archived from the PR

Both open automatically when the skill produces them. The table links point at **GitHub Pages**
(`marcintk.github.io/ha-card-shared/design-notes/…`), which serves the committed `.html`
rendered — GitHub itself shows a linked `.html` file as source, not a page. `deploy-design-notes.yml`
publishes only this folder (staged under `/design-notes/`) on every push to `main` that touches
it; a `.nojekyll` marker keeps Pages from reprocessing the files.

| Issue                                                       | Note                                                                                                                        | Explain-diff | Status      | PR  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- | --- |
| [#25](https://github.com/marcintk/ha-card-shared/issues/25) | [workflow-enforcement-gaps](https://marcintk.github.io/ha-card-shared/design-notes/issue-25-workflow-enforcement-gaps.html) | —            | in progress | —   |
