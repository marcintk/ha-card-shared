import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const doc = readFileSync(`${root}/CLAUDE-SHARED.md`, "utf8");
const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8")) as {
  scripts: Record<string, string>;
};

describe("CLAUDE-SHARED.md", () => {
  it("has all 5 phases in order", () => {
    const phases = [...doc.matchAll(/^### Phase (\d+)/gm)].map((m) =>
      Number(m[1]),
    );
    expect(phases).toEqual([1, 2, 3, 4, 5]);
  });

  it("all npm run commands exist in package.json", () => {
    const commands = [...doc.matchAll(/`npm run ([\w:]+)`/g)].map((m) => m[1]);
    for (const cmd of new Set(commands)) {
      expect(pkg.scripts, `npm run ${cmd} not in package.json`).toHaveProperty(
        cmd,
      );
    }
  });

  it('phase 1 requires explicit "go ahead" before coding', () => {
    expect(doc).toContain('"go ahead"');
  });

  it('phase 5 requires explicit "ship" or "release it" trigger', () => {
    expect(doc).toContain('"ship"');
    expect(doc).toContain('"release it"');
  });

  it("phase 5 pushes commit and tag together via --follow-tags", () => {
    expect(doc).toContain("git push --follow-tags");
  });

  it("explain-diff-gfm skill file exists in skills/", () => {
    const skill = readFileSync(
      `${root}/skills/explain-diff-gfm/SKILL.md`,
      "utf8",
    );
    expect(skill).toContain("explain-diff-gfm");
  });
});
