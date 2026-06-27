# ha-shared

Shared build toolchain for `ha-*` Home Assistant card projects: TypeScript, Rollup, Vitest, Biome,
and Prettier configs, plus reusable GitHub Actions workflows and git hooks.

## Install

Always pin to a release tag — never a bare SHA or `main`. Updating is the same command with a newer
tag (dependabot does it for you once pinned).

```bash
npm install github:marcintk/ha-shared#v1.0.0 --save-dev
```

The exported configs expect these tools installed in the consumer (declared as peer deps): `rollup`
+ `@rollup/plugin-{node-resolve,terser,typescript}`, `typescript`, `vitest`,
`@vitest/coverage-v8`, `jsdom`, `@biomejs/biome`, `prettier`.

## Exports

Use each export by extending or referencing it from the matching consumer file:

| Export | Wire-up in consumer |
|---|---|
| `ha-shared/tsconfig.base.json` | `"extends"` in `tsconfig.json` |
| `ha-shared/rollup.base.mjs` | `export default cardBundle()` in `rollup.config.mjs` |
| `ha-shared/vitest.base.mjs` | `defineConfig(baseVitestConfig)` in `vitest.config.mjs` |
| `ha-shared/biome.json` | `"extends"` in `biome.json` |
| `ha-shared/prettier.config.json` | `"prettier": "ha-shared/prettier.config.json"` in `package.json` |
| `ha-shared/globals.d.ts` | `/// <reference path="../node_modules/ha-shared/globals.d.ts" />` in `src/index.ts` |

`cardBundle` bundles `src/index.ts` → `dist/card.js` and stamps `__CARD_VERSION__` from the
`VERSION` env (set from the git tag at release; `0.0.0-dev` otherwise; `"test"` under vitest).
`globals.d.ts` types that global plus the HA `customCards` window hook.

## Git hooks

```bash
git config core.hooksPath node_modules/ha-shared/.githooks
```

- `pre-commit` — biome check + prettier (markdown) + typecheck
- `pre-push` — tests at 100% coverage

## Shared workflows

Reusable workflows for consumer repos. Pin refs to a release tag — dependabot keeps them current.

| Workflow | Purpose |
|---|---|
| `shared-build-and-test.yml` | lint, typecheck, test with coverage report |
| `shared-publish-release.yml` | validate tag, build bundle, create GitHub Release |
| `shared-deploy-demo-page.yml` | build + deploy GitHub Pages demo (requires `docs/index.html`) |
| `shared-hacs-validation.yml` | validate HACS compatibility |

```yaml
jobs:
  build:
    uses: marcintk/ha-shared/.github/workflows/shared-build-and-test.yml@v1.0.0
```

## Migrating consumers

Step-by-step migrations live in [`recipes/`](recipes/), one file per version transition:

- [`recipe.SHA_1.00.md`](recipes/recipe.SHA_1.00.md) — SHA/`main` → v1.0.0.

## Releasing ha-shared

Tag-driven. Every change reaches `main` through a PR, where `self-check.yml` runs actionlint,
shellcheck, and the smoke build. Pushing a `vX.Y.Z` tag then runs `release.yml`, which validates the
tag is a valid semver strictly greater than the previous release and publishes a GitHub Release
(pre-release tags like `v1.0.0-beta.1` publish as GitHub pre-releases).

```bash
npm version patch --no-git-tag-version   # patch | minor | major — see table below
VER=$(node -p "require('./package.json').version")
# keep the composite-action ref in lockstep with the new version
sed -i "s|actions/validate-tag@v[^ ]*|actions/validate-tag@v${VER}|g" .github/workflows/shared-publish-release.yml
git commit -am "chore: bump version to ${VER}"
git tag "v${VER}" && git push origin main "v${VER}"
```

| Change | Bump |
|---|---|
| Config-only tweak, no consumer impact | `patch` |
| New export or loosened peer dep | `minor` |
| Renamed/removed export, breaking tsconfig change | `major` |
