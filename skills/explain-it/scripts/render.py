#!/usr/bin/env python3
"""
render.py — render a structured explain-diff spec into HTML or GitHub Flavored Markdown.

Used by the explain-it skill (finalize phase). Separates boilerplate (CSS, JS, page scaffolding)
from content so Claude only writes the small JSON spec.

Usage:
    python render.py spec.json [-o output] [--format {html,gfm}]

Default output path:
  html → /tmp/YYYY-MM-DD-explanation-<slug>.html
  gfm  → /tmp/YYYY-MM-DD-explanation-<slug>.md

Spec format (JSON):
{
  "title": "Rewriting the retry logic",
  "subtitle": "Prepared 2026-07-15 · PR #42",
  "slug": "retry-backoff-refactor",
  "sections": [
    {
      "id": "background",
      "heading": "Background",
      "html": "<p>...</p>",
      "md": "Markdown prose for GFM output (optional; falls back to stripping html)"
    }
  ],
  "quiz": [
    {
      "question": "Why did the first retry fire immediately?",
      "options": [
        {"text": "Jitter returned a negative delay.", "correct": false},
        {"text": "Base delay multiplied after first attempt.", "correct": true}
      ]
    }
  ]
}

HTML section classes: .callout .diagram .flow .box .box.fail .arrow <pre><code> <table>
GFM quiz uses <details>/<summary> — renders in GitHub PR comments.
Option order is randomized at render time for HTML; preserved for GFM (stable for review).
"""
import argparse
import datetime
import html
import json
import random
import re
import sys
from pathlib import Path

CSS = """
  :root {
    --bg: #fafaf8; --fg: #1a1a1a; --accent: #b5541f; --muted: #6b6b6b;
    --code-bg: #282c34; --code-fg: #e6e6e6; --callout-bg: #fff4e8; --border: #e0ddd6;
  }
  body { font-family: Georgia, 'Times New Roman', serif; background: var(--bg); color: var(--fg);
    max-width: 820px; margin: 0 auto; padding: 2rem 1.5rem 6rem; line-height: 1.65; }
  h1 { font-size: 1.9rem; border-bottom: 3px solid var(--accent); padding-bottom: .5rem; }
  h2 { font-size: 1.4rem; margin-top: 3rem; color: var(--accent); }
  h3 { font-size: 1.1rem; margin-top: 1.8rem; }
  code { font-family: 'SF Mono', Consolas, monospace; background: #eee; padding: .1rem .3rem;
    border-radius: 3px; font-size: .92em; }
  pre { background: var(--code-bg); color: var(--code-fg); padding: 1rem 1.2rem; border-radius: 8px;
    overflow-x: auto; white-space: pre-wrap; font-family: 'SF Mono', Consolas, monospace;
    font-size: .88rem; line-height: 1.5; }
  pre code { background: none; padding: 0; color: inherit; }
  .callout { background: var(--callout-bg); border-left: 4px solid var(--accent); padding: .9rem 1.2rem;
    border-radius: 0 6px 6px 0; margin: 1.2rem 0; }
  .toc { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.5rem; margin: 1.5rem 0; }
  .toc a { color: var(--accent); text-decoration: none; }
  .toc ul { margin: .3rem 0; }
  .diagram { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 1.2rem;
    margin: 1.2rem 0; font-family: 'SF Mono', Consolas, monospace; font-size: .85rem; }
  .flow { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; justify-content: center; padding: .5rem 0; }
  .box { border: 2px solid var(--accent); border-radius: 8px; padding: .6rem 1rem; background: #fdf6ee;
    text-align: center; min-width: 120px; }
  .box.fail { border-color: #b91c1c; background: #fef2f2; }
  .arrow { font-size: 1.4rem; color: var(--muted); }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .92rem; }
  th, td { border: 1px solid var(--border); padding: .5rem .7rem; text-align: left; }
  th { background: #f0ede6; }
  .quiz-q { background: #fff; border: 1px solid var(--border); border-radius: 10px;
    padding: 1.2rem 1.5rem; margin: 1.2rem 0; }
  .quiz-opt { display: block; width: 100%; text-align: left; padding: .6rem 1rem; margin: .4rem 0;
    border: 1px solid var(--border); border-radius: 6px; background: #fff; cursor: pointer;
    font-family: inherit; font-size: .95rem; }
  .quiz-opt:hover { background: #f5f2ec; }
  .quiz-opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .feedback { display: none; margin-top: .6rem; padding: .6rem 1rem; border-radius: 6px; font-size: .9rem; }
  .feedback.correct { background: #ecfdf3; color: #166534; border-left: 3px solid #16a34a; }
  .feedback.incorrect { background: #fef2f2; color: #991b1b; border-left: 3px solid #dc2626; }
  @media (max-width: 600px) { body { padding: 1rem; } .flow { flex-direction: column; } }
"""

# Uses textContent (not innerHTML) for all dynamic text — XSS-safe.
QUIZ_JS = r"""
document.querySelectorAll('.quiz-q').forEach(q => {
  q.querySelectorAll('.quiz-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      if (opt.disabled) return;
      q.querySelectorAll('.quiz-opt').forEach(b => { b.disabled = true; });
      const correct = opt.dataset.correct === 'true';
      const fb = document.createElement('div');
      fb.className = 'feedback ' + (correct ? 'correct' : 'incorrect');
      fb.textContent = correct
        ? '✅ Correct.'
        : '❌ Not quite — reread the section above.';
      opt.insertAdjacentElement('afterend', fb);
      fb.style.display = 'block';
    });
  });
});
"""


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def strip_html(text: str) -> str:
    """Best-effort HTML to plain markdown. Used when spec has no 'md' field."""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(p(?!re)|div|li)[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<pre[^>]*><code[^>]*>(.*?)</code></pre>", r"```\n\1\n```", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<code[^>]*>(.*?)</code>", r"`\1`", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<strong[^>]*>(.*?)</strong>", r"**\1**", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<em[^>]*>(.*?)</em>", r"*\1*", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<h([1-6])[^>]*>(.*?)</h\1>", lambda m: "#" * int(m.group(1)) + " " + m.group(2), text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def render_html(spec: dict) -> str:
    title = spec["title"]
    subtitle = spec.get("subtitle", "")
    sections = spec.get("sections", [])
    quiz = spec.get("quiz", [])

    toc_items = "\n".join(
        f'  <li><a href="#{html.escape(s["id"])}">{html.escape(s["heading"])}</a></li>'
        for s in sections
    )
    if quiz:
        toc_items += '\n  <li><a href="#quiz">Quiz</a></li>'

    body_sections = "\n\n".join(
        f'<h2 id="{html.escape(s["id"])}">{html.escape(s["heading"])}</h2>\n{s["html"]}'
        for s in sections
    )

    quiz_html = ""
    if quiz:
        blocks = []
        for q in quiz:
            options = list(q["options"])
            random.shuffle(options)
            opts = "\n".join(
                f'<button class="quiz-opt" data-correct="{"true" if o["correct"] else "false"}">'
                f'{html.escape(o["text"])}</button>'
                for o in options
            )
            blocks.append(
                f'<div class="quiz-q">\n'
                f'<p><strong>{html.escape(q["question"])}</strong></p>\n'
                f'{opts}\n'
                f'</div>'
            )
        quiz_html = '<h2 id="quiz">Quiz</h2>\n\n' + "\n\n".join(blocks)

    escaped_title = html.escape(title)
    subtitle_html = (
        f'<p style="color:var(--muted); margin-top:-.5rem;">{html.escape(subtitle)}</p>'
        if subtitle else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escaped_title}</title>
<style>{CSS}</style>
</head>
<body>

<h1>{escaped_title}</h1>
{subtitle_html}

<div class="toc">
<strong>Contents</strong>
<ul>
{toc_items}
</ul>
</div>

{body_sections}

{quiz_html}

<script>{QUIZ_JS}</script>

</body>
</html>
"""


def render_gfm(spec: dict) -> str:
    title = spec["title"]
    subtitle = spec.get("subtitle", "")
    sections = spec.get("sections", [])
    quiz = spec.get("quiz", [])

    parts: list[str] = [f"# {title}"]
    if subtitle:
        parts.append(f"_{subtitle}_")
    parts.append("")

    toc = "\n".join(
        f"- [{s['heading']}](#{slugify(s['heading'])})" for s in sections
    )
    if quiz:
        toc += "\n- [Quiz](#quiz)"
    parts.append(toc)
    parts.append("")

    for s in sections:
        parts.append(f"## {s['heading']}")
        parts.append("")
        content = s.get("md") or strip_html(s.get("html", ""))
        parts.append(content)
        parts.append("")

    if quiz:
        parts.append("## Quiz")
        parts.append("")
        for i, q in enumerate(quiz, 1):
            parts.append(f"**Q{i}: {q['question']}**")
            parts.append("")
            for o in q["options"]:
                parts.append(f"- {o['text']}")
            parts.append("")
            correct = next(o for o in q["options"] if o["correct"])
            parts.append("<details><summary>Reveal answer</summary>")
            parts.append("")
            parts.append(f"**{correct['text']}** is correct.")
            parts.append("")
            parts.append("</details>")
            parts.append("")

    return "\n".join(parts)


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("spec", type=Path, help="path to the JSON content spec")
    ap.add_argument("-o", "--output", type=Path, default=None, help="output file path")
    ap.add_argument(
        "--format",
        choices=["html", "gfm"],
        default="html",
        help="output format (default: html)",
    )
    args = ap.parse_args()

    try:
        spec_text = args.spec.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"error: cannot read spec: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        spec = json.loads(spec_text)
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON in spec: {exc}", file=sys.stderr)
        sys.exit(1)

    if "title" not in spec:
        print("error: spec must have a 'title' field", file=sys.stderr)
        sys.exit(1)

    date_prefix = datetime.date.today().strftime("%Y-%m-%d")
    slug = slugify(spec.get("slug") or spec["title"])

    if args.output:
        out_path = args.output
    elif args.format == "gfm":
        out_path = Path(f"/tmp/{date_prefix}-explanation-{slug}.md")
    else:
        out_path = Path(f"/tmp/{date_prefix}-explanation-{slug}.html")

    out_content = render_gfm(spec) if args.format == "gfm" else render_html(spec)

    try:
        out_path.write_text(out_content, encoding="utf-8")
    except OSError as exc:
        print(f"error: cannot write output: {exc}", file=sys.stderr)
        sys.exit(1)

    print(str(out_path))


if __name__ == "__main__":
    main()
