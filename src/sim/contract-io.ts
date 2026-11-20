// Test Contract v1.0 I/O: scenario + inputs parsing (strict) and JSONL serialization.
import { Game } from "./game";
import { TICK_RATE, WORLD } from "./tuning";
import { NEUTRAL_INPUT, type InputState } from "./types";

/** Thrown for malformed inputs/scenario files -> exit code 2. */
export class ContractFormatError extends Error {}

function fail(msg: string): never {
  throw new ContractFormatError(msg);
}
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function vec3(v: unknown, where: string): [number, number, number] {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(`${where}: expected [x, y, z] numbers`);
  return v as [number, number, number];
}

// ------------------------------------------------------------------ scenario
export function applyScenario(game: Game, raw: unknown): void {
  if (!isObj(raw)) fail("scenario: root must be an object");
  const sc = raw as Record<string, unknown>;

  if (sc.player !== undefined) {
    if (!isObj(sc.player)) fail("scenario.player: must be an object");
    const pl = sc.player as Record<string, unknown>;
    if (pl.pos !== undefined) {
      const [x, y, z] = vec3(pl.pos, "scenario.player.pos");
      game.player.x = x; game.player.y = y; game.player.z = z;
      game.player.grounded = y <= 0;
      if (y < 0) game.player.y = 0;
    }
    if (pl.carried !== undefined) {
      if (!Number.isInteger(pl.carried) || (pl.carried as number) < 0) fail("scenario.player.carried: non-negative integer");
      game.player.carried = pl.carried as number;
    }
    if (pl.flames !== undefined) {
      if (!Number.isInteger(pl.flames) || (pl.flames as number) < 0) fail("scenario.player.flames: non-negative integer");
      game.player.flames = pl.flames as number;
    }
  }

  for (const key of ["random_motes", "random_shades"] as const) {
    if (sc[key] !== undefined && typeof sc[key] !== "boolean") fail(`scenario.${key}: boolean`);
  }
  if (sc.random_motes !== undefined) game.randomMotes = sc.random_motes as boolean;
  if (sc.random_shades !== undefined) game.randomShades = sc.random_shades as boolean;

  // motes: explicit list replaces the initial ones; random_motes:false with no list means none.
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) fail("scenario.motes: array");
    game.motes = [];
    game.nextMoteNum = 1;
    (sc.motes as unknown[]).forEach((m, i) => {
      const pos = isObj(m) ? m.pos : m;
      const [x, , z] = vec3(pos, `scenario.motes[${i}]`);
      const id = isObj(m) && typeof m.id === "string" ? m.id : `M${game.nextMoteNum}`;
      game.nextMoteNum++;
      game.motes.push({ id, x, z });
    });
  } else if (game.randomMotes === false) {
    game.motes = [];
  }

  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) fail("scenario.shades: array");
    game.shades = [];
    const used = new Set<string>();
    let maxNum = 0;
    const list = sc.shades as unknown[];
    list.forEach((s, i) => {
      if (!isObj(s)) fail(`scenario.shades[${i}]: object`);
      if (s.id !== undefined && typeof s.id !== "string") fail(`scenario.shades[${i}].id: string`);
      const m = typeof s.id === "string" ? /^S(\d+)$/.exec(s.id) : null;
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    });
    let auto = maxNum + 1;
    list.forEach((s, i) => {
      const o = s as Record<string, unknown>;
      const [x, , z] = vec3(o.pos, `scenario.shades[${i}].pos`);
      let id = typeof o.id === "string" ? o.id : "";
      if (!id || used.has(id)) { while (used.has(`S${auto}`)) auto++; id = `S${auto++}`; }
      used.add(id);
      game.shades.push({ id, x, z, stunTicks: 0 });
    });
    game.nextShadeNum = Math.max(auto, maxNum + 1);
  } else if (game.randomShades === false) {
    game.shades = [];
  }

  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) fail("scenario.lanterns: array");
    (sc.lanterns as unknown[]).forEach((l, i) => {
      if (!isObj(l) || typeof l.id !== "string") fail(`scenario.lanterns[${i}]: object with string id`);
      const o = l as Record<string, unknown>;
      const lan = game.lanterns.find((x) => x.id === o.id);
      if (!lan) return; // unknown id: ignored (only L1..L5 exist on Night 1)
      if (o.pos !== undefined) { const [x, , z] = vec3(o.pos, `scenario.lanterns[${i}].pos`); lan.x = x; lan.z = z; }
      if (o.deposited !== undefined) {
        if (!Number.isInteger(o.deposited) || (o.deposited as number) < 0) fail(`scenario.lanterns[${i}].deposited: non-negative integer`);
        lan.deposited = o.deposited as number;
      }
      if (o.lit !== undefined) {
        if (typeof o.lit !== "boolean") fail(`scenario.lanterns[${i}].lit: boolean`);
        lan.lit = o.lit;
      }
    });
  }

  if (sc.time_left_s !== undefined) {
    if (!isNum(sc.time_left_s) || sc.time_left_s < 0) fail("scenario.time_left_s: non-negative number");
    game.timeLeftTicks = Math.round((sc.time_left_s as number) * TICK_RATE);
  }

  // Shades listed inside a lit lantern's light are pushed out (no events, no score).
  for (const s of game.shades) game.keepOutOfLight(s);
}

// ------------------------------------------------------------------ inputs
export type InputTimeline = (tick: number) => InputState;

export function parseInputs(raw: unknown): InputTimeline {
  if (!isObj(raw) || !Array.isArray(raw.frames)) fail("inputs: expected { frames: [...] }");
  const frames = (raw as { frames: unknown[] }).frames;
  const byTick = new Map<number, Record<string, unknown>>();
  let last = -1;
  frames.forEach((f, i) => {
    if (!isObj(f)) fail(`inputs.frames[${i}]: object`);
    const fr = f as Record<string, unknown>;
    if (!Number.isInteger(fr.tick) || (fr.tick as number) < 0) fail(`inputs.frames[${i}].tick: non-negative integer`);
    if ((fr.tick as number) <= last) fail(`inputs.frames[${i}].tick: must strictly increase`);
    last = fr.tick as number;
    if (fr.move !== undefined && (!Array.isArray(fr.move) || fr.move.length !== 2 || !fr.move.every(isNum)))
      fail(`inputs.frames[${i}].move: [x, z] numbers`);
    if (fr.cam_yaw_deg !== undefined && !isNum(fr.cam_yaw_deg)) fail(`inputs.frames[${i}].cam_yaw_deg: number`);
    for (const b of ["jump", "interact", "pulse", "dash"]) {
      if (fr[b] !== undefined && typeof fr[b] !== "boolean") fail(`inputs.frames[${i}].${b}: boolean`);
    }
    byTick.set(fr.tick as number, fr);
  });

  // Sticky state: each frame only changes the fields it contains.
  let cur: InputState = { ...NEUTRAL_INPUT, move: [0, 0] };
  let lastTick = -1;
  return (tick: number) => {
    if (tick <= lastTick) fail("inputs: timeline must be read in increasing tick order");
    for (let k = lastTick + 1; k <= tick; k++) {
      const fr = byTick.get(k);
      if (!fr) continue;
      cur = {
        move: fr.move !== undefined ? [(fr.move as number[])[0], (fr.move as number[])[1]] : cur.move,
        camYawDeg: fr.cam_yaw_deg !== undefined ? (fr.cam_yaw_deg as number) : cur.camYawDeg,
        jump: fr.jump !== undefined ? (fr.jump as boolean) : cur.jump,
        interact: fr.interact !== undefined ? (fr.interact as boolean) : cur.interact,
        pulse: fr.pulse !== undefined ? (fr.pulse as boolean) : cur.pulse,
        dash: fr.dash !== undefined ? (fr.dash as boolean) : cur.dash,
      };
    }
    lastTick = tick;
    return cur;
  };
}

// ------------------------------------------------------------------ output
export const r3 = (v: number): number => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};

export function snapshot(game: Game): Record<string, unknown> {
  const p = game.player;
  return {
    type: "snapshot",
    tick: game.tick,
    sim_tick: game.tick,
    state: game.state,
    time_left_s: r3(game.timeLeftS),
    score: game.score,
    player: { pos: [r3(p.x), r3(p.y), r3(p.z)], flames: p.flames, carried: p.carried },
    lanterns: game.lanterns.map((l) => ({ id: l.id, pos: [r3(l.x), 0, r3(l.z)], lit: l.lit, deposited: l.deposited })),
    shades: game.shades.map((s) => ({ id: s.id, pos: [r3(s.x), WORLD.shadeHoverY, r3(s.z)], state: game.shadeState(s) })),
    motes_active: game.motes.length,
    motes: game.motes.map((m) => ({ id: m.id, pos: [r3(m.x), 0, r3(m.z)] })),
  };
}

export interface RunOptions {
  seed: number;
  ticks: number;
  snapshotEvery?: number;
  scenario?: unknown;
  inputs?: unknown;
}

/** Runs a full headless session and returns the JSONL lines (without trailing newline). */
export function runHeadless(opts: RunOptions): string[] {
  const game = new Game({ seed: opts.seed });
  if (opts.scenario !== undefined) applyScenario(game, opts.scenario);
  const timeline = opts.inputs !== undefined ? parseInputs(opts.inputs) : () => NEUTRAL_INPUT;
  const every = opts.snapshotEvery ?? 10;
  const out: string[] = [JSON.stringify(snapshot(game))];

  for (let k = 0; k < opts.ticks && game.state === "playing"; k++) {
    game.step(timeline(k));
    for (const e of game.events) out.push(JSON.stringify({ type: "event", tick: e.tick, name: e.event.name, data: e.event.data }));
    if (game.tick % every === 0) out.push(JSON.stringify(snapshot(game)));
  }
  out.push(JSON.stringify({ type: "end", ticks: game.tick, state: game.state, score: game.score }));
  return out;
}
