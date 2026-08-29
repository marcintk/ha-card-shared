---
name: ship-it
description: Ship a reviewed branch from /code-it — commit, PR, explain-diff comment, CI, squash-merge. Use when the user says "/ship-it", "ship it", or a code-it branch is reviewed and ready for a PR.
disable-model-invocation: true
---

# Ship-It

**Invocation:** HUMAN only — `disable-model-invocation` keeps the model from auto-running it.

Reviewed branch → merged PR. Never runs ahead of `/code-it` — a branch with unreviewed or
unaccepted slices means stop and point back at it, not ship anyway.

Print each step as `- [ ] …` before starting it, `- [x] …` once done. Never skip one silently —
if a step can't be honestly checked, stop and ask. The `[HUMAN]` "merge it" gate opens with 2–3
lines — what changed, why it matters, the risk if wrong — before asking, not a status recap.

## Steps

1. `node .claude/hooks/skill-guard.mjs phase ship`.
2. `explain-it finalize <n> <slug>` — renders the explain-diff (HTML ships in the PR diff; GFM
   returned for the PR comment) and fills the README row's Explain-diff link. Status is already
   `approved` from `/design-it`; this step doesn't touch it.
3. `commit-it` for the message (Conventional Commits, the mandated trailers), then `git commit -F
-`. If `pre-commit` rewrites files or fails, fix and re-commit — loop until it passes.
4. `git push -u origin HEAD`.
5. `gh pr create` — title from the issue, body summarizing the change and linking `#<n>`.
6. Fill the README row's PR link with the number from step 5.
7. `gh pr comment <pr> --body-file` the step 2 GFM.
8. Overwrite the issue body with a final snapshot: what shipped, links to the note and the PR.
9. **[HUMAN]** Wait for "merge it".
10. `gh run watch` — wait for CI green.
11. `gh pr merge --squash --delete-branch`.
12. `git checkout main && git pull`.
13. `node .claude/hooks/skill-guard.mjs phase clear`.

Output: **one merged PR**, `main` up to date.
