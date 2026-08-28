---
name: fix-it
description: Run the fix-it pipeline for a bug fix from an existing GH issue. Use when the user says "/fix-it", "fix issue <n>", or asks to fix a bug that already has a GH issue filed.
disable-model-invocation: true
---

# Fix-It

Bug report → one PR. This skill orchestrates the whole pipeline in this session: reproduce, red
test, minimal fix, review, PR. The GH issue is both the input and the state store — read at the
start, its body overwritten (not appended to) at each step, marked approved before it ships.

Print each step as `- [ ] …` before starting it, `- [x] …` once done. Never skip one silently —
if a step can't be honestly checked, stop and ask. Every `[HUMAN]` step opens with 2–3 lines —
what changed, why it matters, the risk if wrong — before asking, not a status recap.

## Precondition

Needs an issue number: `/fix-it <n>`. No number, or a bug described in chat with nothing filed
yet → stop, tell the user to file the issue first. Don't create it for them.

## Steps

1. **[HUMAN input]** Read the issue: `gh issue view <n> --json title,body,comments`. This is the
   input — expected vs. actual, nothing else assumed.
2. **[SUBAGENT: Explore]** Reproduce, read-only — grep `SOLUTIONS.md` for the symptom first
   (note any prior root cause and the guardrail already in place), then locate the code path,
   gather concrete evidence (command output, an instrumented value), name what's ruled out.
3. **[SKILL: explain-it]** Run `explain-it start <n> <slug>` — it creates the design note from the
   symptom and the step 2 evidence, sets status `in progress`, adds the `design-notes/README.md`
   row, and opens the note in the browser.
4. **[SUBAGENT: fresh context]** Write the failing test — a subagent given only the seam and
   expected behavior, not step 2's reproduction reasoning. It writes a test that fails on current
   code.
5. **[SUBAGENT: coder]** Implement the minimal fix. tdd-guard blocks this from starting before
   step 4's test is red, and blocks writing beyond what that test demands.
6. **[HOOK]** `pre-commit` (lint, typecheck, branch guard) and `pre-push` (100% coverage) fire on
   their own — nothing to do here but let them run and fix what they flag.
7. **[SUBAGENT: reviewer]** `/ponytail-review` (over-engineering) + `/code-review` (correctness).
8. **[HUMAN]** Accept, or grill and loop back to step 5. Third loop on this same fix → stop,
   `/rewind` to step 3, re-open the design instead of a fourth patch.
9. On accept: **[SKILL: explain-it]** run `explain-it compound <n> <slug>` — append the
   transferable learning (symptom, root cause, the guardrail now in place) to `SOLUTIONS.md`,
   or tell it there's nothing to compound. Ships in this PR's diff.
10. **[SKILL: explain-it]** run `explain-it finalize <n> <slug>` — it sets the note to
    `approved`, renders `design-notes/issue-<n>-explain-diff.html`, updates the README row, and
    returns the GFM output. Then commit (`/caveman-commit`, loop until pre-commit passes), push,
    `gh pr create`, `gh pr comment` with that GFM output. Issue body overwritten with the final
    snapshot.
11. **[HUMAN]** Wait for "merge it". Confirm the explain-diff HTML was reviewed, then `gh run watch`
    → `gh pr merge --squash --delete-branch` → `git checkout main && git pull`.

Output: **one PR.**
