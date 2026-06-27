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

## Migrating from SHA/main to versioned releases

One-time migration for projects that consumed `ha-shared` before versioning was introduced.
After this, dependabot handles future updates automatically.

```bash
# 1. Pin package.json
npm install github:marcintk/ha-shared#v1.0.0 --save-dev

# 2. Rename + pin workflow references in one pass
sed -i \
  -e 's|ha-shared/.github/workflows/build-and-test.yml@[^ "]*|ha-shared/.github/workflows/shared-build-and-test.yml@v1.0.0|g' \
  -e 's|ha-shared/.github/workflows/hacs-validation.yml@[^ "]*|ha-shared/.github/workflows/shared-hacs-validation.yml@v1.0.0|g' \
  -e 's|ha-shared/.github/workflows/publish-release.yml@[^ "]*|ha-shared/.github/workflows/shared-publish-release.yml@v1.0.0|g' \
  -e 's|ha-shared/.github/workflows/deploy-demo-page.yml@[^ "]*|ha-shared/.github/workflows/shared-deploy-demo-page.yml@v1.0.0|g' \
  .github/workflows/*.yml

# 3. Commit
git add package.json .github/workflows/
git commit -m "chore: migrate ha-shared to v1.0.0"
```

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
