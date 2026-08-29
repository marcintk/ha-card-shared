---
name: design-it
description: Design phase for any change — bug fix, feature, chore, docs — from an existing GH issue. Produces an approved design note with slices declared; /code-it implements it. Use when the user says "/design-it", "design issue <n>", or wants to plan a change that already has a GH issue filed.
disable-model-invocation: true
---

# Design-It

**Invocation:** HUMAN.

GH issue → approved design note. The only design entry point — a bug fix, a feature, a chore, a
one-line dependency bump, all take this path; a trivial change still moves through it, just fast.
**This skill does not converge early.** Re-invoking `/design-it <n>` on an existing note reopens
and re-grills it, from any conversation — the note plus the issue are the whole state.

Print each step as `- [ ] …` before starting it, `- [x] …` once done. Never skip one silently —
if a step can't be honestly checked, stop and ask. Every `[HUMAN]` step opens with 2–3 lines —
what changed, why it matters, the risk if wrong — before asking, not a status recap.

## Precondition

Needs an issue number: `/design-it <n>`. No number, or an idea described in chat with nothing
filed yet → stop, tell the user to file the issue first (`brainstorm-it` drafts one from a fuzzy
idea). Don't create it for them.

## Steps

1. `node harness/hooks/skill-guard.mjs phase design`.
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
6. **Design it twice**, for anything non-trivial: run `codebase-design`
   ([DESIGN-IT-TWICE.md](../codebase-design/DESIGN-IT-TWICE.md)) — at least two materially
   different approaches written out and compared before either is judged. A single-approach note
   is not finishable.
7. **Adjacent-opportunity pass**, before converging: what does this change make cheap, what does
   it foreclose? Anything worth doing separately is named and becomes its own GH issue — not
   folded in here.
8. `explain-it start <n> <slug>` — creates the note from steps 3–7, status `in progress`, README
   row, opened in the browser. Declare the slices this change breaks into (one, for a bug or a
   trivial change) directly in the note.
9. Loop 5–8 until the human approves.
10. On approval: `explain-it approve <n> <slug>` — status → `approved`.

Output: **one approved design note**, ready for `/code-it`.
