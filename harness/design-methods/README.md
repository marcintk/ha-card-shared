# Design methods

The reference `design-it` works from while shaping a change. Four areas — read what the step in
front of you needs, not all of it every time.

| File                           | What it holds                                                         | When `design-it` reads it                                                       |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [glossary.md](glossary.md)     | the terms — use them exactly, in the note and in conversation         | every run                                                                       |
| [design.md](design.md)         | how to shape an interface                                             | every non-trivial change (Step 6)                                               |
| [discipline.md](discipline.md) | the checks that catch a bad shape before it ships                     | every non-trivial change (Step 6), and the scan                                 |
| [processes.md](processes.md)   | the playbooks: scan for candidates, deepen a cluster, design it twice | scan → no-arg mode; deepen → deepening refactors; design-it-twice → non-trivial |

## The stance: strategic, not tactical

Working code is not the finish line. A change that ships the behaviour but leaves the design
worse has borrowed against the next change, and the interest compounds — a codebase accretes
complexity one reasonable-looking commit at a time, never in a single bad one. Budget a slice of
every change for keeping the design clean. In this pipeline that budget is spent in the
`brainstorm-it` grill, the design-it-twice playbook, and the adjacent-opportunity pass — not
deferred to a cleanup that never comes.

## Provenance

Distilled from Ousterhout, _A Philosophy of Software Design_ (complexity and its symptoms, deep
modules, information hiding, pulling complexity downward, design it twice, defining errors out of
existence) and Feathers, _Working Effectively with Legacy Code_ (seams). It is not a summary of
either book — only the parts this pipeline actually uses, in this repo's vocabulary. If a
concept here feels thin, the book is the source.
