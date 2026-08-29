import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const doc = readFileSync(`${root}/CLAUDE-SHARED.md`, "utf8");
const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8")) as {
  scripts: Record<string, string>;
  files: string[];
};

describe("CLAUDE-SHARED.md", () => {
  // Deliberately checks only inline `npm run x` mentions in prose, not the fenced ```bash
  // command block — that block documents the commands a *consumer card* defines (build:prod,
  // dev, test:watch and friends, per its own convention), not ha-card-shared's own scripts,
  // which are narrower since it isn't itself a card being bundled/watched. Widening this to the
  // fenced block would be a false positive, not a fix — see the doc's own caveat above it.
  it("all npm run commands it names exist in package.json", () => {
    const commands = [...doc.matchAll(/`npm run ([\w:]+)`/g)].map((m) => m[1]);
    for (const cmd of new Set(commands)) {
      expect(pkg.scripts, `npm run ${cmd} not in package.json`).toHaveProperty(cmd);
    }
  });

  it("routes every change through /design-it and /code-it, with no third path", () => {
    expect(doc).toContain("/design-it");
    expect(doc).toContain("/code-it");
    expect(doc).toMatch(/no third path/i);
  });

  it("points at brainstorm-it for a fuzzy idea before the issue is filed", () => {
    expect(doc).toContain("brainstorm-it");
  });

  it("makes the pipelines maintain LESSONS.md", () => {
    expect(doc).toContain("LESSONS.md");
  });

  it("names the pipeline files under harness/ as the change surface", () => {
    expect(doc).toContain("harness/skills/");
    expect(doc).toContain("harness/agents/");
    expect(doc).toContain("harness/hooks/skill-guard");
  });
});

describe("skill set", () => {
  const skills = [
    "design-it",
    "code-it",
    "ship-it",
    "release-it",
    "explain-it",
    "commit-it",
    "brainstorm-it",
  ];
  const entryPoints = ["design-it", "code-it", "ship-it", "release-it"];

  it.each(skills)("harness/skills/%s/SKILL.md exists", (name) => {
    expect(existsSync(`${root}/harness/skills/${name}/SKILL.md`)).toBe(true);
  });

  it.each(["fix-it", "feature-it", "pr-it"])("the retired %s skill is gone", (name) => {
    expect(existsSync(`${root}/harness/skills/${name}`)).toBe(false);
  });

  it("the retired explain-diff-gfm skill is gone", () => {
    expect(existsSync(`${root}/harness/skills/explain-diff-gfm`)).toBe(false);
  });

  it("the explain-diff renderer moved under explain-it", () => {
    expect(existsSync(`${root}/harness/skills/explain-it/scripts/render.py`)).toBe(true);
  });

  it.each(["codebase-design", "handoff", "improve-it"])("%s is no longer a skill", (name) => {
    expect(existsSync(`${root}/harness/skills/${name}`)).toBe(false);
  });

  it("the design method is a plain doc folder — index + four areas, no skill frontmatter", () => {
    const dir = `${root}/harness/design-methods`;
    expect(existsSync(`${root}/harness/deep-modules.md`)).toBe(false); // the single-file step
    expect(existsSync(`${root}/harness/reference`)).toBe(false); // the reference/ tree
    for (const f of ["README.md", "glossary.md", "design.md", "discipline.md", "processes.md"]) {
      expect(existsSync(`${dir}/${f}`), f).toBe(true);
      expect(readFileSync(`${dir}/${f}`, "utf8"), f).not.toMatch(/^name:/m);
    }
    // improve-it's scan + design-it-twice folded into the processes area
    const processes = readFileSync(`${dir}/processes.md`, "utf8");
    expect(processes).toContain("Scanning for candidates");
    expect(processes).toContain("Design it twice");
    // the filled-in gaps landed
    expect(readFileSync(`${dir}/design.md`, "utf8")).toMatch(/change amplification/i);
    expect(readFileSync(`${dir}/design.md`, "utf8")).toMatch(/pull complexity downward/i);
  });

  it("design-it points at harness/design-methods/ and drives the no-arg scan", () => {
    const src = readFileSync(`${root}/harness/skills/design-it/SKILL.md`, "utf8");
    expect(src).toContain("harness/design-methods/");
    expect(src).not.toContain("codebase-design");
    expect(src).not.toContain("deep-modules.md");
    // bare `/design-it` is a documented mode, not an error
    expect(src).toContain("Scanning for candidates");
    expect(src).toMatch(/no number/i);
  });

  it("release-it's repo-wide pass calls /design-it, not the retired /improve-it", () => {
    const src = readFileSync(`${root}/harness/skills/release-it/SKILL.md`, "utf8");
    expect(src).not.toContain("improve-it");
    expect(src).toContain("/design-it");
  });

  // Every SKILL.md declares who may invoke it: a `**Invocation:**` body marker whose wording
  // matches the frontmatter — `disable-model-invocation: true` iff the marker says "HUMAN only".
  it("every skill declares its invocation, marker matching frontmatter", () => {
    const modelInvocable: Record<string, string> = {
      "explain-it": "**Invocation:** HUMAN or AI",
      "brainstorm-it": "**Invocation:** HUMAN or AI",
      "commit-it": "**Invocation:** AI (sub-skill)",
    };
    for (const n of entryPoints) {
      const src = readFileSync(`${root}/harness/skills/${n}/SKILL.md`, "utf8");
      expect(src, n).toContain("disable-model-invocation: true");
      expect(src, n).toContain("**Invocation:** HUMAN only");
    }
    for (const [n, marker] of Object.entries(modelInvocable)) {
      const src = readFileSync(`${root}/harness/skills/${n}/SKILL.md`, "utf8");
      expect(src, n).not.toContain("disable-model-invocation");
      expect(src, n).toContain(marker);
    }
  });

  // The harness stays small on purpose: a skill that needs more than this is doing two jobs.
  // See LESSONS.md — a 32,800-line alternative was trialled and dropped purely on token cost.
  it.each(entryPoints)("%s/SKILL.md stays under ~80 lines", (name) => {
    const lines = readFileSync(`${root}/harness/skills/${name}/SKILL.md`, "utf8").split("\n");
    expect(lines.length).toBeLessThanOrEqual(85);
  });

  it.each(entryPoints)("%s adds no references/ directory", (name) => {
    expect(existsSync(`${root}/harness/skills/${name}/references`)).toBe(false);
  });
});

describe("skill-guard", () => {
  const agents = ["code-writer", "test-writer", "reviewer", "explorer"];

  it.each(agents)("harness/agents/%s.md exists", (name) => {
    expect(existsSync(`${root}/harness/agents/${name}.md`)).toBe(true);
  });

  it("ships the harness/ tree in the npm package", () => {
    expect(pkg.files).toContain("harness/");
  });

  it("the policy names every guarded role and phase", () => {
    const policy = JSON.parse(readFileSync(`${root}/harness/hooks/skill-guard.json`, "utf8")) as {
      phases: Record<string, unknown>;
      roles: Record<string, unknown>;
    };
    expect(Object.keys(policy.roles).sort()).toEqual(agents.slice().sort());
    expect(Object.keys(policy.phases).sort()).toEqual(["code", "design", "release", "ship"]);
  });
});
