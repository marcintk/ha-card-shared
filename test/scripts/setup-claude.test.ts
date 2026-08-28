import { execSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/setup-claude.js");
const sharedRoot = resolve(process.cwd());

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "setup-claude-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true });
});

function run() {
  execSync(`node ${scriptPath}`, { env: { ...process.env, INIT_CWD: tmp } });
}

function settings() {
  return JSON.parse(readFileSync(join(tmp, ".claude", "settings.json"), "utf8")) as {
    hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]>;
  };
}

describe("setup-claude.js", () => {
  it("wires the skill-guard PreToolUse and Stop hooks", () => {
    run();
    const { hooks } = settings();
    const pre = hooks.PreToolUse.filter((e) =>
      e.hooks.some((h) => h.command.includes("skill-guard.mjs"))
    );
    const args = pre.map((e) => e.hooks[0].command.match(/skill-guard\.mjs" (\w+)/)?.[1]);
    expect(args).toEqual(["enter", "check"]);
    expect(pre.find((e) => e.hooks[0].command.endsWith("enter"))?.matcher).toBe("Skill");
    expect(
      hooks.Stop.some(
        (e) =>
          e.hooks[0].command.includes("skill-guard.mjs") &&
          e.hooks[0].command.trimEnd().endsWith("clear")
      )
    ).toBe(true);
  });

  it("running twice keeps exactly one set of guard hooks", () => {
    run();
    run();
    const { hooks } = settings();
    const guardPre = hooks.PreToolUse.filter((e) =>
      e.hooks.some((h) => h.command.includes("skill-guard.mjs"))
    );
    expect(guardPre).toHaveLength(2);
    expect(hooks.Stop).toHaveLength(1);
  });

  it("drops the legacy plugin-check SessionStart hook", () => {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    writeFileSync(
      join(tmp, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          SessionStart: [
            { hooks: [{ statusMessage: "ha-card-shared: checking required plugins" }] },
          ],
        },
      })
    );
    run();
    expect(settings().hooks.SessionStart).toBeUndefined();
  });

  it("symlinks a bundled skill into .claude/skills/", () => {
    run();
    const link = readlinkSync(join(tmp, ".claude", "skills", "fix-it"));
    expect(link).toBe(join(sharedRoot, "skills", "fix-it"));
  });

  it("symlinks a pipeline subagent into .claude/agents/", () => {
    run();
    const link = readlinkSync(join(tmp, ".claude", "agents", "pipeline-coder.md"));
    expect(link).toBe(join(sharedRoot, "agents", "pipeline-coder.md"));
  });

  it("running twice does not throw on existing symlinks", () => {
    run();
    expect(run).not.toThrow();
  });

  it("prunes its own broken symlinks (a skill removed in a newer version)", () => {
    run();
    const skillsDir = join(tmp, ".claude", "skills");
    symlinkSync(
      join(sharedRoot, "skills", "explain-diff-gfm"),
      join(skillsDir, "explain-diff-gfm")
    );
    run();
    expect(readdirSync(skillsDir)).not.toContain("explain-diff-gfm");
  });

  it("leaves foreign symlinks in .claude/skills/ alone", () => {
    run();
    const skillsDir = join(tmp, ".claude", "skills");
    symlinkSync(join(tmp, "nowhere"), join(skillsDir, "user-skill"));
    run();
    expect(readdirSync(skillsDir)).toContain("user-skill");
  });
});
