# ha-card-shared

Shared build toolchain for `ha-*` Home Assistant card projects: TypeScript, Rollup, Vitest, Biome,
and Prettier configs, plus reusable GitHub Actions workflows and git hooks.

## Install

Always pin to a release tag — never a bare SHA or `main`. Updating is the same command with a newer
tag (dependabot does it for you once pinned).

```bash
npm install github:marcintk/ha-card-shared#vX.Y.Z --save-dev
```

The exported configs expect these tools installed in the consumer (declared as peer deps):
`rollup`, `@rollup/plugin-{node-resolve,terser,typescript}`, `typescript`, `vitest`,
`@vitest/coverage-v8`, `jsdom`, `@biomejs/biome`, `prettier`.

### Claude Code skills

The `/fix-it`, `/feature-it`, and `/ship-it` pipelines are self-contained — `npm install`
symlinks the bundled skills and subagents and wires the `skill-guard` hook (see
[Claude Code config](#claude-code-config)). No marketplace plugins to install. The only
external references are Claude Code built-ins every install already has: `/code-review`,
`/simplify`, `/rewind`, `artifact-design`.

Recommended: **Serena** (MCP symbol search + diagnostics), **RTK** (token proxy via hooks).

## Exports

Use each export by extending or referencing it from the matching consumer file:

| Export                                | Wire-up in consumer                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ha-card-shared/tsconfig.base.json`   | `"extends"` in `tsconfig.json`                                                           |
| `ha-card-shared/rollup.base.mjs`      | `export default cardBundle()` in `rollup.config.mjs`                                     |
| `ha-card-shared/vitest.base.mjs`      | `defineConfig(baseVitestConfig)` in `vitest.config.mjs`                                  |
| `ha-card-shared/biome.json`           | `"extends"` in `biome.json`                                                              |
| `ha-card-shared/prettier.config.json` | `"prettier": "ha-card-shared/prettier.config.json"` in `package.json`                    |
| `ha-card-shared/globals.d.ts`         | `/// <reference path="../node_modules/ha-card-shared/globals.d.ts" />` in `src/index.ts` |
| `ha-card-shared/runtime`              | `import { SubscriptionManager, DebugMetrics, timeAgo } from "ha-card-shared/runtime"`    |
| `ha-card-shared/test-utils`           | `import { snapHtml } from "ha-card-shared/test-utils"` in `test/snapshot.test.ts`        |

`cardBundle` bundles `src/index.ts` → `dist/<project>.js` — the name comes from `cardBundle`'s
`name` option, defaulting to `package.json`'s `name`, and falls back to `card` when npm metadata is
absent. It stamps `__CARD_VERSION__` from the
`VERSION` env (set from the git tag at release; `0.0.0-dev` otherwise; `"test"` under vitest).
`globals.d.ts` types that global plus the HA `customCards` window hook.

## Claude Code config

The Claude workflow toolchain lives entirely under `harness/` — skills, pipeline subagents,
the `skill-guard` hook, the git hooks, and the setup script — grouped there so it can move to
its own repo later without disturbing the build configs.

`harness/setup-claude.js` runs automatically as a `postinstall` hook when consumers install
ha-card-shared. It:

- symlinks the bundled skills into `.claude/skills/` and the pipeline subagents into
  `.claude/agents/`;
- merges the `skill-guard` hook into `.claude/settings.json` — a `PreToolUse` guard that denies
  a call when either the active **phase** (`design`, `code`, `ship`, `release` — set by the
  entry-point skill via `skill-guard.mjs phase …`, and surviving across turns) or the active
  subagent **role** forbids it (the `pipeline-coder` subagent can't touch tests, and can't write
  `src/` until the slice is marked red via `skill-guard.mjs red <test-file>`, and so on). Runtime
  state lives in `.claude/skill-guard/` (self-ignored) — `phase`, `red`, and a `log` of every
  decision; set `SKILL_GUARD_OFF=1` to disable;
- points git's `core.hooksPath` at `harness/.githooks` (see [Git hooks](#git-hooks)).

No manual setup needed — running `npm install` wires everything.

## Required files

Every consumer project must have:

- **`README.md`** — card purpose, configuration, usage.
- **`test/snapshot.test.ts`** — all `toMatchSnapshot()` calls live here and nowhere else. Use `snapHtml` from `ha-card-shared/test-utils` to normalize Lit marker IDs before snapshotting HTML.
- **`.claude/settings.json`** — managed by ha-card-shared's `postinstall` above; no manual setup needed.
- **`CLAUDE.md`** — `@node_modules/ha-card-shared/CLAUDE-SHARED.md` on line 1, then `## Design Invariants` and `## Architecture Notes` sections with card-specific content.

## Git hooks

`postinstall` points `core.hooksPath` at `node_modules/ha-card-shared/harness/.githooks` (local
config only; skipped if you're not in a git repo, or if `core.hooksPath` already names a directory
of your own that actually contains hooks).

- `pre-commit` — biome check + prettier (markdown) + typecheck
- `pre-push` — tests at 100% coverage

Opt out with `git config --unset core.hooksPath` (or point it elsewhere — `postinstall` won't
override a non-ha-card value). One exception: a value naming a **missing or empty** directory hooks
nothing and git says nothing about it, so `postinstall` treats that as a leftover and takes it over
rather than leaving you with silently dead hooks.

## Shared workflows

Reusable workflows for consumer repos. Pin refs to a release tag — dependabot keeps them current.

| Workflow                      | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `shared-build-and-test.yml`   | lint, typecheck, test with coverage report                    |
| `shared-publish-release.yml`  | validate tag, build bundle, create GitHub Release             |
| `shared-deploy-demo-page.yml` | build + deploy GitHub Pages demo (requires `docs/index.html`) |
| `shared-hacs-validation.yml`  | validate HACS compatibility                                   |
| `shared-migration-check.yml`  | open a tracking issue when a bump needs a manual recipe       |

```yaml
jobs:
  build:
    uses: marcintk/ha-card-shared/.github/workflows/shared-build-and-test.yml@vX.Y.Z
```

### Migration check

`shared-migration-check.yml` is pull-based: the consumer runs it on a schedule
and it opens an issue **only** when the version you currently pin has a
`recipe.<pinned>_<next>.md` in this repo — i.e. the bump needs manual steps.
It walks one step at a time and keeps at most one open `shared-migration`
issue. Plain ref-bumps (no recipe) are left to Dependabot.

Add this caller to each consumer (`.github/workflows/migration-check.yml`):

```yaml
name: Migration Check
on:
  schedule:
    - cron: "0 6 * * 1" # weekly, Monday 06:00 UTC
  workflow_dispatch:
permissions:
  contents: read
  issues: write
jobs:
  check:
    uses: marcintk/ha-card-shared/.github/workflows/shared-migration-check.yml@vX.Y.Z
```

## Migrating consumers

Step-by-step migrations live in [`recipes/`](recipes/), one file per version transition.

After migrating, keep consumers current automatically: [`recipes/dependabot.md`](recipes/dependabot.md).

## Releasing ha-card-shared

Tag-driven. Every change reaches `main` through a PR, where `self-check.yml` runs actionlint,
shellcheck, the smoke build, and verifies committed `dist/` matches a fresh build (rebuild with
`npm run build` and commit if it drifts). Pushing a `vX.Y.Z` tag then runs `release.yml`, which validates the
tag is a valid semver strictly greater than the previous release and publishes a GitHub Release
(pre-release tags like `vX.Y.Z-beta.1` publish as GitHub pre-releases).

The version bump is a PR like any other — `pre-commit` blocks direct commits to `main`, and
`npm version`'s own commit is no exception — then the tag goes on `main` after merge, since a tag
is not a commit and never trips that guard:

```bash
git checkout -b release/vX.Y.Z
npm version patch|minor|major --no-git-tag-version   # edits package.json only
git commit -am "chore: bump version to X.Y.Z" && git push -u origin HEAD
gh pr create --title "chore: bump version to X.Y.Z" --fill   # then merge once CI is green

git checkout main && git pull
git tag vX.Y.Z && git push origin vX.Y.Z
```

| Change                                           | Bump    |
| ------------------------------------------------ | ------- |
| Config-only tweak, no consumer impact            | `patch` |
| New export or loosened peer dep                  | `minor` |
| Renamed/removed export, breaking tsconfig change | `major` |
