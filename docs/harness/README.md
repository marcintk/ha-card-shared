# Harness walkthrough

One self-contained HTML page per pipeline skill: what it does step by step, what it
calls (hooks, sub-skills, sub-agents, references), and the design choices behind it.
Served by GitHub Pages alongside the design notes.

| Skill                                 | Page                                                                                 | Stage               |
| ------------------------------------- | ------------------------------------------------------------------------------------ | ------------------- |
| `/design-it` — design phase           | [design-it.html](https://marcintk.github.io/ha-card-shared/harness/design-it.html)   | 1 of 4 entry points |
| `/code-it` — TDD implementation phase | [code-it.html](https://marcintk.github.io/ha-card-shared/harness/code-it.html)       | 2 of 4 entry points |
| `/ship-it` — delivery phase           | [ship-it.html](https://marcintk.github.io/ha-card-shared/harness/ship-it.html)       | 3 of 4 entry points |
| `/release-it` — batching phase        | [release-it.html](https://marcintk.github.io/ha-card-shared/harness/release-it.html) | 4 of 4 entry points |

Still to add: the sub-skills (`brainstorm-it`, `explain-it`, `commit-it`) and the
sub-agents (`explorer`, `test-writer`, `code-writer`, `reviewer`).

Source of truth is `harness/skills/<skill>/SKILL.md`; if a page drifts from its skill
file, the skill file wins — update the page.
