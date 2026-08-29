import type { RollupOptions } from "rollup";

/**
 * Rollup config for a card bundle: `src/index.ts` → `dist/<name>.js`.
 *
 * `name` defaults to `package.json`'s name (via `npm_package_name`) and falls back to
 * `"card"` when npm metadata is absent — e.g. rollup invoked outside an `npm run` script.
 */
export declare function cardBundle(options?: { name?: string }): RollupOptions & {
  output: { file: string };
};
