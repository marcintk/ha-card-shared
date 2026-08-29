import { execSync } from "node:child_process";
import {
  lstatSync,
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

const scriptPath = resolve(process.cwd(), "harness/setup-claude.js");
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
  it("wires a single skill-guard PreToolUse check hook, and no Stop hook", () => {
    run();
    const { hooks } = settings();
    const pre = hooks.PreToolUse.filter((e) =>
      e.hooks.some((h) => h.command.includes("skill-guard.mjs"))
    );
    const args = pre.map((e) => e.hooks[0].command.match(/skill-guard\.mjs" (\w+)/)?.[1]);
    expect(args).toEqual(["check"]);
    expect(pre[0].matcher).toBe("Bash|Edit|Write|MultiEdit|NotebookEdit");
    expect(hooks.Stop).toBeUndefined();
  });

  it("running twice keeps exactly one guard hook", () => {
    run();
    run();
    const { hooks } = settings();
    const guardPre = hooks.PreToolUse.filter((e) =>
      e.hooks.some((h) => h.command.includes("skill-guard.mjs"))
    );
    expect(guardPre).toHaveLength(1);
  });

  // v2 wired a PreToolUse × Skill "enter" hook and a Stop "clear" hook for the skill-state layer,
  // which v3 replaces with an explicit phase (see harness/hooks/skill-guard.mjs). An upgrading
  // consumer still has both from their last install; confirm they're stripped, not left dangling.
  it("strips a pre-3.0 Skill-matcher enter hook and Stop clear hook on upgrade", () => {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    writeFileSync(
      join(tmp, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Skill",
              hooks: [
                { type: "command", command: `node "${scriptPath}/../hooks/skill-guard.mjs" enter` },
              ],
            },
          ],
          Stop: [
            {
              hooks: [
                { type: "command", command: `node "${scriptPath}/../hooks/skill-guard.mjs" clear` },
              ],
            },
          ],
        },
      })
    );
    run();
    const { hooks } = settings();
    expect(hooks.PreToolUse.some((e) => e.matcher === "Skill")).toBe(false);
    expect(hooks.Stop).toBeUndefined();
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
    const link = readlinkSync(join(tmp, ".claude", "skills", "design-it"));
    expect(link).toBe(join(sharedRoot, "harness", "skills", "design-it"));
  });

  it("symlinks a pipeline subagent into .claude/agents/", () => {
    run();
    const link = readlinkSync(join(tmp, ".claude", "agents", "code-writer.md"));
    expect(link).toBe(join(sharedRoot, "harness", "agents", "code-writer.md"));
  });

  it("symlinks the guard hook into .claude/hooks/ and wires the check hook through it", () => {
    run();
    const link = readlinkSync(join(tmp, ".claude", "hooks", "skill-guard.mjs"));
    expect(link).toBe(join(sharedRoot, "harness", "hooks", "skill-guard.mjs"));
    const cmd = settings()
      .hooks.PreToolUse.flatMap((e) => e.hooks)
      .find((h) => h.command.includes("skill-guard.mjs"))?.command;
    expect(cmd).toContain(".claude/hooks/skill-guard.mjs");
  });

  it("running twice does not throw on existing symlinks", () => {
    run();
    expect(run).not.toThrow();
  });

  it("prunes its own broken symlinks (a skill removed in a newer version)", () => {
    run();
    const skillsDir = join(tmp, ".claude", "skills");
    symlinkSync(
      join(sharedRoot, "harness", "skills", "explain-diff-gfm"),
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

// Pre-2.0 consumers symlinked .claude/settings.json into node_modules. Writing through that link
// either throws (v2 stopped shipping .claude/) or lands in the package copy, which the next
// install discards.
describe("setup-claude.js settings.json symlinked into node_modules", () => {
  const linkSettings = () => {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    symlinkSync(
      join("..", "node_modules", "ha-card-shared", ".claude", "settings.json"),
      join(tmp, ".claude", "settings.json")
    );
  };
  const guardHooks = () =>
    Object.values(settings().hooks)
      .flat()
      .flatMap((e) => e.hooks)
      .filter((h) => h.command.includes("skill-guard.mjs"));

  it("installs when the link dangles", () => {
    linkSettings();
    expect(run).not.toThrow();
    expect(guardHooks().length).toBeGreaterThan(0);
    expect(lstatSync(join(tmp, ".claude", "settings.json")).isSymbolicLink()).toBe(false);
  });

  it("never writes through the link into node_modules", () => {
    const pkgClaude = join(tmp, "node_modules", "ha-card-shared", ".claude");
    mkdirSync(pkgClaude, { recursive: true });
    writeFileSync(join(pkgClaude, "settings.json"), '{"hooks":{}}\n');
    linkSettings();
    run();
    expect(readFileSync(join(pkgClaude, "settings.json"), "utf8")).toBe('{"hooks":{}}\n');
    expect(guardHooks().length).toBeGreaterThan(0);
  });

  it("leaves a symlink pointing outside node_modules alone", () => {
    const own = join(tmp, "my-settings.json");
    writeFileSync(own, JSON.stringify({ hooks: {} }));
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    symlinkSync(own, join(tmp, ".claude", "settings.json"));
    run();
    expect(lstatSync(join(tmp, ".claude", "settings.json")).isSymbolicLink()).toBe(true);
  });
});

describe("setup-claude.js git hooks", () => {
  const gitInit = () => {
    execSync("git init -q", { cwd: tmp });
    execSync("git config user.email t@t.t && git config user.name t", { cwd: tmp });
  };
  const hooksPath = () =>
    execSync("git config --local --get core.hooksPath", { cwd: tmp }).toString().trim();

  it("points core.hooksPath at the bundled harness/.githooks", () => {
    gitInit();
    run();
    expect(hooksPath().replace(/\\/g, "/")).toBe(
      `${sharedRoot.replace(/\\/g, "/")}/harness/.githooks`
    );
  });

  it("is a no-op outside a git repo", () => {
    expect(run).not.toThrow();
  });

  it("does not clobber a consumer's own core.hooksPath", () => {
    gitInit();
    mkdirSync(join(tmp, ".my-hooks"), { recursive: true });
    writeFileSync(join(tmp, ".my-hooks", "pre-commit"), "#!/bin/sh\n");
    execSync("git config --local core.hooksPath .my-hooks", { cwd: tmp });
    run();
    expect(hooksPath()).toBe(".my-hooks");
  });

  // A value naming a missing or empty directory hooks nothing — git runs no hook and says
  // nothing. Left alone it strands the consumer forever, since the value isn't ours to match on.
  it("takes over a value naming a directory that does not exist", () => {
    gitInit();
    execSync("git config --local core.hooksPath .githooks", { cwd: tmp });
    run();
    expect(hooksPath()).toContain("harness/.githooks");
  });

  it("takes over a value naming an empty directory", () => {
    gitInit();
    mkdirSync(join(tmp, ".githooks"), { recursive: true });
    execSync("git config --local core.hooksPath .githooks", { cwd: tmp });
    run();
    expect(hooksPath()).toContain("harness/.githooks");
  });

  it("re-points its own stale value and is idempotent", () => {
    gitInit();
    execSync("git config --local core.hooksPath node_modules/ha-card-shared/.githooks", {
      cwd: tmp,
    });
    run();
    run();
    expect(hooksPath()).toContain("harness/.githooks");
  });
});
