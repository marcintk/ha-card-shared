import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs helper, no d.ts
import { digest, h, parseArgs, price, sumUsage } from "../../harness/tools/pr-cost.mjs";

const rates = {
  aiuPerUsd: 100,
  rates: {
    "claude-sonnet-5": { in: 2, out: 10, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.2 },
  },
};

/** one assistant transcript line */
function turn(id: string, model: string, usage: object, isSidechain = false) {
  return JSON.stringify({ type: "assistant", isSidechain, message: { id, model, usage } });
}

function fixture(lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "prcost-"));
  const f = join(dir, "session.jsonl");
  writeFileSync(f, `${lines.join("\n")}\n`);
  return f;
}

describe("pr-cost", () => {
  it("sums usage per model, dedupes by message id, splits main vs subagent turns", () => {
    const f = fixture([
      turn("m1", "claude-sonnet-5", {
        input_tokens: 100,
        output_tokens: 2000,
        cache_read_input_tokens: 500_000,
        cache_creation: { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 4000 },
      }),
      turn("m1", "claude-sonnet-5", { input_tokens: 999999, output_tokens: 999999 }), // dup id — ignored
      turn(
        "m2",
        "claude-sonnet-5",
        { input_tokens: 0, output_tokens: 300, cache_creation_input_tokens: 200 }, // flat cache field
        true
      ),
      '{"type":"user","message":{"content":"hi"}}', // non-assistant — ignored
    ]);
    const { byModel } = sumUsage([f]);
    const b = byModel["claude-sonnet-5"];
    expect(b.in).toBe(100);
    expect(b.out).toBe(2300);
    expect(b.cr).toBe(500_000);
    expect(b.cw5).toBe(1200); // 1000 + the flat 200
    expect(b.cw1h).toBe(4000);
    expect(b.turnsMain).toBe(1);
    expect(b.turnsAgent).toBe(1);
  });

  it("prices from the rate table and flags an unknown model", () => {
    const byModel = {
      "claude-sonnet-5": {
        in: 1_000_000,
        out: 1_000_000,
        cw5: 1_000_000,
        cw1h: 0,
        cr: 10_000_000,
        turnsMain: 1,
        turnsAgent: 0,
      },
      "claude-made-up-9": {
        in: 5,
        out: 5,
        cw5: 0,
        cw1h: 0,
        cr: 0,
        turnsMain: 1,
        turnsAgent: 0,
      },
    };
    const { usd, unknown } = price(byModel, rates);
    // 2 (in) + 10 (out) + 2.5 (cw5) + 2.0 (10M cache-read @ $0.20) = 16.5
    expect(usd).toBeCloseTo(16.5, 6);
    expect(unknown).toEqual(["claude-made-up-9"]);
  });

  it("renders the digest line in the documented format", () => {
    const byModel = {
      "claude-sonnet-5": {
        in: 200,
        out: 174_000,
        cw5: 1_100,
        cw1h: 0,
        cr: 190_000_000,
        turnsMain: 3,
        turnsAgent: 0,
      },
    };
    const { usd } = price(byModel, rates);
    const line = digest(byModel, usd, rates.aiuPerUsd);
    expect(line).toMatch(/^Used Σ\d/);
    expect(line).toContain("⊕1k");
    expect(line).toContain("↑174k");
    expect(line).toContain("AIU");
    expect(line).toMatch(/⇄100\.0%/); // 190M cache-read vs 200 fresh input
  });

  it("h() gives k / M suffixes", () => {
    expect(h(999)).toBe("999");
    expect(h(1499)).toBe("1k");
    expect(h(2_400_000)).toBe("2.4M");
  });

  it("parseArgs reads pr numbers and flags", () => {
    const o = parseArgs(["59", "60", "--json", "--since", "v2.0.0"]);
    expect(o.prs).toEqual([59, 60]);
    expect(o.json).toBe(true);
    expect(o.since).toBe("v2.0.0");
  });
});
