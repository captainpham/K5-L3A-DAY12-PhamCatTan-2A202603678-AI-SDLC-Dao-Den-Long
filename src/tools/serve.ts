// run_cmd: serves the web build + a tiny local leaderboard API (saved on disk, survives restarts).
//   node dist/serve.cjs                          -> http://localhost:4173 (opens the browser)
//   node dist/serve.cjs --export-leaderboard out.json   -> {"entries": [...]} in leaderboard order, then exit
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { homedir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { addEntry, sortEntries, toEntry, type LeaderEntry } from "../sim/leaderboard";

export const DATA_DIR = process.env.DDL_DATA_DIR ?? join(homedir(), ".dao-den-long");
const BOARD = () => join(DATA_DIR, "leaderboard.json");
const WEB_DIR = resolve(__dirname, "web");

export function loadBoard(): LeaderEntry[] {
  try {
    const raw = JSON.parse(readFileSync(BOARD(), "utf8"));
    const list = Array.isArray(raw?.entries) ? raw.entries : [];
    return sortEntries(list.map(toEntry).filter((e: LeaderEntry | null): e is LeaderEntry => e !== null)).slice(0, 10);
  } catch { return []; }
}

function saveBoard(list: LeaderEntry[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(BOARD(), JSON.stringify({ entries: list }, null, 2) + "\n");
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4",
};

export function startServer(port: number, host = "127.0.0.1"): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/api/leaderboard") {
      if (req.method === "GET") { res.writeHead(200, { "content-type": MIME[".json"] }); res.end(JSON.stringify({ entries: loadBoard() })); return; }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => { body += c; if (body.length > 10_000) req.destroy(); });
        req.on("end", () => {
          let e: LeaderEntry | null = null;
          try { e = toEntry(JSON.parse(body)); } catch { /* invalid JSON */ }
          if (!e) { res.writeHead(400); res.end(JSON.stringify({ error: "invalid entry" })); return; }
          const list = addEntry(loadBoard(), e);
          saveBoard(list);
          res.writeHead(200, { "content-type": MIME[".json"] }); res.end(JSON.stringify({ entries: list }));
        });
        return;
      }
    }
    // static files from dist/web (no path traversal)
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    let file = resolve(WEB_DIR, rel || "index.html");
    if (!file.startsWith(WEB_DIR + sep) && file !== WEB_DIR) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file) || file === WEB_DIR) file = join(WEB_DIR, "index.html");
    try {
      const data = readFileSync(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, host, () => ok({ server, port: (server.address() as { port: number }).port }));
  });
}

function openBrowser(url: string): void {
  const cmd = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch { /* no browser: the URL is printed */ }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ex = args.indexOf("--export-leaderboard");
  if (ex >= 0) {
    const out = args[ex + 1];
    if (!out) { process.stderr.write("usage: --export-leaderboard <out.json>\n"); process.exit(1); }
    writeFileSync(out, JSON.stringify({ entries: loadBoard() }, null, 2) + "\n");
    process.stdout.write(`leaderboard exported to ${out}\n`);
    return;
  }
  if (!existsSync(join(WEB_DIR, "index.html"))) { process.stderr.write("dist/web not found: run `npm run build` first\n"); process.exit(1); }
  const pi = args.indexOf("--port");
  const { port } = await startServer(pi >= 0 ? Number(args[pi + 1]) : Number(process.env.PORT ?? 4173), "0.0.0.0");
  const url = `http://localhost:${port}`;
  process.stdout.write(`Đảo Đèn Lồng: ${url}  (leaderboard: ${BOARD()})  Ctrl+C to stop\n`);
  if (!args.includes("--no-open")) openBrowser(url);
}

export { main as serveMain };
