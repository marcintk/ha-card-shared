# Keeping ha-card-shared current with Dependabot

## Upgrading (one command)

Run this once per consumer repo to bump to a new version and wire Dependabot for all future releases:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/marcintk/ha-card-shared/main/scripts/upgrade.sh) vX.Y.Z
```

The script: branches → bumps → runs checks → commits → sets up Dependabot → opens a PR. After the
PR is merged, all future releases arrive automatically as Dependabot PRs — no manual steps needed.

## How Dependabot works here

Dependabot bumps version numbers; it does not run recipes. Dependabot keeps a consumer current on its
own — but only if **both** ecosystems are configured. The npm block bumps the `ha-card-shared` git tag in
`package.json`; the github-actions block bumps the `uses: …@vX.Y.Z` workflow refs. Configure only
one and the two drift apart.

```yaml
# consumer .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm # bumps the ha-card-shared tag in package.json
    directory: /
    schedule: { interval: weekly }
    allow:
      - dependency-name: ha-card-shared
  - package-ecosystem: github-actions # bumps uses: …@vX.Y.Z in workflows
    directory: /
    schedule: { interval: weekly }
```

- Keep the npm pin an **exact tag** (`#v1.0.0`), not a floating range — exact pin + Dependabot PRs
  means every bump is one reviewable PR.
- Groups can't span ecosystems, so a release yields up to two PRs (one npm, one actions); merge them
  together.
- **Boundary:** patch/minor bumps must need zero consumer edits, so Dependabot can merge them green.
  A bump that requires consumer changes is a `major` — it ships a new `recipe.<from>_<to>.md` that a
  human applies on the Dependabot major PR.

## What each release delivers on bump

### v1.2.0

- **Shared runtime** — new `ha-card-shared/runtime` export: `SubscriptionManager`, `DebugMetrics`,
  `timeAgo`. Consumers with local copies of these can delete them and import from the shared package.
- **CI** — `self-check.yml` now runs a `runtime` job (build + typecheck + coverage) in addition to
  the existing `lint` and `smoke` jobs.
