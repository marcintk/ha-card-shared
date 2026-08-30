#!/usr/bin/env node
// preview-web — build a browser bundle, serve a demo dir on a local port, open it.
//
//   node preview-web.mjs --build "npm run build" --serve-dir docs --open index.html [--port 8777]
//     rebuilds, (re)starts a detached static server on the first free port from --port
//     (default 8777), opens --open in the browser, prints `READY <url>` and the stop command.
//
//   node preview-web.mjs __serve <absDir> <port>
//     internal: the static server itself (symlink-aware, no deps). Not called directly.
//
// State: <cwd>/.claude/show-it/.server.json holds { pid, port, dir } so a re-run replaces the
// previous server instead of leaking it. It lives under .claude/ (gitignored in every consumer)
// rather than next to this script, which is symlinked in from node_modules. Serves tracked
// symlinks (e.g. docs/card.js -> dist/) by guarding traversal on the URL path, not the target.

import { spawn, spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { connect } from "node:net";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STATE_DIR = join(process.cwd(), ".claude", "show-it");
const STATE = join(STATE_DIR, ".server.json");

/** @type {Record<string, string>} */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

/** @param {string} dirArg @param {number} port */
function runServer(dirArg, port) {
  const root = resolve(dirArg);
  createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      // Traversal guard on the *request* path — a symlink inside root may still point outside
      // (docs/card.js -> ../dist/card.js), which is intentional and allowed.
      const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      let target = join(root, rel);
      if (!target.startsWith(root)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
      if (!existsSync(target)) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store",
      });
      createReadStream(target).pipe(res);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  }).listen(port, "127.0.0.1");
}

/** @param {number} port @returns {Promise<boolean>} */
function portFree(port) {
  return new Promise((res) => {
    const s = connect(port, "127.0.0.1");
    s.on("connect", () => {
      s.destroy();
      res(false);
    });
    s.on("error", () => res(true));
  });
}

/** @param {number} from @returns {Promise<number>} */
async function firstFreePort(from) {
  for (let p = from; p < from + 50; p++) {
    if (await portFree(p)) return p;
  }
  throw new Error(`no free port in ${from}..${from + 49}`);
}

/** @param {number} pid */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Kill the server from a previous run and wait for its port to actually free, so the next
// scan can reuse the same port instead of drifting upward on every invocation. Returns the
// freed port (to try first) or null.
/** @returns {Promise<number | null>} */
async function killPrevious() {
  if (!existsSync(STATE)) return null;
  /** @type {{ pid?: number, port?: number }} */
  let prev = {};
  try {
    prev = JSON.parse(readFileSync(STATE, "utf8"));
  } catch {
    /* corrupt state file */
  }
  rmSync(STATE, { force: true });
  const { pid, port } = prev;
  if (!pid || !alive(pid)) return port ?? null;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* raced us to exit */
  }
  for (let i = 0; i < 20 && alive(pid); i++) await new Promise((r) => setTimeout(r, 50));
  if (alive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }
  if (port)
    for (let i = 0; i < 20 && !(await portFree(port)); i++)
      await new Promise((r) => setTimeout(r, 50));
  return port ?? null;
}

/** @param {number} port @param {number} [tries] @returns {Promise<boolean>} */
async function waitReachable(port, tries = 40) {
  for (let i = 0; i < tries; i++) {
    if (!(await portFree(port))) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** @param {string[]} args */
async function orchestrate(args) {
  /** @param {string} name @param {string} [def] @returns {string | undefined} */
  const opt = (name, def) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  const buildCmd = opt("build", "") ?? "";
  const serveDir = resolve(opt("serve-dir", ".") ?? ".");
  const openRel = opt("open", "index.html") ?? "index.html";
  const startPort = Number(opt("port", "8777"));

  if (buildCmd) {
    const [cmd, ...rest] = buildCmd.split(" ");
    const r = spawnSync(cmd, rest, { stdio: "inherit" });
    if (r.status !== 0) {
      console.error(`preview-web: build failed (${buildCmd})`);
      process.exit(1);
    }
  }

  if (!existsSync(join(serveDir, openRel))) {
    console.error(`preview-web: ${join(serveDir, openRel)} does not exist`);
    process.exit(1);
  }

  const freedPort = await killPrevious();
  const port = await firstFreePort(freedPort ?? startPort);

  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "__serve", serveDir, String(port)],
    { detached: true, stdio: "ignore" }
  );
  child.unref();
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE, JSON.stringify({ pid: child.pid, port, dir: serveDir }));

  if (!(await waitReachable(port))) {
    console.error("preview-web: server did not come up");
    process.exit(1);
  }

  const url = `http://127.0.0.1:${port}/${openRel}`;
  spawnSync("xdg-open", [url], { stdio: "ignore" });
  console.log(`READY ${url}`);
  console.log(`stop:  kill $(node -e "console.log(require('${STATE}').pid)")`);
}

if (process.argv[2] === "__serve") {
  runServer(process.argv[3], Number(process.argv[4]));
} else {
  orchestrate(process.argv.slice(2));
}
