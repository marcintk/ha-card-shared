# Recipe: SHA/main → v1.0.0

One-time migration for a card project that consumed `ha-shared` at a bare SHA or `@main` before
versioning existed. Run it once per consumer; afterwards dependabot keeps `ha-shared` updated.

Run from the consumer repo root, on a branch.

```bash
# 1. Pin the package to the release tag (replaces bare github:marcintk/ha-shared)
npm install github:marcintk/ha-shared#v1.0.0 --save-dev

# 2. Rename + pin every workflow reference in one pass
#    (the shared workflows were renamed with a shared- prefix; @main no longer resolves)
sed -i \
  -e 's|ha-shared/.github/workflows/build-and-test.yml@[^ "]*|ha-shared/.github/workflows/shared-build-and-test.yml@v1.0.0|g' \
  -e 's|ha-shared/.github/workflows/hacs-validation.yml@[^ "]*|ha-shared/.github/workflows/shared-hacs-validation.yml@v1.0.0|g' \
  -e 's|ha-shared/.github/workflows/publish-release.yml@[^ "]*|ha-shared/.github/workflows/shared-publish-release.yml@v1.0.0|g' \
  -e 's|ha-shared/.github/workflows/deploy-demo-page.yml@[^ "]*|ha-shared/.github/workflows/shared-deploy-demo-page.yml@v1.0.0|g' \
  .github/workflows/*.yml

# 3. Adopt the shared prettier config; drop the local one
npm pkg set prettier="ha-shared/prettier.config.json"
rm -f .prettierrc .prettierrc.json .prettierrc.yaml

# 4. Adopt the shared ambient globals; drop the local declaration file
rm -f src/global.d.ts src/globals.d.ts
#    Add this as the first line of your entry module (src/index.ts):
#      /// <reference path="../node_modules/ha-shared/globals.d.ts" />

# 5. Verify, then commit
npm run check:ci && npm run test:coverage
git add -A
git commit -m "chore: migrate ha-shared to v1.0.0"
```

Step 4's triple-slash reference must go in the file that uses `__CARD_VERSION__` — it pulls the
ambient type into the bundler's module graph, which a bare `tsconfig` include does not do.

> Future migrations get their own recipe, named `recipe.<from>_<to>.md`
> (e.g. `recipe.1.00_1.10.md`).
