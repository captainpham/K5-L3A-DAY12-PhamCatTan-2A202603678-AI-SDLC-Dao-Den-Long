// Ticket-04 bench: <bench_cmd> --seed 42 --duration 30 --out bench.json [--shot screenshot.png]
// Opens a real Chrome window (1280x720 viewport, not fullscreen) through Puppeteer, with vsync and the frame-rate cap
// disabled, loads the standard bench scene (?bench=1) and collects the frame times measured by the page.
import { writeFileSync } from "node:fs";
import { cpus, arch, release, totalmem, type } from "node:os";
import { performance } from "node:perf_hooks";
import { startServer } from "./serve";

interface PageResult { frames: number; avg_fps: number; p1_low_fps: number; frame_ms_p95: number; renderer: string; peak_js_heap_mb: number | null }

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const get = (k: string, d?: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
  const seed = Number(get("seed", "42")), duration = Number(get("duration", "30")), out = get("out", "bench.json")!, shot = get("shot");
  if (!Number.isFinite(seed) || !(duration > 0)) { process.stderr.write("usage: --seed <int> --duration <s> --out <file>\n"); return 1; }

  // puppeteer is an optional dependency (it downloads Chrome): the game itself does not need it
  let puppeteer: typeof import("puppeteer");
  try { puppeteer = require("puppeteer"); } catch {
    process.stderr.write("bench needs puppeteer (it opens a real Chrome window). Install it with: npm install puppeteer\n");
    return 1;
  }
  const { server, port } = await startServer(0);
  const browser = await puppeteer.launch({
    headless: false, // a real window, as the ticket asks
    defaultViewport: { width: 1280, height: 720 },
    args: [
      "--window-size=1280,860", "--disable-gpu-vsync", "--disable-frame-rate-limit",
      "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
      "--no-first-run", "--no-default-browser-check", "--ignore-gpu-blocklist", "--enable-gpu-rasterization",
    ],
  });
  let loadMs = 0;
  let pageRef: import("puppeteer").Page | null = null;
  const done = new Promise<PageResult>((ok, fail) => {
    const page = browser.newPage();
    page.then(async (p) => {
      p.on("pageerror", (e) => process.stderr.write(`page error: ${e}\n`));
      p.on("console", (m) => { if (m.type() === "error" || process.env.BENCH_DEBUG) process.stderr.write(`page console: ${m.text()}\n`); });
      p.on("requestfailed", (r) => process.stderr.write(`request failed: ${r.url()} ${r.failure()?.errorText}\n`));
      await p.exposeFunction("__benchFirstFrame", () => { loadMs = Math.round(performance.now()); }); // ms since process start
      await p.exposeFunction("__benchDone", (r: PageResult) => ok(r));
      pageRef = p;
      await p.goto(`http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}`);
    }).catch(fail);
    setTimeout(() => fail(new Error("bench timed out")), (duration + 90) * 1000);
  });
  try {
    const r = await done;
    // screenshot only after the measured window (taking it mid-run stalls the render loop)
    if (shot && pageRef) await (pageRef as import("puppeteer").Page).screenshot({ path: shot as `${string}.png` }).catch(() => undefined);
    const result = {
      contract_version: "1.3",
      avg_fps: r.avg_fps,
      p1_low_fps: r.p1_low_fps,
      frame_ms_p95: r.frame_ms_p95,
      frames: r.frames,
      load_ms: loadMs,
      peak_mem_mb: null, // web build: the browser's process RSS is not visible to the page (see README); JS heap below
      peak_js_heap_mb: r.peak_js_heap_mb,
      vsync_off: true,
      renderer: `${r.renderer}; ${await browser.version()} (Puppeteer)`,
      os: `${type()} ${release()} ${arch()}, ${cpus()[0]?.model ?? "cpu"} x${cpus().length}, RAM ${Math.round(totalmem() / 2 ** 30)} GB`,
      seed, duration_s: duration,
    };
    writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (e) {
    process.stderr.write(`bench failed: ${(e as Error).message}\n`);
    return 1;
  } finally {
    await browser.close().catch(() => undefined);
    server.close();
  }
}

void main().then((code) => process.exit(code));
