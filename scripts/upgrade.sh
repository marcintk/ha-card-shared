#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: bash upgrade.sh <version>  (e.g. v1.1.0)}"
BRANCH="chore/ha-card-shared-${VERSION}"

git checkout -b "$BRANCH"

# Bump + install (postinstall silently writes .claude/settings.json)
npm install "github:marcintk/ha-card-shared#${VERSION}" --save-dev

npm run check:ci && npm test

git add package.json package-lock.json
git diff --cached --quiet || git commit -m "chore: bump ha-card-shared to ${VERSION}"

# Wire Dependabot on first run so future releases need no manual steps
if [ ! -f .github/dependabot.yml ]; then
  mkdir -p .github
  cat > .github/dependabot.yml <<'YAML'
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    allow:
      - dependency-name: ha-card-shared
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
YAML
  git add .github/dependabot.yml
  git commit -m "chore: add Dependabot config for ha-card-shared"
fi

git push -u origin "$BRANCH"
gh pr create \
  --title "chore: bump ha-card-shared to ${VERSION}" \
  --body "Bumps ha-card-shared to ${VERSION}. Postinstall auto-configures .claude/settings.json. Future bumps handled automatically by Dependabot."
