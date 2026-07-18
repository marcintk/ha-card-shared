# Recipe: v1.1.1 → v1.2.0

v1.2.0 adds a `ha-card-shared/runtime` export (`SubscriptionManager`, `DebugMetrics`, `timeAgo`).
The version bump itself is non-breaking — Dependabot handles it. The runtime migration is optional
but removes duplicated code that now lives in the shared package.

Run from the consumer repo root, on a branch.

## 1. Bump the version (Dependabot does this automatically)

```bash
npm install github:marcintk/ha-card-shared#v1.2.0 --save-dev
```

Update workflow refs:

```bash
sed -i 's|ha-card-shared/.github/workflows/\(.*\)@v1\.1\.1|ha-card-shared/.github/workflows/\1@v1.2.0|g' \
  .github/workflows/*.yml
```

## 2. Migrate local runtime duplicates to the shared package (optional, recommended)

Skip any file your card doesn't have.

### `src/subscription.ts`

Delete the local copy and update the import in `src/index.ts`:

```bash
rm src/subscription.ts
```

In `src/index.ts`, replace:

```ts
import { SubscriptionManager } from "./subscription.js";
```

with:

```ts
import { SubscriptionManager } from "ha-card-shared/runtime";
```

### `src/utils.ts`

If `utils.ts` **only** contains `timeAgo`, delete and replace the import. If it has card-specific
helpers (`VALID_STATES`, `safeLogoUrl`, etc.), keep the file but remove `timeAgo` and import it from
the shared package instead.

```ts
import { timeAgo } from "ha-card-shared/runtime";
```

### `src/debug.ts`

Delete and replace with the shared import:

```bash
rm src/debug.ts
```

In `src/index.ts`:

```ts
import { DebugMetrics } from "ha-card-shared/runtime";
```

Also delete the local `test/debug.test.ts` and `test/utils.test.ts` / `test/subscription.test.ts`
if they only tested the now-deleted files (the shared package carries its own tests).

## 3. Verify and commit

```bash
npm run check:ci && npm run test:coverage
git add -A
git commit -m "chore: upgrade to ha-card-shared v1.2.0, adopt shared runtime"
```
