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
- `pre-push` — enforces passing tests before push; blocks a tag push if it doesn't match `package.json` version

## Release workflow

Releases are tag-driven. Pushing a `vX.Y.Z` tag triggers CI and creates a GitHub Release automatically.

```bash
# 1. Bump version (patch | minor | major)
npm version patch --no-git-tag-version

# 2. Commit the version bump
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"

# 3. Tag and push together — the pre-push hook enforces tag ↔ package.json match
git tag v$(node -p "require('./package.json').version")
git push origin main v$(node -p "require('./package.json').version")
```

CI will validate that the tag is strictly greater than the previous release, run tests, and publish the GitHub Release.

### Version bumping rules

| Change | Bump |
|---|---|
| Config-only tweak, no consumer impact | `patch` |
| New export or loosened peer dep | `minor` |
| Renamed/removed export, breaking tsconfig change | `major` |
