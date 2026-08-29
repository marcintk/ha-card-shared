---
name: ship-it
description: Release a new version of this card — bump semver, tag, push. Use only when the user explicitly says "/ship-it", "ship", or "release it". Never trigger this on your own.
disable-model-invocation: true
---

# Ship-It

**Invocation:** HUMAN.

Bumps and tags a release. Separate from any single `/fix-it` or `/feature-it` run — this runs
after a batch of their PRs have already merged to `main`.

> **Rule:** Never trigger autonomously. Only run when the user explicitly says "ship" or
> "release it".

Print each step as `- [ ] …` before starting it, `- [x] …` once done. Never skip one silently —
if a step can't be honestly checked, stop and ask. The `[HUMAN]` step opens with 2–3 lines — what
changed, why it matters, the risk if wrong — before asking, not a status recap.

## Steps

1. Verify all recent CI runs on `main` show ✓: `gh run list --branch main --limit 5`.
2. Run `/code-review` over the repo (or `/simplify` on `main`) for a repo-wide correctness +
   over-engineering pass. Any finding → fix through `/fix-it` or `/feature-it`, merge, then
   re-run. Only continue once it comes back clean.
3. Skim `LESSONS.md`: drop any entry whose named guardrail no longer exists, merge any
   duplicates that slipped past `explain-it compound`'s dedupe. ~2 minutes, human eyes.
4. **[HUMAN]** Run `/improve-it` (it is `disable-model-invocation: true` — the human runs it).
   Any deepening opportunity you accept → its own `/feature-it` run, merge, then re-run from
   step 1. Only continue once nothing is left worth taking.
5. **[HUMAN]** Determine the semver bump — state it, don't just pick it silently:
   - **patch** — bug fixes, docs, no API change. Batch freely.
   - **minor** — new export or toolchain feature, backward-compatible. Ship after 2–3 PRs.
   - **major** — any breaking change (removed/renamed export, changed signature, consumers must
     update). Ship immediately after merge.
6. Bump version: `npm version patch|minor|major` (updates `package.json`, commits, creates the
   local tag).
7. Push: `git push --follow-tags`. CI creates the GitHub Release as a **draft** — every release,
   always.
8. Write the customer-facing release notes into the draft: `gh release edit <tag> --notes-file -`
   (or `--notes`). Not a commit dump — read `git log <prev-tag>..<tag>` and the merged PRs, then
   translate into what a consumer actually sees. Two sections, then one link line:
   - **What's new** — features and changes worth knowing, one bullet each, in the consumer's words
     (a new export, a workflow skill, a toolchain capability). Drop internal churn a consumer
     never touches.
   - **What you'll notice right after updating** — the immediate effect of `npm install`: required
     re-wiring, new peer deps, changed commands, any breaking change and its one migration step.
     Write "Nothing — drop-in." if there genuinely is none.
   - `**Full changelog**: https://github.com/marcintk/ha-card-shared/compare/<prev-tag>...<tag>`
     (`<prev-tag>` = the previous release tag, `git describe --tags --abbrev=0 HEAD^`).
9. **[HUMAN]** Publish the draft from the GitHub Releases UI once the notes and the
   `dist/<project>.js` asset check out.
