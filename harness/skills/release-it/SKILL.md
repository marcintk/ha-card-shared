---
name: release-it
description: Release a new version of this card — bump semver, tag, push. Use only when the user explicitly says "/release-it", "release", or "release it". Never trigger this on your own.
disable-model-invocation: true
---

# Release-It

**Invocation:** HUMAN.

Bumps and tags a release from `main`. Separate from any single `/ship-it` run — this runs after
a batch of merged PRs.

> **Rule:** Never trigger autonomously. Only run when the user explicitly says "release" or
> "release it".

Print each step as `- [ ] …` before starting it, `- [x] …` once done. Never skip one silently —
if a step can't be honestly checked, stop and ask. The `[HUMAN]` step opens with 2–3 lines — what
changed, why it matters, the risk if wrong — before asking, not a status recap.

## Steps

1. `node harness/hooks/skill-guard.mjs phase release`.
2. Verify all recent CI runs on `main` show ✓: `gh run list --branch main --limit 5`.
3. Run `/code-review` over the repo (or `/simplify` on `main`) for a repo-wide correctness +
   over-engineering pass. Any finding → fix through `/design-it` + `/code-it` + `/ship-it`,
   merge, then re-run. Only continue once it comes back clean.
4. Refresh `LESSONS.md`: drop any entry whose named guardrail no longer exists, merge any
   duplicates that slipped past `explain-it compound`'s dedupe. ~2 minutes, human eyes.
5. **[HUMAN]** Run `/improve-it`. Any deepening opportunity you accept → its own
   `/design-it` + `/code-it` + `/ship-it` run, merge, then re-run from step 2. Only continue
   once nothing is left worth taking.
6. **[HUMAN]** Determine the semver bump — state it, don't just pick it silently:
   - **patch** — bug fixes, docs, no API change. Batch freely.
   - **minor** — new export or toolchain feature, backward-compatible. Release after 2–3 PRs.
   - **major** — any breaking change (removed/renamed export, changed signature, consumers must
     update). Release immediately after merge.
7. Bump version on a release branch, then land it through a normal PR — `pre-commit` blocks every
   commit on `main`, and a bare `npm version` shells out to a plain `git commit`, so it must not
   run there:
   ```bash
   git checkout -b release/vX.Y.Z
   npm version patch|minor|major --no-git-tag-version   # edits package.json only; no commit, no tag
   git commit -am "chore: bump version to X.Y.Z"
   git push -u origin HEAD
   gh pr create --title "chore: bump version to X.Y.Z" --body "Release prep for vX.Y.Z."
   ```
   Wait for CI, then `gh pr merge --squash --delete-branch` — same as any `/ship-it` PR.
8. Tag the merged commit on `main` — a tag is not a commit, so the `main` guard never fires:
   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
   CI creates the GitHub Release as a **draft** — every release, always.
9. Write the customer-facing release notes into the draft: `gh release edit <tag> --notes-file -`
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
10. **[HUMAN]** Publish the draft from the GitHub Releases UI once the notes and the
    `dist/<project>.js` asset check out.
11. `node harness/hooks/skill-guard.mjs phase clear`.
