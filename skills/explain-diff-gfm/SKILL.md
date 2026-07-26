---
name: explain-diff-gfm
description: Generate a rich explanation of the current branch diff. Produces an interactive HTML file (local review) and a GitHub Flavored Markdown file (auto-posted to the open PR as a comment).
---

# Explain Diff — GFM

Generate a rich explanation of the current branch's changes versus `main`. Produce both an HTML file for local review and a GFM comment posted to the open PR.

## Sections to include

- **Background** — explain the existing system relevant to this change. Include deep context for beginners (skippable by experts) and narrow context directly relevant to the change.
- **Intuition** — the core essence of the change. Use concrete examples with toy data. Use figures and diagrams.
- **Code walkthrough** — high-level tour of the changes, grouped in an understandable order.
- **Quiz** — five medium-difficulty questions that test real understanding of the PR. Not gotchas. Used to help the reviewer confirm they understood.

## Steps

### 1. Gather the diff

```bash
git diff main...HEAD
git log main...HEAD --oneline
```

### 2. Write the content spec

Write a JSON spec to `/tmp/explain-spec.json`:

````json
{
  "title": "...",
  "subtitle": "Prepared YYYY-MM-DD · PR #NNN",
  "slug": "short-kebab-slug",
  "sections": [
    {
      "id": "background",
      "heading": "Background",
      "html": "<p>Rich HTML with diagrams for local HTML file.</p>",
      "md": "Plain markdown prose for GitHub PR comment. No HTML tags."
    },
    {
      "id": "intuition",
      "heading": "Intuition",
      "html": "<p>...</p><div class=\"diagram\"><div class=\"flow\">...</div></div>",
      "md": "Prose + fenced code blocks only."
    },
    {
      "id": "code",
      "heading": "Code walkthrough",
      "html": "<pre><code>...</code></pre>",
      "md": "```ts\n...\n```"
    }
  ],
  "quiz": [
    {
      "question": "...",
      "options": [
        { "text": "...", "correct": false },
        { "text": "...", "correct": true }
      ]
    }
  ]
}
````

Rules for the spec:

- Every section needs both `html` (rich, may use diagram classes) and `md` (markdown only, no raw HTML tags — GitHub strips them in comments).
- Quiz: exactly 4 options per question, exactly 1 correct.
- Write with the clarity and flow of Martin Kleppmann — engaging, classic prose with smooth transitions.
- Use `.diagram`/`.flow`/`.box`/`.callout` HTML classes in `html` fields. Use fenced code blocks and tables in `md` fields.
- Do not use ASCII diagrams in `html` — use the renderer's classes instead.

### 3. Render both formats

```bash
SKILL_DIR="$(dirname "$0")/.."
python "$SKILL_DIR/scripts/render.py" /tmp/explain-spec.json
python "$SKILL_DIR/scripts/render.py" /tmp/explain-spec.json --format gfm
```

The script prints the output path for each. Note both paths.

### 4. Get the PR number

```bash
gh pr view --json number --jq .number
```

If no open PR exists yet, skip posting — the GFM file is ready for when the PR is created.

### 5. Post to PR

```bash
gh pr comment <number> --body-file /tmp/YYYY-MM-DD-explanation-<slug>.md
```

### 6. Report to user

Tell the user:

- HTML as a clickable `file://` URL (e.g. `file:///tmp/2026-07-26-explanation-slug.html`) — most terminals and IDEs render these as links that open in the browser
- PR URL with the comment now attached
