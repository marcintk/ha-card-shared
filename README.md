# ha-shared

Shared build toolchain for HA card projects: TypeScript, Rollup, Vitest, and Biome configs.

## Install

Pin to a release tag — never use a bare SHA or `main`:

```bash
npm install github:marcintk/ha-shared#v1.0.0 --save-dev
```

## Update

```bash
npm install github:marcintk/ha-shared#vX.Y.Z --save-dev
```

## Exports

- `ha-shared/tsconfig.base.json` — TypeScript compiler baseline, extend in `tsconfig.json`
- `ha-shared/rollup.base.mjs` — production bundle (`src/index.ts` → `dist/card.js`), use named export `cardBundle` in `rollup.config.mjs`
- `ha-shared/vitest.base.mjs` — test runner and coverage enforcement, extend in `vitest.config.mjs`
- `ha-shared/biome.json` — linter and formatter, extend in `biome.json`
- `ha-shared/prettier.config.json` — markdown/prose formatting, reference in `package.json`
- `ha-shared/globals.d.ts` — ambient types every card needs (`__CARD_VERSION__`, `customCards`)

### Prettier

Point prettier at the shared config in `package.json` (drop any local `.prettierrc`):

```json
{ "prettier": "ha-shared/prettier.config.json" }
```

### Ambient globals

`__CARD_VERSION__` is injected by `cardBundle` (rollup) and `baseVitestConfig` (vitest). Pull the
shared declarations into your entry file with one triple-slash reference (replaces a local
`global.d.ts`):

```ts
/// <reference path="../node_modules/ha-shared/globals.d.ts" />
```

## Git hooks

```bash
git config core.hooksPath node_modules/ha-shared/.githooks
```

- `pre-commit` — enforces code quality on every commit
- `pre-push` — enforces passing tests before push

## Shared workflows

Reusable GitHub Actions workflows for consumer card projects:

- `shared-build-and-test.yml` — lint, typecheck, test with coverage report
- `shared-publish-release.yml` — validate tag, build bundle, create GitHub Release
- `shared-deploy-demo-page.yml` — build and deploy GitHub Pages demo
- `shared-hacs-validation.yml` — validate HACS compatibility

Pin workflow refs to a release tag — dependabot will keep them updated:

```yaml
jobs:
  build:
    uses: marcintk/ha-shared/.github/workflows/shared-build-and-test.yml@v1.0.0
  release:
    uses: marcintk/ha-shared/.github/workflows/shared-publish-release.yml@v1.0.0
```

## Migrating consumers

Step-by-step migrations live in [`recipes/`](recipes/), one file per version transition:

- [`recipe.SHA_1.00.md`](recipes/recipe.SHA_1.00.md) — SHA/`main` → v1.0.0 (pin package + workflows,
  adopt shared prettier + globals).

## Release workflow

Releases are tag-driven. Pushing a `vX.Y.Z` tag triggers CI and creates a GitHub Release automatically.

```bash
# 1. Bump version (patch | minor | major)
npm version patch --no-git-tag-version

# 2. Update the action ref inside shared-publish-release.yml to match
VER=$(node -p "require('./package.json').version")
sed -i "s|actions/validate-tag@v[^ ]*|actions/validate-tag@v${VER}|g" .github/workflows/shared-publish-release.yml

# 3. Commit
git add package.json .github/workflows/shared-publish-release.yml
git commit -m "chore: bump version to ${VER}"

# 4. Tag and push
git tag v${VER}
git push origin main v${VER}
```

CI will validate that the tag is strictly greater than the previous release, run tests, and publish the GitHub Release.

### Version bumping rules

| Change | Bump |
|---|---|
| Config-only tweak, no consumer impact | `patch` |
| New export or loosened peer dep | `minor` |
| Renamed/removed export, breaking tsconfig change | `major` |
