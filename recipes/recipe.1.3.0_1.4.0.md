# Recipe: v1.3.0 → v1.4.0

v1.4.0 adds the `shared-migration-check.yml` workflow — a pull-based notifier that opens a tracking
issue when a future bump needs manual steps. The version bump itself is non-breaking; Dependabot
handles the ref bump. This recipe covers the two manual steps: adopting the new workflow and removing
the now-unused `TODO.md`.

Run from the consumer repo root, on a branch.

## 1. Bump the version (Dependabot does this automatically)

```bash
npm install github:marcintk/ha-card-shared#v1.4.0 --save-dev
```

Update workflow refs:

```bash
sed -i 's|ha-card-shared/.github/workflows/\(.*\)@v1\.3\.0|ha-card-shared/.github/workflows/\1@v1.4.0|g' \
  .github/workflows/*.yml
```

## 2. Adopt the migration-check workflow

Add `.github/workflows/migration-check.yml` so future migrations announce themselves:

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
    uses: marcintk/ha-card-shared/.github/workflows/shared-migration-check.yml@v1.4.0
```

## 3. Remove `TODO.md`

The shared repo dropped its placeholder `TODO.md`; consumers that copied it should do the same —
issues track work, not a checked-in file.

```bash
rm -f TODO.md
```

## 4. Verify and commit

```bash
npm run check:ci && npm run test:coverage
git add -A
git commit -m "chore: upgrade to ha-card-shared v1.4.0, adopt migration-check"
```
