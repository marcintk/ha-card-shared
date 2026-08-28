# Design notes

One HTML note per issue, owned by the `explain-it` skill (which `/fix-it` and `/feature-it`
call) and committed in that issue's PR. Two files per issue once it ships:

- `issue-<n>-<slug>.html` — the design note (status `in progress` → `approved`)
- `issue-<n>-explain-diff.html` — the `explain-diff-gfm` render, archived from the PR

Both open in the browser automatically when the skill produces them.

| Issue                                                       | Slug                      | Status      | PR  |
| ----------------------------------------------------------- | ------------------------- | ----------- | --- |
| [#25](https://github.com/marcintk/ha-card-shared/issues/25) | workflow-enforcement-gaps | in progress | —   |
