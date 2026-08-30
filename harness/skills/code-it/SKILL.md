---
name: code-it
description: TDD implementation phase — turns an approved design-it note into a reviewed, coverage-green branch, one red-green slice at a time. Use when the user says "/code-it", "implement issue <n>", or wants to build a change whose design note is already approved.
disable-model-invocation: true
---

# Code-It

**Invocation:** HUMAN only — `disable-model-invocation` keeps the model from auto-running it.

Approved design note → reviewed branch. Never runs ahead of `/design-it` — an unapproved or
missing note means stop and point back at it, not infer one.

Print each step as `- [ ] …` before starting it, `- [x] …` once done. Never skip one silently —
if a step can't be honestly checked, stop and ask. Every `[HUMAN]` step opens with 2–3 lines —
what changed, why it matters, the risk if wrong — before asking, not a status recap.

## Steps

1. `node .claude/hooks/skill-guard.mjs phase code`.
2. Read the note's declared slices and re-grep `LESSONS.md` for the problem class — a fresh
   context (a resumed session) gets the same guardrail check `/design-it` already did once.
3. Branch, if not already on one: `git checkout -b <type>/<slug>`.
4. Per slice, in order:
   1. **[SUBAGENT: `test-writer`]** Given only the seam and expected behavior from the
      note — not the design reasoning — writes one test. Confirm it fails for the right reason.
   2. `node .claude/hooks/skill-guard.mjs red <test-file>`.
   3. **[SUBAGENT: `code-writer`]** Implements the minimal fix. The guard blocks any `src/`
      write until step 2's marker is set, and blocks edits to the test itself.
   4. Run the suite. Confirm the target test is green and nothing else broke.
   5. `node .claude/hooks/skill-guard.mjs green`.
   6. **[SUBAGENT: `reviewer`]** `/code-review` (correctness + an over-engineering
      pass) + `/simplify` (apply the reuse / altitude cleanups).
   7. `show-it` — render the slice's effect (preview URL or before/after report) so the human
      can eyeball it before the gate. Read-only with respect to tracked source.
   8. **[HUMAN]** Accept, or grill and loop back to 4.1 for this slice. Third loop on the same
      slice → stop, `/design-it <n>` to re-open the design instead of a fourth patch.
   9. On accept: `explain-it slice <n> <slug>` (note update), then `explain-it compound <n>
<slug>` — append the transferable learning to `LESSONS.md`, or tell it there's nothing to
      compound. Not every slice earns an entry.
   10. `commit-it` for the message, then `git commit -F -` — the reviewed, green slice lands as
       its own commit. If `pre-commit` rewrites files or fails, fix and re-commit until it passes.
5. Once every slice is accepted: `npm run test:coverage` — must hold 100%.
6. `node .claude/hooks/skill-guard.mjs phase clear` — `/ship-it` sets its own phase; don't
   leave `code` armed between phases. (Mid-run, between slices, the phase stays — it expires on
   its own after `phase_stale_seconds` if the run is abandoned.)

Output: **a branch, every slice reviewed, accepted and committed, coverage green** — ready for
`/ship-it`.
