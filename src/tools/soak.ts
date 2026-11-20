// Ticket-04 soak test: <soak_cmd> --seed 7 --nights 10 --out soak.json
// 10 nights in one process (1 -> 2 -> 3 -> 1 ...), night i uses seed + i, seeded random input.
import { writeFileSync } from "node:fs";
import { Game } from "../sim/game";
import { makeRng } from "../sim/rng";
import { nightDurationS } from "../sim/tuning";
import type { InputState } from "../sim/types";

export interface SoakResult { nights: number; crashes: number; results: string[]; mem_start_mb: number; mem_end_mb: number; duration_s: number; errors?: string[] }

const rssMb = () => {
  (globalThis as { gc?: () => void }).gc?.(); // run with --expose-gc for stable numbers
  return Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
};

/** One night with random input: every 30 ticks a new move direction; per tick 5% jump, 3% dash, 2% pulse, 10% interact. */
export function playNight(night: 1 | 2 | 3, seed: number): Game {
  const g = new Game({ seed, night });
  const rng = makeRng(seed ^ 0x5eed);
  const maxTicks = nightDurationS(night) * 60;
  let move: [number, number] = [0, 0];
  for (let k = 0; k < maxTicks && g.state === "playing"; k++) {
    if (k % 30 === 0) { const a = rng() * Math.PI * 2; move = [Math.cos(a), Math.sin(a)]; }
    const input: InputState = {
      move, camYawDeg: 0,
      jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.1, pause: false,
    };
    g.step(input);
  }
  return g;
}

export function soak(seed: number, nights: number): SoakResult {
  const t0 = Date.now();
  const results: string[] = [];
  const errors: string[] = [];
  let crashes = 0;
  let memStart = 0;
  // Loading the first night includes warming up the engine: one throw-away night (own seed, not counted in `results`)
  // so V8 has compiled the hot paths and grown its heap. Without it the first reading is taken on a cold process and
  // the ratio mostly measures start-up growth, not leaks (40 nights end at the same ~45 MB as 10 nights).
  try { playNight(1, seed - 1); } catch { /* a crash in the real nights is what is counted */ }
  for (let i = 0; i < nights; i++) {
    const night = ((i % 3) + 1) as 1 | 2 | 3;
    try {
      if (i === 0) { new Game({ seed: seed + i, night }); memStart = rssMb(); } // RSS after the first night is loaded
      let g: Game | null = playNight(night, seed + i);
      results.push(g.state);
      g = null; // reset: drop the night
    } catch (e) {
      crashes++;
      results.push("crash");
      errors.push(`night ${i + 1}: ${(e as Error).message}`);
    }
  }
  const memEnd = rssMb(); // after the last night was reset
  const out: SoakResult = { nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: Math.round((Date.now() - t0) / 100) / 10 };
  if (errors.length) out.errors = errors;
  return out;
}

function main(): number { // CLI entry: src/tools/soak-cli.ts
  const args = process.argv.slice(2);
  const get = (k: string, d?: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
  const seed = Number(get("seed", "7")), nights = Number(get("nights", "10")), out = get("out", "soak.json")!;
  if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) { process.stderr.write("usage: --seed <int> --nights <int> --out <file>\n"); return 1; }
  const r = soak(seed, nights);
  writeFileSync(out, JSON.stringify(r, null, 2) + "\n");
  process.stdout.write(`${JSON.stringify(r)}\n`);
  return 0;
}

export { main as soakMain };
