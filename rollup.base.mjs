import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export function cardBundle({ name }) {
  const version = process.env.VERSION ?? "0.0.0-dev";
  return {
    input: "src/index.ts",
    output: {
      file: "dist/card.js",
      format: "es",
      banner: `/* ${name} v${version} */`,
      intro: `const __CARD_VERSION__ = '${version}';`,
    },
    plugins: [
      nodeResolve(),
      typescript(),
      ...(process.env.NODE_ENV === "production" ? [terser()] : []),
    ],
  };
}
