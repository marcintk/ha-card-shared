# Design notes

One HTML note per issue, owned by the `explain-it` skill (which `/fix-it` and `/feature-it`
call) and committed in that issue's PR. Two files per issue once it ships:

- `issue-<n>-<slug>.html` — the design note (status `in progress` → `approved`)
- `issue-<n>-explain-diff.html` — the `explain-diff-gfm` render, archived from the PR

Both open automatically when the skill produces them. The links in the table go through
`raw.githack.com`, which serves the committed HTML **rendered** — GitHub itself shows a linked
`.html` file as source, not a page.

| Issue                                                       | Note                                                                                                                          | Explain-diff | Status      | PR  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- | --- |
| [#25](https://github.com/marcintk/ha-card-shared/issues/25) | [workflow-enforcement-gaps](https://raw.githack.com/marcintk/ha-card-shared/main/design-notes/issue-25-workflow-enforcement-gaps.html) | —            | in progress | —   |
