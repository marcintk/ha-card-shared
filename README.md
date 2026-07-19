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

### Claude Code plugins

Required by the shared workflow (see `CLAUDE-SHARED.md`). A SessionStart hook warns when either is
missing.

```bash
claude plugin marketplace add DietrichGebert/ponytail && claude plugin install ponytail@ponytail
claude plugin marketplace add JuliusBrussee/caveman && claude plugin install caveman@caveman
```

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

`cardBundle` bundles `src/index.ts` → `dist/card.js` and stamps `__CARD_VERSION__` from the
`VERSION` env (set from the git tag at release; `0.0.0-dev` otherwise; `"test"` under vitest).
`globals.d.ts` types that global plus the HA `customCards` window hook.

## Claude Code config

Symlink the shared `.claude/settings.json` so it stays current after every `npm install`:

```bash
# one-time setup — or add as postinstall in package.json
ln -sf ../node_modules/ha-card-shared/.claude/settings.json .claude/settings.json
```

Add to consumer `package.json` scripts so the symlink is created automatically:

```json
"postinstall": "ln -sf ../node_modules/ha-card-shared/.claude/settings.json .claude/settings.json"
```

## Git hooks

```bash
git config core.hooksPath node_modules/ha-card-shared/.githooks
```

- `pre-commit` — biome check + prettier (markdown) + typecheck
- `pre-push` — tests at 100% coverage

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

```bash
npm version patch --no-git-tag-version   # patch | minor | major — see table below
VER=$(node -p "require('./package.json').version")
git commit -am "chore: bump version to ${VER}"
git tag "v${VER}" && git push origin main "v${VER}"
```

| Change                                           | Bump    |
| ------------------------------------------------ | ------- |
| Config-only tweak, no consumer impact            | `patch` |
| New export or loosened peer dep                  | `minor` |
| Renamed/removed export, breaking tsconfig change | `major` |
