---
name: design-it
description: Design phase for any change. `/design-it <n>` designs a filed GH issue into an approved note with slices declared; bare `/design-it` scans the repo for a deepening opportunity, files the issue, then designs it. /code-it implements the note.
disable-model-invocation: true
---

# Design-It

**Invocation:** HUMAN only — `disable-model-invocation` keeps the model from auto-running it.

Issue → approved design note. The only design entry point — a bug fix, a feature, a chore, a
one-line dependency bump, all take this path; a trivial change still moves through it, just fast.
**This skill does not converge early.** Re-invoking `/design-it <n>` on an existing note reopens
and re-grills it, from any conversation — the note plus the issue are the whole state.

Print each step as `- [ ] …` before starting it, `- [x] …` once done. Never skip one silently —
if a step can't be honestly checked, stop and ask. Every `[HUMAN]` step opens with 2–3 lines —
what changed, why it matters, the risk if wrong — before asking, not a status recap.

## Modes

- **`/design-it <n>`** — an issue is filed. Go straight to Steps.
- **`/design-it`** (no number) — discovery. Run **Scanning for candidates** in
  `.claude/design-methods/processes.md`: scope (a named area, else `git log` hot spots), an
  `explorer` pass for shallow modules, a ranked report. **[HUMAN]** picks one; then `gh issue
create` with a title + body from the pick and continue at Step 2 with that `<n>`. Run from
  `/release-it` for the repo-wide pass, or directly.
- A fuzzy idea already in mind, no issue → `brainstorm-it` drafts one, then `/design-it <n>`.
  Don't file it for them in that case — that's `brainstorm-it`'s job.

## Steps

1. `node .claude/hooks/skill-guard.mjs phase design`.
2. **[HUMAN input]** Read the issue: `gh issue view <n> --json title,body,comments`. This is the
   input — nothing else assumed.
3. Grep `LESSONS.md` for the problem class _before_ thinking about approach. Report any prior
   root cause and the guardrail already in place — a fix already guarded against is not this
   issue.
4. **[SUBAGENT: `explorer`]** 1–3 in parallel if scope is uncertain — reproduce (a bug:
   concrete evidence, what's ruled out) or scan prior art and reusable patterns (a feature). Skip
   outright for a genuinely trivial change — nothing to research.
5. **[HUMAN]** `brainstorm-it` — one question at a time, recommended answer given, decisions are
   the human's. One concern per issue; extras become a separate GH issue, not scope creep.
6. **Design it twice**, for anything non-trivial: work from `.claude/design-methods/`
   (`glossary.md`, `design.md`, `discipline.md`) and run the **Design it twice** playbook in
   `processes.md` — at least two materially different approaches written out and compared before
   either is judged. A single-approach note is not finishable.
7. **Adjacent-opportunity pass**, before converging: what does this change make cheap, what does
   it foreclose? Anything worth doing separately is named and becomes its own GH issue — not
   folded in here.
8. `explain-it start <n> <slug>` — creates the note from steps 3–7, status `in progress`, README
   row, opened in the browser. Declare the slices this change breaks into (one, for a bug or a
   trivial change) directly in the note.
9. Loop 5–8 until the human approves.
10. On approval: `explain-it approve <n> <slug>` — status → `approved`.
11. `node .claude/hooks/skill-guard.mjs phase clear` — the note is the state now; don't leave
    the `design` phase armed to block unrelated work if `/code-it` doesn't follow immediately.

Output: **one approved design note**, ready for `/code-it`.
