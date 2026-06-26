export const baseVitestConfig = {
  define: { __CARD_VERSION__: '"test"' },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "html", "json-summary", "json"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
};
