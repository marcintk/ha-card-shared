---
name: brainstorm-it
description: Interrogate a plan, idea, or design decision one question at a time until there is shared understanding. Called by design-it — both its design gate and the candidate picked in no-arg scan mode; also the pre-issue on-ramp that turns a fuzzy idea into a filable issue.
---

# Brainstorm-It

**Invocation:** HUMAN or AI — a human runs it as the pre-issue on-ramp; `design-it` calls it as
a sub-skill, so its frontmatter carries no invocation block.

Interview the human relentlessly about every aspect of this until you reach a shared
understanding. Walk down each branch of the decision tree, resolving dependencies between
decisions one by one. For each question, give your recommended answer.

Ask one question at a time, waiting for the answer before the next. Asking several at once is
bewildering.

If a _fact_ can be found by exploring the environment (filesystem, tools, git, `gh`), look it
up rather than asking. The _decisions_ are the human's — put each one to them and wait.

Do not act on the outcome until the human confirms the understanding is shared.

## Starting from a raw idea (pre-issue)

When invoked on an idea with no GH issue yet: run the interview as above, then end by drafting
the issue — a one-line title and a body (context, the change, acceptance) ready to paste into
`gh issue create`. The human files it; `/design-it` takes it from there.
