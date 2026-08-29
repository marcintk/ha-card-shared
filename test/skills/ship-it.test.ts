import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const doc = readFileSync(`${root}/harness/skills/ship-it/SKILL.md`, "utf8");

// pre-commit blocks every commit on main (harness/.githooks/pre-commit). A bare `npm version
// <bump>` shells out to a plain `git commit` on whatever branch is checked out, so run on main it
// is blocked and the release never happens. See LESSONS.md.
describe("ship-it/SKILL.md release steps", () => {
  it("never lets npm version create a commit directly on main", () => {
    const bashBlocks = [...doc.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
    const versionLines = bashBlocks
      .join("\n")
      .split("\n")
      .filter((l) => l.includes("npm version"));
    expect(versionLines.length).toBeGreaterThan(0);
    for (const line of versionLines) {
      expect(line).toContain("--no-git-tag-version");
    }
  });

  it("cuts the release on a branch, not directly on main", () => {
    expect(doc).toMatch(/git checkout -b release\//);
  });

  it("tags main after merging back, not as part of the version-bump commit", () => {
    expect(doc).toMatch(/git tag v/);
    const tagIdx = doc.indexOf("git tag v");
    const checkoutMainIdx = doc.lastIndexOf("checkout main", tagIdx);
    expect(checkoutMainIdx).toBeGreaterThan(-1);
    expect(checkoutMainIdx).toBeLessThan(tagIdx);
  });
});
