---
name: feature-it
description: Run the feature-it pipeline for a feature, chore, docs change, or any other non-bug change from an existing GH issue. Use when the user says "/feature-it", "build issue <n>", or wants to make a change that isn't a bug fix — including a small one; this is the only path for that, its steps just move fast for trivial changes.
disable-model-invocation: true
---

# Feature-It

**Invocation:** HUMAN.

GH issue → one PR, or a small queue of them. The only path for any change that isn't a bug fix —
a new export, a chore, a dependency bump, a doc rewrite. For a trivial change every step still
happens, just fast: one line of design, one slice, one review pass.

Print each step as `- [ ] …` before starting it, `- [x] …` once done. Never skip one silently —
if a step can't be honestly checked, stop and ask. Every `[HUMAN]` step opens with 2–3 lines —
what changed, why it matters, the risk if wrong — before asking, not a status recap.

## Precondition

Needs an issue number: `/feature-it <n>`. No number, or an idea described in chat with nothing
filed yet → stop, tell the user to file the issue first (`brainstorm-it` drafts one from a fuzzy
idea). Don't create it for them.

## Steps

1. **[HUMAN input]** Read the issue: `gh issue view <n> --json title,body,comments`. This is the
   input.
2. **[SUBAGENT: `pipeline-explore`]** 1–3 in parallel if scope is uncertain — grep `LESSONS.md`
   for the problem class, plus prior art and reusable patterns already in this repo. Skip
   outright for a genuinely trivial change (a typo, a version bump) — nothing to research.
3. **[HUMAN]** Design + grill (`brainstorm-it` skill) — approach, files touched, trade-offs,
   every open question closed. One concern per PR — extras become a separate GH issue. For a
   trivial change this is one or two lines, not a proposal; it still happens, just short.
4. **[SKILL: explain-it]** Run `explain-it start <n> <slug>` — it creates the design note from
   step 3's approach, sets status `in progress`, adds the `design-notes/README.md` row, and opens
   the note in the browser.
5. **[HUMAN]** Go-ahead gate. No code before this.
6. **[SUBAGENT: `pipeline-test-writer`] → [SUBAGENT: `pipeline-coder`]**, per vertical slice — one seam,
   one red test written with zero context from step 3's reasoning, one minimal implementation.
   The `skill-guard` hook enforces red-before-green on every slice. Run `explain-it slice
<n> <slug>` after each slice.
7. **[HOOK]** `pre-commit` (lint, typecheck, branch guard) and `pre-push` (100% coverage) fire on
   their own.
8. **[SUBAGENT: `pipeline-reviewer`]** `/code-review` (correctness + an over-engineering pass) +
   `/simplify` (apply the cleanups).
9. **[HUMAN]** Accept, or grill and loop back to step 6, same slice. Third loop on one slice →
   stop, `/rewind` to step 3, re-open the design instead of a fourth patch.
10. On accept: **[SKILL: explain-it]** run `explain-it compound <n> <slug>` per PR — append the
    transferable learning (the problem class, what the approach turned on, the guardrail now in
    place) to `LESSONS.md`, or tell it there's nothing to compound. Ships in that PR's diff.
11. **[SKILL: explain-it]** run `explain-it finalize <n> <slug>` per PR — it sets the note to
    `approved`, renders `design-notes/issue-<n>-explain-diff.html`, updates the README row, and
    returns the GFM output. Then **[SKILL: pr-it]** run `pr-it open <n> <slug>` with that GFM —
    one call per independently-mergeable piece if step 3's design forked, entering a **PR queue**
    rather than a single branch. Issue body overwritten with the final snapshot.
12. **[HUMAN]** Wait for "merge it" per PR in the queue, then **[SKILL: pr-it]** run `pr-it merge`
    for that PR — it confirms the explain-diff HTML was reviewed, watches CI, squash-merges, and
    returns to `main`.

Output: **one PR, or a small queue of independently-mergeable PRs.**
