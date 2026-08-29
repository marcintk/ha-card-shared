---
name: commit-it
description: Write a Conventional Commits message for the staged change, with the mandated Co-Authored-By / Claude-Session trailers. Message only — the caller runs git commit. Called by pr-it.
---

# Commit-It

**Invocation:** AI (a sub-skill). Outputs the message. Does **not** stage, commit, amend, or
push — the caller does that and loops until `pre-commit` passes.

## Subject

`<type>(<scope>): <imperative summary>` — `<scope>` optional.
Types: `feat` `fix` `refactor` `perf` `docs` `test` `chore` `build` `ci` `style` `revert`.
Imperative mood ("add", "fix", "remove"). ≤50 chars where it fits, hard cap 72. No trailing
period. Match the project's capitalisation after the colon.

## Body

Skip it entirely when the subject is self-explanatory. Add one only for a non-obvious _why_, a
breaking change, or migration notes. Wrap at 72. Bullets `-`. Reference issues at the end
(`Closes #42`, `Refs #17`). Never restate the diff ("this commit does X", "now", "I"/"we").

Always include a body for breaking changes, security fixes, and data migrations.

## Mandated trailers

Every commit message ends with these two lines, verbatim (do not rely on the harness to add
them):

```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: <the current claude.ai/code session URL>
```

## Output

Print the finished message in one code block, ready for `git commit -F -`.
