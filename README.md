# ha-card-shared

Shared build toolchain for `ha-*` Home Assistant card projects: TypeScript, Rollup, Vitest, Biome,
and Prettier configs, plus reusable GitHub Actions workflows.

## Install

Pin to a release tag — never a bare SHA or `main`. Dependabot bumps it once pinned.

```bash
npm install github:marcintk/ha-card-shared#vX.Y.Z --save-dev
```

Peer deps the configs expect in the consumer: `rollup`,
`@rollup/plugin-{node-resolve,terser,typescript}`, `typescript`, `vitest`, `@vitest/coverage-v8`,
`jsdom`, `@biomejs/biome`, `prettier`.

## Exports

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

`cardBundle` bundles `src/index.ts` → `dist/<project>.js` (name from `cardBundle`'s `name` option,
default `package.json` `name`, fallback `card`). It stamps `__CARD_VERSION__` from the `VERSION` env
(git tag at release; `0.0.0-dev` otherwise; `"test"` under vitest). `globals.d.ts` types that global
plus the HA `customCards` window hook.

## Required consumer files

- **`README.md`** — card purpose, configuration, usage.
- **`test/snapshot.test.ts`** — all `toMatchSnapshot()` calls live here only; normalize with
  `snapHtml` from `ha-card-shared/test-utils` before snapshotting HTML.
- **`CLAUDE.md`** — `@node_modules/ha-card-shared/CLAUDE-SHARED.md` on line 1, then
  `## Design Invariants` and `## Architecture Notes`.

## Shared workflows

Pin `uses:` refs to a release tag; Dependabot keeps them current.

| Workflow                      | Purpose                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `shared-build-and-test.yml`   | lint, typecheck, test with coverage                        |
| `shared-publish-release.yml`  | validate tag, build bundle, create GitHub Release          |
| `shared-deploy-demo-page.yml` | build + deploy GitHub Pages demo (needs `docs/index.html`) |
| `shared-hacs-validation.yml`  | validate HACS compatibility                                |
| `shared-migration-check.yml`  | open a tracking issue when a bump needs a manual recipe    |

```yaml
jobs:
  build:
    uses: marcintk/ha-card-shared/.github/workflows/shared-build-and-test.yml@vX.Y.Z
```

`shared-migration-check.yml` is pull-based: the consumer runs it on a schedule and it opens one
`shared-migration` issue only when the pinned version has a `recipe.<pinned>_<next>.md` here.
Caller (`.github/workflows/migration-check.yml`):

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

Version-transition recipes live in [`recipes/`](recipes/). Keep consumers current with
[`recipes/dependabot.md`](recipes/dependabot.md).

## Releasing

Tag-driven. Every change reaches `main` through a PR where `self-check.yml` runs actionlint, the
smoke build, and checks committed `dist/` matches a fresh `npm run build`. Pushing a `vX.Y.Z` tag
runs `release.yml`, which validates the tag is semver strictly greater than the last release and
publishes a GitHub Release (`vX.Y.Z-beta.1` → pre-release).

```bash
git checkout -b release/vX.Y.Z
npm version patch|minor|major --no-git-tag-version   # edits package.json only
git commit -am "chore: bump version to X.Y.Z" && git push -u origin HEAD
gh pr create --title "chore: bump version to X.Y.Z" --fill   # merge once CI is green

git checkout main && git pull
git tag vX.Y.Z && git push origin vX.Y.Z
```

| Change                                           | Bump    |
| ------------------------------------------------ | ------- |
| Config-only tweak, no consumer impact            | `patch` |
| New export or loosened peer dep                  | `minor` |
| Renamed/removed export, breaking tsconfig change | `major` |
