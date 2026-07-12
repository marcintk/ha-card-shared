@CLAUDE-SHARED.md

# ha-card-shared — Claude Context

This is the shared toolchain repo itself, not a card project. The workflow in CLAUDE-SHARED.md applies for all code changes.

## Releasing a new version

Full process and semver guidance is in `README.md` → "Releasing ha-card-shared". Summary:

- Bump version: `npm version patch|minor|major --no-git-tag-version`
- Update the composite-action ref in `.github/workflows/shared-publish-release.yml` to match the new version.
- Commit, tag, and push: `git commit -am "chore: bump version to vX.Y.Z" && git tag vX.Y.Z && git push origin main vX.Y.Z`

## Consumer pickup

After a release, consumers update their dependency:

```bash
npm install github:marcintk/ha-card-shared#vX.Y.Z --save-dev
```

They also need to update any workflow `uses:` refs from `@vOLD` to `@vNEW`.
