---
name: explain-it
description: Owns the design-note lifecycle under design-notes/ for the fix-it and feature-it pipelines — create the note, update it per slice, finalize it with the explain-diff-gfm render and the README row. Those skills call it; run it directly as `explain-it <phase> <n> <slug>` to redo a phase.
---

# Explain-It

Single owner of `design-notes/`. `/fix-it` and `/feature-it` call this at three points instead of
carrying the note logic themselves. One design note per issue, committed in that issue's PR.

Phases: `start`, `slice`, `finalize`. Args: `<n>` issue number, `<slug>` kebab issue slug.

## start `<n> <slug>`

1. Load `artifact-design` for design guidance.
2. Create `design-notes/issue-<n>-<slug>.html` — a standalone, self-contained HTML file, no
   external deps. Not an Artifact: it ships in the PR diff.
   - First draft content: for a bug fix, the symptom and the reproduction evidence. For a
     feature/chore/docs change, the approach from the grill.
   - Status badge: `in progress`.
3. Add a row to `design-notes/README.md`: issue link; a **Note** link to
   `https://marcintk.github.io/ha-card-shared/design-notes/issue-<n>-<slug>.html` (GitHub Pages —
   renders in the browser; a plain repo link shows `.html` as source); **Explain-diff** `—`;
   status `in progress`; PR `—`. The Pages link is live only after the PR merges to `main`.
4. `xdg-open design-notes/issue-<n>-<slug>.html 2>/dev/null || true` — always open on first draft.

## slice `<n> <slug>`

Edit the note with what the last vertical slice changed. `/feature-it` calls this after each
slice; `/fix-it` has a single fix and skips it.

## finalize `<n> <slug>`

1. Status badge → `approved` (edit the file). `xdg-open` it again (guarded).
2. Run `explain-diff-gfm`. Render the HTML to `design-notes/issue-<n>-explain-diff.html`
   (`render.py -o …`) so it ships in the PR diff. `xdg-open` it (guarded).
3. Update the `design-notes/README.md` row: fill the **Explain-diff** link (same
   `marcintk.github.io/ha-card-shared/design-notes/` path for `issue-<n>-explain-diff.html`), set
   status `approved`, add the PR link.
4. Return the GFM output to the caller for `gh pr comment`.
