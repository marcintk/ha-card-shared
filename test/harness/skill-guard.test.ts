import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = resolve(process.cwd(), "harness/hooks/skill-guard.mjs");

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "skill-guard-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true });
});

/** Run a CLI subcommand (phase, red, green, status) the way a skill's own Bash step would —
 * cwd set to the project root, no stdin payload. */
function cli(...args: string[]): SpawnSyncReturns<string> {
  return spawnSync("node", [script, ...args], { cwd: tmp, encoding: "utf8" });
}

/** Run the PreToolUse "check" hook with a crafted payload, the way Claude Code invokes it. */
function check(payload: Record<string, unknown>): SpawnSyncReturns<string> {
  return spawnSync("node", [script, "check"], { input: JSON.stringify(payload), encoding: "utf8" });
}

function readLog(): string {
  return readFileSync(join(tmp, ".claude", "skill-guard", "log"), "utf8");
}

describe("phase subcommand", () => {
  it("rejects an unknown phase name and exits 1", () => {
    const res = cli("phase", "bogus");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("unknown phase");
  });

  it("phase clear removes the marker with no error, even if none was set", () => {
    expect(cli("phase", "clear").status).toBe(0);
  });

  it("sets the marker even when stdin carries junk (only `check` reads a payload)", () => {
    const res = spawnSync("node", [script, "phase", "design"], {
      cwd: tmp,
      input: "this is not json",
      encoding: "utf8",
    });
    expect(res.status).toBe(0);
    // and it took effect — a design-phase deny now fires
    const after = check({ cwd: tmp, tool_name: "Bash", tool_input: { command: "git push" } });
    expect(after.status).toBe(2);
  });
});

describe("phase × role union", () => {
  it("denies when the phase alone denies it (no role active)", () => {
    cli("phase", "design");
    const res = check({ cwd: tmp, tool_name: "Bash", tool_input: { command: "git push" } });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("phase design");
  });

  it("denies when the role alone denies it, even though the phase would allow it", () => {
    cli("phase", "code"); // code phase allows commit
    const res = check({
      cwd: tmp,
      agent_type: "explorer", // role denies commit unconditionally
      tool_name: "Bash",
      tool_input: { command: "git commit -m x" },
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("role explorer");
  });

  it("allows when both the phase and the role allow it", () => {
    cli("phase", "code");
    const res = check({
      cwd: tmp,
      agent_type: "code-writer",
      tool_name: "Bash",
      tool_input: { command: "git status" },
    });
    expect(res.status).toBe(0);
  });

  it("a stale phase (older than phase_stale_seconds) is treated as no phase", () => {
    cli("phase", "design");
    mkdirSync(join(tmp, ".claude", "skill-guard"), { recursive: true });
    const phaseFile = join(tmp, ".claude", "skill-guard", "phase");
    const oldTs = Date.now() - 9 * 60 * 60 * 1000; // 9h ago, past the 8h default
    writeFileSync(phaseFile, `design\t${oldTs}\n`);
    const res = check({
      cwd: tmp,
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/src/x.ts` },
    });
    expect(res.status).toBe(0); // no guarded context — fails open
  });

  it("a malformed phase file (no timestamp) is dropped noisily, not silently", () => {
    mkdirSync(join(tmp, ".claude", "skill-guard"), { recursive: true });
    writeFileSync(join(tmp, ".claude", "skill-guard", "phase"), "ship_no_tab\n");
    const res = check({
      cwd: tmp,
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/src/x.ts` },
    });
    expect(res.status).toBe(0); // ship would deny ^src/, but the marker can't be trusted
    expect(res.stderr).toContain("malformed marker");
  });
});

describe("project root", () => {
  it("does not treat a .git at the home directory as the project root", () => {
    mkdirSync(join(tmp, ".git"), { recursive: true });
    mkdirSync(join(tmp, "card"), { recursive: true });
    const env = { ...process.env, HOME: tmp, USERPROFILE: tmp };
    // phase set from inside the not-yet-init'd card
    spawnSync("node", [script, "phase", "design"], {
      cwd: join(tmp, "card"),
      env,
      encoding: "utf8",
    });
    // state landed under the card, not under the fake home
    expect(existsSync(join(tmp, "card", ".claude", "skill-guard", "phase"))).toBe(true);
    expect(existsSync(join(tmp, ".claude", "skill-guard", "phase"))).toBe(false);
  });
});

describe("reviewer", () => {
  it("may edit src/", () => {
    const res = check({
      cwd: tmp,
      agent_type: "reviewer",
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/src/foo.ts` },
    });
    expect(res.status).toBe(0);
  });

  it("may not edit test/", () => {
    const res = check({
      cwd: tmp,
      agent_type: "reviewer",
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/test/foo.test.ts` },
    });
    expect(res.status).toBe(2);
  });

  it("may run read-only git (it has to read the diff it reviews)", () => {
    for (const command of [
      "git diff main...HEAD",
      "git log --oneline",
      "git show HEAD",
      "git status",
    ]) {
      const res = check({
        cwd: tmp,
        agent_type: "reviewer",
        tool_name: "Bash",
        tool_input: { command },
      });
      expect(res.status, command).toBe(0);
    }
  });

  it("may not run mutating git or open/merge a PR", () => {
    for (const command of [
      "git commit -m x",
      "git push",
      "git checkout main",
      "gh pr create",
      "gh pr merge 1",
    ]) {
      const res = check({
        cwd: tmp,
        agent_type: "reviewer",
        tool_name: "Bash",
        tool_input: { command },
      });
      expect(res.status, command).toBe(2);
    }
  });
});

describe("code-writer red/green marker", () => {
  it("denies a src/ write with no red marker", () => {
    const res = check({
      cwd: tmp,
      agent_type: "code-writer",
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/src/foo.ts` },
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("no failing test marked");
  });

  it("allows a src/ write once a test is marked red", () => {
    cli("red", "test/foo.test.ts");
    const res = check({
      cwd: tmp,
      agent_type: "code-writer",
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/src/foo.ts` },
    });
    expect(res.status).toBe(0);
  });

  it("denies again once green clears the marker", () => {
    cli("red", "test/foo.test.ts");
    cli("green");
    const res = check({
      cwd: tmp,
      agent_type: "code-writer",
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/src/foo.ts` },
    });
    expect(res.status).toBe(2);
  });

  it("still denies a test/ write even with a red marker set", () => {
    cli("red", "test/foo.test.ts");
    const res = check({
      cwd: tmp,
      agent_type: "code-writer",
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/test/foo.test.ts` },
    });
    expect(res.status).toBe(2);
  });
});

describe("path normalization", () => {
  it("denies a target that resolves outside the project root, under any guarded role", () => {
    const res = check({
      cwd: tmp,
      agent_type: "code-writer", // no deny_write pattern would otherwise match this path
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/../../../etc/passwd` },
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("outside the project root");
  });

  it("a phase with no deny_write allows an out-of-root target (e.g. a /tmp handoff)", () => {
    cli("phase", "code"); // `code` restricts bash but imposes no deny_write
    const res = check({
      cwd: tmp,
      tool_name: "Write",
      tool_input: { file_path: `${tmp}/../../../tmp/handoff.txt` },
    });
    expect(res.status).toBe(0);
  });

  it("anchors src/ and test/ at the git root even when the session cwd is a subdirectory", () => {
    mkdirSync(join(tmp, ".git"), { recursive: true });
    mkdirSync(join(tmp, "src"), { recursive: true });
    cli("phase", "design"); // design denies ^src/ writes
    const res = check({
      cwd: join(tmp, "src"), // session started inside src/
      tool_name: "Edit",
      tool_input: { file_path: join(tmp, "src", "widget.ts") },
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("phase design");
  });

  it("resolves a symlinked cwd without a false-positive escape", () => {
    mkdirSync(join(tmp, "real", "src"), { recursive: true });
    symlinkSync(join(tmp, "real"), join(tmp, "alt"));
    const res = check({
      cwd: join(tmp, "alt"),
      agent_type: "test-writer",
      tool_name: "Edit",
      tool_input: { file_path: join(tmp, "alt", "src", "foo.ts") },
    });
    // denied because test-writer denies src/, not because the path looked like an escape —
    // proves the symlink was resolved to the same canonical root on both sides.
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("the failing-test step");
  });

  it("resolves a double-slashed cwd the same way", () => {
    mkdirSync(join(tmp, "dbl", "src"), { recursive: true });
    const dbl = `${tmp}//dbl`;
    const res = check({
      cwd: dbl,
      agent_type: "test-writer",
      tool_name: "Edit",
      tool_input: { file_path: `${dbl}/src/foo.ts` },
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("the failing-test step");
  });
});

describe("deny_bash bypass patterns", () => {
  const denied = (cmd: string) =>
    check({
      cwd: tmp,
      agent_type: "explorer",
      tool_name: "Bash",
      tool_input: { command: cmd },
    }).status;

  it("denies a leading cd-chained command", () => {
    expect(denied("cd /tmp && git push")).toBe(2);
  });

  it("denies git -C <dir> <subcommand>", () => {
    expect(denied(`git -C ${tmp} commit -m x`)).toBe(2);
  });

  it("denies git -C with a quoted directory that contains spaces", () => {
    expect(denied(`git -C "${tmp}/a b" commit -m x`)).toBe(2);
  });

  it("denies git with a --no-pager global flag before the subcommand", () => {
    expect(denied("git --no-pager push")).toBe(2);
  });

  it("denies git -c with a quoted value that contains spaces", () => {
    expect(denied(`git -c user.name="A B" commit -m x`)).toBe(2);
  });

  it("does not match a bare git pattern inside a longer token", () => {
    expect(denied("legit push")).toBe(0);
    expect(denied("mygit commit -m x")).toBe(0);
  });

  it("denies an env-prefixed command", () => {
    expect(denied("env FOO=bar git push")).toBe(2);
  });

  it("still allows an unrelated git command", () => {
    expect(denied("git status")).toBe(0);
  });

  it("does not match a subcommand that only starts with a trigger word", () => {
    expect(denied("git commit-tree -m x")).toBe(0);
  });

  it("denies an unrecognised git global flag before the subcommand", () => {
    expect(denied("git --no-optional-locks commit -m x")).toBe(2);
    expect(denied("git --attr-source=HEAD push")).toBe(2);
  });

  it("catches a bare `$(...)` command substitution via the `(` anchor", () => {
    expect(denied("echo $(git push)")).toBe(2);
  });

  it("ignores a trigger word inside a quoted argument of an unrelated command", () => {
    cli("phase", "design"); // denies `npm version`, `git push`, `git commit`
    for (const command of [
      'echo "reminder: run npm version before tagging"',
      `printf '%s\\n' "git push then git commit"`,
      'git log --grep "git push"',
    ]) {
      const res = check({ cwd: tmp, tool_name: "Bash", tool_input: { command } });
      expect(res.status, command).toBe(0);
    }
  });
});

describe("release phase npm version", () => {
  it("denies a bare `npm version` (it would make its own commit and tag)", () => {
    cli("phase", "release");
    const res = check({
      cwd: tmp,
      tool_name: "Bash",
      tool_input: { command: "npm version patch" },
    });
    expect(res.status).toBe(2);
  });

  it("allows `npm version <bump> --no-git-tag-version`", () => {
    cli("phase", "release");
    const res = check({
      cwd: tmp,
      tool_name: "Bash",
      tool_input: { command: "npm version minor --no-git-tag-version" },
    });
    expect(res.status).toBe(0);
  });

  it("still denies when --no-git-tag-version binds to a later command in a chain", () => {
    cli("phase", "release");
    const res = check({
      cwd: tmp,
      tool_name: "Bash",
      tool_input: { command: "npm version patch && echo done --no-git-tag-version" },
    });
    expect(res.status).toBe(2);
  });
});

describe("policy file", () => {
  it("every deny_bash / deny_write pattern is a valid regex", () => {
    const policy = JSON.parse(
      readFileSync(resolve(process.cwd(), "harness/hooks/skill-guard.json"), "utf8")
    ) as { phases: Record<string, unknown>; roles: Record<string, unknown> };
    const groups = [...Object.values(policy.phases), ...Object.values(policy.roles)] as {
      deny_bash?: string[];
      deny_write?: string[];
    }[];
    for (const g of groups) {
      for (const re of [...(g.deny_bash ?? []), ...(g.deny_write ?? [])]) {
        // a bad pattern would be caught at runtime but leave that one rule silently inert
        expect(() => new RegExp(re), re).not.toThrow();
      }
    }
  });
});

describe("fail-open", () => {
  it("allows the call when the payload isn't valid JSON", () => {
    const res = spawnSync("node", [script, "check"], { input: "not json", encoding: "utf8" });
    expect(res.status).toBe(0);
  });

  it("allows the call when no phase or role is active", () => {
    const res = check({
      cwd: tmp,
      tool_name: "Edit",
      tool_input: { file_path: `${tmp}/src/x.ts` },
    });
    expect(res.status).toBe(0);
  });

  it("SKILL_GUARD_OFF=1 disables every check", () => {
    cli("phase", "design");
    const res = spawnSync("node", [script, "check"], {
      input: JSON.stringify({ cwd: tmp, tool_name: "Bash", tool_input: { command: "git push" } }),
      encoding: "utf8",
      env: { ...process.env, SKILL_GUARD_OFF: "1" },
    });
    expect(res.status).toBe(0);
  });
});

describe("decision log", () => {
  it("records both an allow and a deny", () => {
    cli("phase", "design");
    check({ cwd: tmp, tool_name: "Edit", tool_input: { file_path: `${tmp}/docs/x.html` } }); // allow
    check({ cwd: tmp, tool_name: "Bash", tool_input: { command: "git push" } }); // deny
    const log = readLog();
    expect(log).toMatch(/\tallow\t/);
    expect(log).toMatch(/\tdeny\t/);
  });
});
