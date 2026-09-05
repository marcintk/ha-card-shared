# HA Cards — Shared Development Context

TypeScript + Rollup → `dist/<project>.js` | Vitest | Biome + Prettier | HACS plugin

## Commands

Every consumer card defines these (a shared convention, not exports of `ha-card-shared` itself —
`ha-card-shared`'s own `package.json` is narrower, since it isn't a card being bundled or watched):

```bash
npm install
npm run build          # bundle src/ → dist/<project>.js (name from package.json)
npm run build:prod     # minified build (VERSION env var stamps the bundle)
npm run dev            # rollup watch mode
npm test               # run tests
npm run test:watch     # vitest watch mode
npm run test:coverage  # run with coverage (must stay at 100%)
npm run typecheck      # tsc --noEmit
npm run check          # biome lint + format (src/ and test/, auto-fix)
npm run format:md      # prettier for markdown files
npm run check:ci       # CI gate: typecheck + biome check + prettier check
```
