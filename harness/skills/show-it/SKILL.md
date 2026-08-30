---
name: show-it
description: Render what a just-made change looks like so a human can eyeball it before accepting a slice or shipping. Project-type aware — a browser preview for a UI bundle, a self-contained before/after HTML report for a library / CLI / pure-logic change. Called from /code-it at each slice's review gate, or run directly as `/show-it [what changed]`.
---

# Show-It

**Invocation:** HUMAN or AI — `/code-it` calls it at each slice's `[HUMAN]` review gate,
before asking accept-or-grill; a human runs `/show-it [hint]` any time there is something new
to look at. Frontmatter carries no invocation block — the pipeline needs to call it.

Surfaces the _effect_ of the current uncommitted change. Never a substitute for the test suite —
it answers "does this look right", not "is this correct". Read-only with respect to tracked
source: it may run builds and write generated preview artifacts, but it must never edit source,
tests, demo pages, or committed assets.

Repo-agnostic. Everything project-specific — the build command, where the demo lives, how a
non-UI change is best visualised — comes from the config sources in Step 2, not from here.
`$ARGUMENTS`, if given, is a free-text hint about what changed; fold it into the summary and,
for the report path, into what gets compared.

## Steps

Print each as `- [ ] …` before, `- [x] …` after.

1. **Summarise the change.** From `git diff --stat` + `git diff` (unstaged and staged) plus the
   hint, write one or two lines: what changed and what the reviewer should look for. Always
   produced, whichever path below runs.

2. **Resolve how to show it**, first match wins:

   1. **`npm run show`** (or `make show`) exists → run it, treat its output as the preview,
      stop. The repo owns the whole flow.
   2. **`.claude/skills/show-it/local.md`** exists → follow it verbatim; it owns Step 3.
   3. **A `## Show-It` block in the repo's `CLAUDE.md`** → read these keys (any subset):
      `kind:` (`web` | `other-ui` | `non-ui`), `build:` (command to produce the artifact),
      `serve-dir:` (dir to serve for a `web` preview), `entry:` (file within it to open),
      `port:` (preferred starting port), `inputs:` (for `non-ui` — how to exercise the change).
   4. **Auto-detect** what the block didn't pin:
      - `kind`: a bundler build script (`rollup`/`vite`/`esbuild`/`webpack`/`parcel`) **and** a
        demo HTML that loads the bundle → `web`. A `bin` entry, or `main`/`exports` with no DOM
        code → `non-ui`. An app / dev-server / TUI / Electron target → `other-ui`. Else fall back.
      - `build`: `npm run build` if that script exists.
      - `serve-dir` / `entry`: first that exists of `docs/index.html`, `demo/index.html`,
        `examples/index.html`, `public/index.html`, `./index.html`.

3. **Show it**, per resolved `kind`:

   - **`web`** — run the bundled helper with the resolved values:
     ```
     node .claude/skills/show-it/scripts/preview-web.mjs \
       --build "<build>" --serve-dir <serve-dir> --open <entry> [--port <port>]
     ```
     It rebuilds, (re)starts a symlink-aware static server on the first free port from `--port`
     (default 8777), opens the page, prints `READY <url>` and the stop command. Report the URL.
     Never edit the demo file; if it needs different data, say so and let the human change it.
   - **`other-ui`** — defer to the built-in `run` skill; report what it showed.
   - **`non-ui`** — build the before/after HTML report (below).
   - **fallback** — write the report with just the annotated diff and a plain-English "what to
     look for". Be honest that there is no rendered comparison.

4. **Hand back.** The preview URL, or the report path (`xdg-open` it, guarded). Note any
   background server and how to stop it. Leave generated artifacts in place — they are cheap.

## The before/after HTML report (`kind: non-ui` / fallback)

One self-contained file, no external deps, works offline — same family as `docs/design-notes/`.
Path: `docs/design-notes/.work/show-<n>-<slug>.html` when run inside `/code-it` for issue `<n>`
(the `.work` dir is gitignored), else `.claude/show-it/show-<YYYYMMDD-HHMMSS>.html` (`.claude/`
is gitignored in every consumer).
Load `artifact-design` before writing it. Contents, in order:

- **What changed** — the Step 1 summary, then the file/hunk list.
- **Before / after** — the heart of it. Build a baseline of the pre-change code
  (`git stash` or a `git worktree add` of `HEAD`) → build → capture → **always restore**, even
  on failure (`stash pop` / `worktree remove` in a trap). Then compare representative outputs:
  - **CLI:** run baseline and current builds over a small fixed set of `inputs` invocations;
    stdout / exit code side by side, differences highlighted.
  - **Library:** for changed exported pure functions, evaluate both versions on a handful of
    fixture inputs (include edge cases); table the rows where the result moved.
  - **Data / render:** emit the domain artifact (chart, SVG, serialised structure) from each
    version, side by side.
  - Baseline build not cheap, or the change not exercisable this way → say so, fall back to the
    annotated diff.
- **What to look for** — 2–4 bullets from the change: what a correct result looks like, what
  would signal a regression.
- Deterministic inputs only (fixed dates, seeds).

## Output

A URL or a report path in the human's hands, plus the one-line summary — enough to answer
"does this look right" at the `/code-it` review gate.
