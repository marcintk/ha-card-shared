import typescript from "@rollup/plugin-typescript";

const ts = () => typescript({ declaration: true, declarationDir: "dist", rootDir: "src" });

export default [
  {
    input: "src/index.ts",
    output: { file: "dist/index.js", format: "es" },
    plugins: [ts()],
  },
  {
    input: "src/test-utils.ts",
    output: { file: "dist/test-utils.js", format: "es" },
    plugins: [ts()],
  },
];
