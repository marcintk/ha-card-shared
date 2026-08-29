---
name: pr-it
description: The ship tail of fix-it / feature-it — commit, push, open the PR, post the explain-diff comment, then (after the human says so) watch CI and squash-merge. Two phases: open, merge.
---

# Pr-It

**Invocation:** AI (a sub-skill). Extracted from `/fix-it` and `/feature-it` so the commit →
merge mechanics live in one place. The `[HUMAN] "merge it"` gate stays in the parent pipeline;
this skill runs the steps on either side of it.

Args: `<n>` issue number, `<slug>` kebab issue slug. Callers pass the GFM string returned by
`explain-it finalize`.

## open `<n> <slug>`

1. Write the commit message per the `commit-it` skill's convention (Conventional Commits, the
   mandated `Co-Authored-By` / `Claude-Session` trailers).
2. `git commit -F -` with that message. If `pre-commit` rewrites files or fails, fix and
   re-commit — loop until it passes.
3. `git push -u origin HEAD`.
4. `gh pr create` — title from the issue, body summarising the change and linking `#<n>`. For
   `/feature-it` with a forked design: one `pr-it open` call per independently-mergeable piece,
   forming a PR queue.
5. `gh pr comment <pr> --body-file /tmp/issue-<n>-explain-diff.md` (the GFM from
   `explain-it finalize`). If no PR exists yet, skip — the file is ready.

## merge

Runs after the parent's `[HUMAN] "merge it"`.

1. Confirm the explain-diff HTML (`docs/design-notes/issue-<n>-explain-diff.html`) was reviewed.
2. `gh run watch` — wait for CI green.
3. `gh pr merge --squash --delete-branch`.
4. `git checkout main && git pull`.
