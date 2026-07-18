import typescript from "@rollup/plugin-typescript";

const tsOpts = { declaration: true, declarationDir: "dist", rootDir: "src" };

export default [
  {
    input: "src/index.ts",
    output: { file: "dist/index.js", format: "es" },
    plugins: [typescript(tsOpts)],
  },
  {
    input: "src/test-utils.ts",
    output: { file: "dist/test-utils.js", format: "es" },
    plugins: [typescript(tsOpts)],
  },
];
