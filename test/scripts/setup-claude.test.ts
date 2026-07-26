import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, readlinkSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
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

describe("setup-claude.js", () => {
  it("creates .claude/settings.json with SessionStart hook", () => {
    run();
    const settings = JSON.parse(
      readFileSync(join(tmp, ".claude", "settings.json"), "utf8"),
    );
    const hooks = settings.hooks.SessionStart[0].hooks;
    expect(hooks).toHaveLength(1);
    expect(hooks[0].statusMessage).toBe(
      "ha-card-shared: checking required plugins",
    );
  });

  it("running twice keeps exactly one hook entry", () => {
    run();
    run();
    const settings = JSON.parse(
      readFileSync(join(tmp, ".claude", "settings.json"), "utf8"),
    );
    expect(settings.hooks.SessionStart[0].hooks).toHaveLength(1);
  });

  it("symlinks explain-diff-gfm into .claude/skills/", () => {
    run();
    const link = readlinkSync(
      join(tmp, ".claude", "skills", "explain-diff-gfm"),
    );
    expect(link).toBe(join(sharedRoot, "skills", "explain-diff-gfm"));
  });

  it("running twice does not throw on existing symlink", () => {
    run();
    expect(run).not.toThrow();
  });
});
