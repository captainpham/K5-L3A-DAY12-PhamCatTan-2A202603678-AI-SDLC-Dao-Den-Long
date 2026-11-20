// Ticket-04 benchmark scene + statistics (pure: used by the bench page, the bench runner and the tests).
import { Game } from "./game";
import { makeRng } from "./rng";

export const BENCH = {
  shades: 200,
  motes: 100,
  litLanterns: ["L1", "L2", "L3"],
  warmupS: 3,
  orbitRadius: 30,
  orbitHeight: 15,
  orbitPeriodS: 15,
  spreadRadius: 38, // inside the 40 m Night 1 island
} as const;

/** Night 1, Mây idle at (0,0,0), 200 wandering shades + 100 motes spread uniformly (seeded), L1-L3 lit with fuel 100. */
export function makeBenchGame(seed = 42): Game {
  const g = new Game({ seed, night: 1 });
  g.bench = true;
  g.randomMotes = g.randomShades = g.randomDrifters = g.windEnabled = false;
  const rng = makeRng(seed);
  const spot = (): [number, number] => {
    const r = BENCH.spreadRadius * Math.sqrt(rng()), a = rng() * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  g.shades = Array.from({ length: BENCH.shades }, (_, i) => {
    const [x, z] = spot();
    return g.newShade(`S${i + 1}`, x, z, "wander", 0);
  });
  g.nextShadeNum = BENCH.shades + 1;
  g.motes = Array.from({ length: BENCH.motes }, (_, i) => {
    const [x, z] = spot();
    return { id: `M${i + 1}`, x, y: 0, z, kind: "random" as const, ttl: null, pickableFrom: 0 };
  });
  g.nextMoteNum = BENCH.motes + 1;
  for (const l of g.lanterns) {
    if ((BENCH.litLanterns as readonly string[]).includes(l.id)) { l.lit = true; l.everLit = true; l.fuelU = g.fuelMaxU; l.deposited = g.t.lantern_cost; }
  }
  return g;
}

/** Camera orbit: centre (0,0,0), radius 30 m, Y 15, starts at angle 0 = (30,15,0), counter-clockwise seen from above
 *  (+X toward +Z, the same angle convention as the standard maps), one turn per 15 s. */
export function benchCamera(tS: number): [number, number, number] {
  const a = (2 * Math.PI * tS) / BENCH.orbitPeriodS;
  return [BENCH.orbitRadius * Math.cos(a), BENCH.orbitHeight, BENCH.orbitRadius * Math.sin(a)];
}

export interface BenchStats { frames: number; avg_fps: number; p1_low_fps: number; frame_ms_p95: number }

/** Ticket-04 definitions over the frame times dt_i (ms) of the measured window. */
export function benchStats(dts: number[]): BenchStats {
  const N = dts.length;
  if (N === 0) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k);
  const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)]; // nearest-rank 95th percentile
  const r = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    frames: N,
    avg_fps: r((1000 * N) / sum),
    p1_low_fps: r(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
    frame_ms_p95: r(p95, 2),
  };
}
