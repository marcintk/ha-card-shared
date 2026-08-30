#!/usr/bin/env node
// pr-cost — after-the-fact token / dollar digest for the work that produced a PR.
//
//   node .claude/tools/pr-cost.mjs <pr#> [<pr#>…]      one line per PR + a Σ total
//   node .claude/tools/pr-cost.mjs --since <ref>       every PR merged into main since <ref>
//   node .claude/tools/pr-cost.mjs --all               every merged PR
//   flags: --repo <owner/name>  --json  --rates <path>
//
// How: `commit-it` stamps every commit with `Claude-Session: …/session_<ID>`. That <ID> also
// appears in the session transcript as `"bridgeSessionId":"cse_<ID>"`. So: PR → commit
// trailers → session ids → transcript files under ~/.claude/projects/** (main sessions,
// spawned-agent sessions, and */subagents/*.jsonl) → sum `message.usage` → price with
// model-rates.json → the digest:
//
//   Used Σ191k(⊕289,⇄99.8%) ↑174 | $0.0407  4.0AIU
//
//   Σ  total billed = input + cache-create + cache-read + output      ⇄  cache-read share of input
//   ⊕  cache-creation (write) tokens                                  ↑  output tokens (incl. thinking)
//   $  from model-rates.json ($/Mtok)                                 AIU  $ × aiuPerUsd (1 AIU = 1¢)
//
// Transcripts are local — this runs on the dev box, not CI. Commits made before the
// Claude-Session trailer existed contribute nothing and are reported as such.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** @typedef {{ in:number, out:number, cw5:number, cw1h:number, cr:number, turnsMain:number, turnsAgent:number }} Bucket */

/** @returns {Bucket} */
function emptyBucket() {
  return { in: 0, out: 0, cw5: 0, cw1h: 0, cr: 0, turnsMain: 0, turnsAgent: 0 };
}

/** @param {Bucket} g @param {Bucket} b */
function addBucket(g, b) {
  g.in += b.in;
  g.out += b.out;
  g.cw5 += b.cw5;
  g.cw1h += b.cw1h;
  g.cr += b.cr;
  g.turnsMain += b.turnsMain;
  g.turnsAgent += b.turnsAgent;
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ prs:number[], since:string|null, all:boolean, repo:string|null, json:boolean, rates:string|null, help:boolean }} */
  const o = { prs: [], since: null, all: false, repo: null, json: false, rates: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") o.all = true;
    else if (a === "--json") o.json = true;
    else if (a === "--since") o.since = argv[++i] ?? null;
    else if (a === "--repo") o.repo = argv[++i] ?? null;
    else if (a === "--rates") o.rates = argv[++i] ?? null;
    else if (/^\d+$/.test(a)) o.prs.push(Number(a));
    else if (a === "-h" || a === "--help") o.help = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  return o;
}

/** @param {string[]} args @returns {string} */
function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** @param {{ since:string|null, all:boolean, repo:string|null }} o @returns {number[]} */
function resolvePrs(o) {
  const base = [
    "pr",
    "list",
    "--state",
    "merged",
    "--base",
    "main",
    "--limit",
    "400",
    "--json",
    "number,mergedAt",
  ];
  if (o.repo) base.push("--repo", o.repo);
  /** @type {{ number:number, mergedAt:string }[]} */
  const list = JSON.parse(gh(base));
  if (o.all) return list.map((p) => p.number).sort((a, b) => a - b);
  // --since <ref>: PRs merged after that ref's commit date
  const isoCmd = execFileSync("git", ["log", "-1", "--format=%cI", o.since ?? ""], {
    encoding: "utf8",
  }).trim();
  const cutoff = Date.parse(isoCmd);
  return list
    .filter((p) => Date.parse(p.mergedAt) > cutoff)
    .map((p) => p.number)
    .sort((a, b) => a - b);
}

/** @param {number} pr @param {string|null} repo @returns {{ title:string, sessions:Set<string>, commits:number, stamped:number }} */
function sessionsForPr(pr, repo) {
  const args = ["pr", "view", String(pr), "--json", "title,commits"];
  if (repo) args.push("--repo", repo);
  /** @type {{ title:string, commits:{ messageHeadline:string, messageBody:string }[] }} */
  const view = JSON.parse(gh(args));
  const sessions = new Set();
  let stamped = 0;
  for (const c of view.commits) {
    const text = `${c.messageHeadline}\n${c.messageBody}`;
    const ids = [...text.matchAll(/(?:session_|cse_)([A-Za-z0-9]{6,})/g)].map((m) => m[1]);
    if (ids.length) stamped++;
    for (const id of ids) sessions.add(id);
  }
  return { title: view.title, sessions, commits: view.commits.length, stamped };
}

/** @returns {string[]} every *.jsonl under ~/.claude/projects (recursive) */
function allTranscripts() {
  const root = join(homedir(), ".claude", "projects");
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(p);
    }
  };
  walk(root);
  return out;
}

/** @param {string[]} sessionIds @param {string[]} files @returns {string[]} files mentioning any id */
function transcriptsFor(sessionIds, files) {
  if (!sessionIds.length) return [];
  try {
    const args = ["-rlF", ...sessionIds.flatMap((id) => ["-e", id]), ...files];
    return execFileSync("grep", args, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch {
    // grep exits 1 on no match, or is absent — fall back to a JS scan
    return files.filter((f) => {
      const t = readFileSync(f, "utf8");
      return sessionIds.some((id) => t.includes(id));
    });
  }
}

/** @param {string[]} files @returns {{ byModel: Record<string, Bucket>, seen: Set<string> }} */
function sumUsage(files, seen = new Set()) {
  /** @type {Record<string, Bucket>} */
  const byModel = {};
  for (const f of files) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line) continue;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (o?.type !== "assistant") continue;
      const u = o.message?.usage;
      const id = o.message?.id;
      if (!u || !id || seen.has(id)) continue; // dedupe API-message retries across resumed transcripts
      seen.add(id);
      const model = o.message.model || "unknown";
      if (!byModel[model]) byModel[model] = emptyBucket();
      const b = byModel[model];
      b.in += u.input_tokens || 0;
      b.out += u.output_tokens || 0;
      b.cr += u.cache_read_input_tokens || 0;
      const cc = u.cache_creation || {};
      b.cw5 += cc.ephemeral_5m_input_tokens || 0;
      b.cw1h += cc.ephemeral_1h_input_tokens || 0;
      // fall back to the flat field if the split isn't present
      if (!cc.ephemeral_5m_input_tokens && !cc.ephemeral_1h_input_tokens)
        b.cw5 += u.cache_creation_input_tokens || 0;
      if (o.isSidechain) b.turnsAgent++;
      else b.turnsMain++;
    }
  }
  return { byModel, seen };
}

/** @param {Record<string, Bucket>} byModel @param {any} rates */
function price(byModel, rates) {
  let usd = 0;
  /** @type {string[]} */
  const unknown = [];
  for (const [model, b] of Object.entries(byModel)) {
    const r = rates.rates[model];
    if (!r) {
      unknown.push(model);
      continue;
    }
    usd +=
      (b.in * r.in +
        b.out * r.out +
        b.cw5 * r.cacheWrite5m +
        b.cw1h * r.cacheWrite1h +
        b.cr * r.cacheRead) /
      1e6;
  }
  return { usd, unknown };
}

/** @param {number} n */
function h(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}

/** @param {Record<string, Bucket>} byModel @param {number} usd @param {number} aiuPerUsd */
function digest(byModel, usd, aiuPerUsd) {
  let inT = 0;
  let out = 0;
  let cw = 0;
  let cr = 0;
  for (const b of Object.values(byModel)) {
    inT += b.in;
    out += b.out;
    cw += b.cw5 + b.cw1h;
    cr += b.cr;
  }
  const total = inT + out + cw + cr;
  const hitDen = cr + inT;
  const hit = hitDen ? (cr / hitDen) * 100 : 0;
  const dollars = usd >= 1 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4)}`;
  const aiu = `${(usd * aiuPerUsd).toFixed(1)}AIU`;
  return `Used Σ${h(total)}(⊕${h(cw)},⇄${hit.toFixed(1)}%) ↑${h(out)} | ${dollars}  ${aiu}`;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || (!o.prs.length && !o.since && !o.all)) {
    process.stdout.write(
      "usage: pr-cost <pr#>… | --since <ref> | --all   [--repo o/n] [--json] [--rates path]\n"
    );
    process.exit(o.help ? 0 : 1);
  }
  const rates = JSON.parse(readFileSync(o.rates || join(HERE, "model-rates.json"), "utf8"));
  const prs = o.prs.length ? o.prs : resolvePrs(o);
  if (!prs.length) {
    process.stdout.write("no matching PRs\n");
    return;
  }
  const files = allTranscripts();
  const seen = new Set();
  /** @type {Record<string, Bucket>} */
  const grand = {};
  /** @type {any[]} */
  const rows = [];

  for (const pr of prs) {
    const { title, sessions, commits, stamped } = sessionsForPr(pr, o.repo);
    const matched = transcriptsFor([...sessions], files);
    const { byModel } = sumUsage(matched, seen); // seen carries across PRs — no double count
    const { usd, unknown } = price(byModel, rates);
    for (const [m, b] of Object.entries(byModel)) {
      if (!grand[m]) grand[m] = emptyBucket();
      addBucket(grand[m], b);
    }
    rows.push({
      pr,
      title,
      commits,
      stamped,
      sessions: [...sessions],
      transcripts: matched.length,
      byModel,
      usd,
      unknown,
      line: digest(byModel, usd, rates.aiuPerUsd),
    });
  }

  if (o.json) {
    const gUsd = price(grand, rates).usd;
    process.stdout.write(
      `${JSON.stringify({ prs: rows, total: { byModel: grand, usd: gUsd, line: digest(grand, gUsd, rates.aiuPerUsd) } }, null, 2)}\n`
    );
    return;
  }

  for (const r of rows) {
    process.stdout.write(`#${r.pr}  ${r.line}\n`);
    if (!r.stamped)
      process.stdout.write(
        `      (no Claude-Session trailer on any commit — nothing to attribute)\n`
      );
    if (r.unknown.length)
      process.stdout.write(`      (no rate for: ${r.unknown.join(", ")} — priced at $0)\n`);
  }
  if (rows.length > 1) {
    const gUsd = price(grand, rates).usd;
    process.stdout.write(`Σ${rows.length} PRs  ${digest(grand, gUsd, rates.aiuPerUsd)}\n`);
  }
}

export { digest, emptyBucket, h, parseArgs, price, sumUsage };

const invokedDirectly =
  process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
