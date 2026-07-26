import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type Spec = {
  title: string;
  slug: string;
  subtitle?: string;
  sections: { id: string; heading: string; html: string; md?: string }[];
  quiz: { question: string; options: { text: string; correct: boolean }[] }[];
};

const script = resolve(process.cwd(), "skills/explain-diff-gfm/scripts/render.py");

const MINIMAL_SPEC = {
  title: "Test Change",
  slug: "test-change",
  sections: [{ id: "background", heading: "Background", html: "<p>Hello</p>", md: "Hello" }],
  quiz: [
    {
      question: "What changed?",
      options: [
        { text: "Nothing", correct: false },
        { text: "Everything", correct: true },
      ],
    },
  ],
};

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "render-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true });
});

function specFile(spec: Spec = MINIMAL_SPEC): string {
  const path = join(tmp, "spec.json");
  writeFileSync(path, JSON.stringify(spec));
  return path;
}

function render(args: string): string {
  const out = join(tmp, "out");
  execSync(`python3 ${script} ${args} -o ${out}`, { encoding: "utf8" });
  return readFileSync(out, "utf8");
}

function renderFails(args: string): { stderr: string; status: number } {
  const result = spawnSync("python3", [script, ...args.split(" ")], { encoding: "utf8" });
  return { stderr: result.stderr, status: result.status ?? 1 };
}

describe("render_html", () => {
  it("contains title and CSS scaffold", () => {
    const output = render(`${specFile()} --format html`);
    expect(output).toContain("<!DOCTYPE html>");
    expect(output).toContain("Test Change");
    expect(output).toContain("<style>");
  });

  it("renders section heading", () => {
    const output = render(`${specFile()} --format html`);
    expect(output).toContain('<h2 id="background">Background</h2>');
  });

  it("renders quiz with interactive buttons", () => {
    const output = render(`${specFile()} --format html`);
    expect(output).toContain('class="quiz-q"');
    expect(output).toContain("What changed?");
    expect(output).toContain('data-correct="true"');
    expect(output).toContain('data-correct="false"');
  });

  it("includes quiz JS", () => {
    const output = render(`${specFile()} --format html`);
    expect(output).toContain("quiz-opt");
    expect(output).toContain("<script>");
  });

  it("escapes HTML in title", () => {
    const output = render(
      `${specFile({ ...MINIMAL_SPEC, title: "<script>xss</script>" })} --format html`
    );
    expect(output).not.toContain("<script>xss</script>");
    expect(output).toContain("&lt;script&gt;");
  });

  it("renders subtitle when present", () => {
    const output = render(`${specFile({ ...MINIMAL_SPEC, subtitle: "PR #42" })} --format html`);
    expect(output).toContain("PR #42");
  });

  it("omits subtitle block when absent", () => {
    const output = render(`${specFile()} --format html`);
    expect(output).not.toContain("margin-top:-.5rem");
  });
});

describe("render_gfm", () => {
  it("starts with h1 title", () => {
    const output = render(`${specFile()} --format gfm`);
    expect(output.trimStart()).toMatch(/^# Test Change/);
  });

  it("renders section heading and content", () => {
    const output = render(`${specFile()} --format gfm`);
    expect(output).toContain("## Background");
    expect(output).toContain("Hello");
  });

  it("renders TOC with anchor links", () => {
    const output = render(`${specFile()} --format gfm`);
    expect(output).toContain("[Background](#background)");
    expect(output).toContain("[Quiz](#quiz)");
  });

  it("renders quiz with details/summary reveal", () => {
    const output = render(`${specFile()} --format gfm`);
    expect(output).toContain("**Q1: What changed?**");
    expect(output).toContain("<details><summary>Reveal answer</summary>");
    expect(output).toContain("**Everything** is correct.");
  });

  it("falls back to strip_html when md field absent", () => {
    const spec = {
      ...MINIMAL_SPEC,
      sections: [{ id: "bg", heading: "Background", html: "<p>Stripped content</p>" }],
    };
    const output = render(`${specFile(spec)} --format gfm`);
    expect(output).toContain("Stripped content");
    expect(output).not.toContain("<p>");
  });

  it("renders subtitle as italic", () => {
    const output = render(`${specFile({ ...MINIMAL_SPEC, subtitle: "PR #42" })} --format gfm`);
    expect(output).toContain("_PR #42_");
  });
});

describe("strip_html fallback", () => {
  it("converts <strong> to **bold**", () => {
    const spec = {
      ...MINIMAL_SPEC,
      sections: [{ id: "s", heading: "S", html: "<strong>bold</strong>" }],
    };
    const output = render(`${specFile(spec)} --format gfm`);
    expect(output).toContain("**bold**");
  });

  it("converts <code> to backticks", () => {
    const spec = {
      ...MINIMAL_SPEC,
      sections: [{ id: "s", heading: "S", html: "<code>fn()</code>" }],
    };
    const output = render(`${specFile(spec)} --format gfm`);
    expect(output).toContain("`fn()`");
  });

  it("converts <pre><code> to fenced block", () => {
    const spec = {
      ...MINIMAL_SPEC,
      sections: [{ id: "s", heading: "S", html: "<pre><code>x = 1</code></pre>" }],
    };
    const output = render(`${specFile(spec)} --format gfm`);
    expect(output).toContain("```\nx = 1\n```");
  });
});

describe("error handling", () => {
  it("exits non-zero for missing spec file", () => {
    const { status } = renderFails("/nonexistent/spec.json --format html");
    expect(status).not.toBe(0);
  });

  it("exits non-zero for invalid JSON", () => {
    const path = join(tmp, "bad.json");
    writeFileSync(path, "not json");
    const { status } = renderFails(`${path} --format html`);
    expect(status).not.toBe(0);
  });

  it("exits non-zero when title field missing", () => {
    const path = join(tmp, "notitle.json");
    writeFileSync(path, JSON.stringify({ slug: "x", sections: [] }));
    const { status } = renderFails(`${path} --format html`);
    expect(status).not.toBe(0);
  });
});

describe("output path", () => {
  it("prints output path to stdout", () => {
    const out = join(tmp, "explicit.html");
    const stdout = execSync(`python3 ${script} ${specFile()} -o ${out}`, {
      encoding: "utf8",
    }).trim();
    expect(stdout).toBe(out);
  });

  it("writes to default /tmp path when -o omitted", () => {
    const today = new Date().toISOString().slice(0, 10);
    const stdout = execSync(`python3 ${script} ${specFile()} --format gfm`, {
      encoding: "utf8",
    }).trim();
    expect(stdout).toMatch(new RegExp(`^/tmp/${today}-explanation-test-change\\.md$`));
  });
});
