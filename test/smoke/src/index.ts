/// <reference path="../../../globals.d.ts" />
// Minimal card that exercises the shared toolchain end to end:
// - reads __CARD_VERSION__ (typed via ../../globals.d.ts, injected by rollup/vitest)
// - gets bundled by rollup.base.mjs, typechecked by tsconfig.base.json, tested under vitest.base.mjs
export function version(): string {
  return __CARD_VERSION__;
}
