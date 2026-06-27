// Ambient globals shared by every ha-* card.
// `__CARD_VERSION__` is injected by rollup.base.mjs (intro) and vitest.base.mjs (define),
// so its type lives with the config that creates it. Reference from tsconfig `include`.

declare const __CARD_VERSION__: string;

interface Window {
  customCards: Array<{
    type: string;
    name: string;
    description: string;
    preview: boolean;
  }>;
}
