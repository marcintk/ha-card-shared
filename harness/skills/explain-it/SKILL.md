---
name: explain-it
description: Owns the design-note lifecycle under docs/design-notes/ plus the LESSONS.md log for the design-it / code-it / ship-it pipeline — create the note, approve it, update it per slice, compound the transferable learning, finalize it with the explain-diff render and the README row. Those skills call it; run it directly as `explain-it <phase> <n> <slug>` to redo a phase.
---

# Explain-It

**Invocation:** HUMAN or AI — `design-it` / `code-it` / `ship-it` call it; a human may run
`explain-it <phase> <n> <slug>` directly to redo a phase. Frontmatter carries no invocation block.

Single owner of `docs/design-notes/` and `LESSONS.md`. `/design-it`, `/code-it`, and `/ship-it`
call this instead of carrying the capture logic themselves. One design note per issue, committed
in that issue's PR.

Phases: `start`, `approve`, `slice`, `compound`, `finalize`. Args: `<n>` issue number, `<slug>`
kebab issue slug.

## start `<n> <slug>`

1. Load `artifact-design` for design guidance.
2. Create `docs/design-notes/issue-<n>-<slug>.html` — a standalone, self-contained HTML file, no
   external deps. Not an Artifact: it ships in the PR diff.
   - First draft content: for a bug fix, the symptom and the reproduction evidence. For a
     feature/chore/docs change, the approach from the grill.
   - Status badge: `in progress`.
3. Add a row to `docs/design-notes/README.md`: issue link; a **Note** link to
   `https://marcintk.github.io/ha-card-shared/design-notes/issue-<n>-<slug>.html` (GitHub Pages —
   renders in the browser; a plain repo link shows `.html` as source); **Explain-diff** `—`;
   status `in progress`; PR `—`. The Pages link is live only after the PR merges to `main`.
4. `xdg-open docs/design-notes/issue-<n>-<slug>.html 2>/dev/null || true` — always open on first draft.

## approve `<n> <slug>`

`/design-it` calls this once the human approves the design, before any code exists. Status badge
→ `approved` (edit the file). `xdg-open` it again (guarded). Does not touch the explain-diff —
that's `finalize`, later, once there's a diff to explain.

## slice `<n> <slug>`

Edit the note with what the last vertical slice changed. `/code-it` calls this after each slice.

## compound `<n> <slug>`

Runs after a slice is accepted, before `finalize` — so the entry ships in the same PR.
Append the transferable learning to `LESSONS.md` (repo root), the by-symptom log consulted
before new work. Distinct from the design note: the note is per-issue detail, this is one
greppable "if you see X, the cause was Y, and Z now guards it" line for the next run.

1. If the caller says there is nothing to compound — a typo, a version bump, anything that
   taught nothing reusable — no-op and return. Not every run earns an entry.
2. If `LESSONS.md` is absent, create it with this header:

   ```markdown
   # Lessons log

   Root cause + guardrail per shipped change, newest first. Consulted before new work —
   grep the symptom before reproducing. Per-issue detail lives in `docs/design-notes/`; this is
   the by-symptom index.

   <!-- ponytail: single file; split by area if it outgrows one screen-scroll -->
   ```

3. **Dedupe first:** grep `LESSONS.md` for an existing entry on this problem class. Found →
   update that entry in place (sharpen the root cause, add the new guardrail, refresh the
   `Ref`). Do not append a twin.
4. Otherwise **prepend** one entry directly under the header, synthesised from the design note
   and the accepted diff:

   ```markdown
   ## <symptom / problem class — what someone would grep for>

   - **Root cause:** one line
   - **Guardrail:** the test / rule / hook / doc that now prevents recurrence
   - **Ref:** [#<n>](<issue url from `gh issue view <n> --json url -q .url`>) · <YYYY-MM-DD>
   ```

   Issue link only — the PR does not exist yet at this phase and is reachable from the issue.

## finalize `<n> <slug>`

Status is already `approved` from the `approve` phase; this phase renders the diff, once there
is one.

1. Render the explain-diff (both formats) with the bundled renderer:
   1. Gather the diff — `git diff main...HEAD`, `git log main...HEAD --oneline`.
   2. `mkdir -p docs/design-notes/.work` (gitignored — a handoff scratch space scoped to this
      repo, not the machine-wide `/tmp` every sibling card repo also writes into).
   3. Write a JSON content spec to `docs/design-notes/.work/issue-<n>-explain-spec.json`:
      - `title`, `subtitle` (`Prepared YYYY-MM-DD · PR #NNN`), `slug` (kebab).
      - `sections[]` — **background** (deep context for beginners + narrow context for this
        change), **intuition** (the essence, concrete toy-data examples, figures),
        **code** (high-level tour, grouped sensibly). Each section has both `html` (rich, may
        use `.diagram`/`.flow`/`.box`/`.callout` classes — no ASCII diagrams) and `md`
        (markdown only, no raw HTML — GitHub strips it; fenced code + tables OK).
      - `quiz[]` — five medium-difficulty questions, exactly 4 options each, exactly 1
        `correct`. Not gotchas — checks real understanding.
      - Prose in the clear, flowing style of Martin Kleppmann.
   4. Render:
      ```bash
      python3 .claude/skills/explain-it/scripts/render.py \
        docs/design-notes/.work/issue-<n>-explain-spec.json \
        -o docs/design-notes/issue-<n>-explain-diff.html
      python3 .claude/skills/explain-it/scripts/render.py \
        docs/design-notes/.work/issue-<n>-explain-spec.json --format gfm \
        -o docs/design-notes/.work/issue-<n>-explain-diff.md
      ```
      The HTML ships in the PR diff; the `.md` is the GFM string returned below. `xdg-open` the
      HTML (guarded).
2. Update the `docs/design-notes/README.md` row: fill the **Explain-diff** link (same
   `marcintk.github.io/ha-card-shared/design-notes/` path for `issue-<n>-explain-diff.html`). The
   PR link isn't known yet — `ship-it` fills that in once `gh pr create` returns.
3. Return the GFM output (`docs/design-notes/.work/issue-<n>-explain-diff.md`) to the caller for
   `gh pr comment`.
