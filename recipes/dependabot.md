# Keeping ha-card-shared current with Dependabot

## Upgrading

Bump both refs together — the npm dep and the workflow `uses:` pins — on a branch, then PR:

```bash
git checkout -b chore/bump-ha-card-shared-vX.Y.Z
npm install ha-card-shared@github:marcintk/ha-card-shared#vX.Y.Z   # package.json + lockfile
# workflow `uses:` refs — rewrite only the ha-card-shared pins, leave other action tags alone
grep -rl 'marcintk/ha-card-shared/.github/workflows/.*@v' .github/workflows/ \
  | xargs sed -i -E 's#(marcintk/ha-card-shared/[^@]+)@v[0-9.]+#\1@vX.Y.Z#g'
git commit -am "chore: bump ha-card-shared to vX.Y.Z" && gh pr create --fill
```

Wire the `dependabot.yml` below once, and every later release arrives as a Dependabot PR — no
manual bump needed.

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

### v2.0.0

- **Bundle named after the card** — `cardBundle` emits `dist/<project>.js` instead of the generic
  `dist/card.js`, so each card's Lovelace resource URL is recognisable. Needs a one-time asset
  rename per consumer (`hacs.json` `filename` first — HACS installs break without it) and an
  end-user resource-URL update.
- **Self-contained skill harness** — the `/fix-it`, `/feature-it`, `/ship-it` pipelines no
  longer need marketplace plugins (`ponytail`, `caveman`, `tdd-guard`) or user-global skills
  (`grilling`, `improve-codebase-architecture`). Everything ships in `skills/`, `agents/`,
  `hooks/`. New `skill-guard` PreToolUse hook enforces per-skill / per-role guardrails.
- **Manual step** — `major` only because it needs one-time consumer work: bump the pin, rename
  the bundle asset (`hacs.json` `filename`, resource URL), check the Claude Code version. The
  npm package API is unchanged.

### v1.2.0

- **Shared runtime** — new `ha-card-shared/runtime` export: `SubscriptionManager`, `DebugMetrics`,
  `timeAgo`. Consumers with local copies of these can delete them and import from the shared package.
- **CI** — `self-check.yml` now runs a `runtime` job (build + typecheck + coverage) in addition to
  the existing `lint` and `smoke` jobs.
