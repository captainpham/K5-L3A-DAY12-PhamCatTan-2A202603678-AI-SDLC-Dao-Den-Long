// Test Contract v1.1 I/O: scenario + inputs parsing (strict) and JSONL serialization.
import { Game, byId, idNum } from "./game";
import { STD } from "./tuning";
import { NEUTRAL_INPUT, type InputState, type ShadeState, type DrifterState } from "./types";

/** Thrown for malformed inputs/scenario files -> exit code 2. */
export class ContractFormatError extends Error {}

function fail(msg: string): never {
  throw new ContractFormatError(msg);
}
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNonNegInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function vec3(v: unknown, where: string): [number, number, number] {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(`${where}: expected [x, y, z] numbers`);
  return v as [number, number, number];
}
function optInt(o: Record<string, unknown>, key: string, where: string): number | undefined {
  if (o[key] === undefined) return undefined;
  if (!isNonNegInt(o[key])) fail(`${where}.${key}: non-negative integer`);
  return o[key] as number;
}
function optBool(o: Record<string, unknown>, key: string, where: string): boolean | undefined {
  if (o[key] === undefined) return undefined;
  if (typeof o[key] !== "boolean") fail(`${where}.${key}: boolean`);
  return o[key] as boolean;
}

const SHADE_STATES: ShadeState[] = ["spawning", "wander", "chase", "recoil", "stunned"];
const DRIFTER_STATES: DrifterState[] = ["idle", "chase", "flee"];

// ------------------------------------------------------------------ scenario
export function applyScenario(game: Game, raw: unknown): void {
  if (!isObj(raw)) fail("scenario: root must be an object");
  const sc = raw;

  if (sc.player !== undefined) {
    if (!isObj(sc.player)) fail("scenario.player: must be an object");
    const pl = sc.player, p = game.player;
    if (pl.pos !== undefined) {
      const [x, y, z] = vec3(pl.pos, "scenario.player.pos");
      p.x = x; p.y = y; p.z = z;
      const g = game.map.ground(x, z);
      p.grounded = g !== null && Math.abs(y - g) < 1e-6;
    }
    const carried = optInt(pl, "carried", "scenario.player"); if (carried !== undefined) p.carried = carried;
    const flames = optInt(pl, "flames", "scenario.player"); if (flames !== undefined) p.flames = flames;
    const inv = optInt(pl, "invuln_ticks", "scenario.player"); if (inv !== undefined) p.invulnTicks = inv;
    const dcd = optInt(pl, "dash_cd_ticks", "scenario.player"); if (dcd !== undefined) p.dashCdTicks = dcd;
    const pcd = optInt(pl, "pulse_cd_ticks", "scenario.player"); if (pcd !== undefined) p.pulseCdTicks = pcd;
    const ch = optInt(pl, "charm_ticks", "scenario.player"); if (ch !== undefined) p.charmTicks = ch;
  }

  const rm = optBool(sc, "random_motes", "scenario"); if (rm !== undefined) game.randomMotes = rm;
  const rs = optBool(sc, "random_shades", "scenario"); if (rs !== undefined) game.randomShades = rs;
  const rd = optBool(sc, "random_drifters", "scenario"); if (rd !== undefined) game.randomDrifters = rd;
  const we = optBool(sc, "wind_enabled", "scenario"); if (we !== undefined) game.windEnabled = we;

  // motes: explicit list replaces the initial ones; random_motes:false with no list means none.
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) fail("scenario.motes: array");
    game.motes = [];
    game.nextMoteNum = 1;
    sc.motes.forEach((m, i) => {
      const pos = isObj(m) ? m.pos : m;
      const [x, y, z] = vec3(pos, `scenario.motes[${i}]`);
      const id = isObj(m) && typeof m.id === "string" ? m.id : `M${game.nextMoteNum}`;
      game.nextMoteNum++;
      game.motes.push({ id, x, y, z, kind: "random", ttl: null, pickableFrom: 0 });
    });
  } else if (game.randomMotes === false) {
    game.motes = [];
  }

  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) fail("scenario.shades: array");
    const list = sc.shades;
    let maxNum = 0;
    list.forEach((s, i) => {
      if (!isObj(s)) fail(`scenario.shades[${i}]: object`);
      if (s.id !== undefined && typeof s.id !== "string") fail(`scenario.shades[${i}].id: string`);
      if (s.state !== undefined && !SHADE_STATES.includes(s.state as ShadeState)) fail(`scenario.shades[${i}].state: one of ${SHADE_STATES.join("/")}`);
      if (typeof s.id === "string" && /^S\d+$/.test(s.id)) maxNum = Math.max(maxNum, idNum(s.id));
    });
    game.shades = [];
    const used = new Set<string>();
    let auto = maxNum + 1;
    list.forEach((s, i) => {
      const o = s as Record<string, unknown>;
      const [x, y, z] = vec3(o.pos, `scenario.shades[${i}].pos`);
      let id = typeof o.id === "string" ? o.id : "";
      if (!id || used.has(id)) { while (used.has(`S${auto}`)) auto++; id = `S${auto++}`; }
      used.add(id);
      const state = (o.state as ShadeState | undefined) ?? "wander"; // listed shades are active immediately
      const left = optInt(o, "state_ticks_left", `scenario.shades[${i}]`);
      const def = state === "stunned" ? 120 : state === "recoil" ? STD.recoilTicks : state === "spawning" ? STD.shadeSpawningTicks : 0;
      const sh = game.newShade(id, x, z, state, left ?? def);
      // a listed y is taken as the shade centre when it is above ground level
      const g = game.map.ground(x, z);
      if (g === null) sh.y = y > 0 ? y : STD.shadeCenterY;
      if (state === "stunned") sh.pushTicks = 0;
      game.shades.push(sh);
    });
    game.shades.sort(byId);
    game.nextShadeNum = Math.max(auto, maxNum + 1);
  } else if (game.randomShades === false) {
    game.shades = [];
  }

  if (sc.drifters !== undefined) {
    if (!Array.isArray(sc.drifters)) fail("scenario.drifters: array");
    game.drifters = [];
    let maxNum = 0;
    sc.drifters.forEach((d, i) => {
      if (!isObj(d)) fail(`scenario.drifters[${i}]: object`);
      if (d.id !== undefined && typeof d.id !== "string") fail(`scenario.drifters[${i}].id: string`);
      if (d.state !== undefined && !DRIFTER_STATES.includes(d.state as DrifterState)) fail(`scenario.drifters[${i}].state: idle/chase/flee`);
      const [x, , z] = vec3(d.pos, `scenario.drifters[${i}].pos`);
      const id = typeof d.id === "string" ? d.id : `D${i + 1}`;
      maxNum = Math.max(maxNum, idNum(id) === Number.MAX_SAFE_INTEGER ? 0 : idNum(id));
      const dr = game.newDrifter(id, x, z);
      dr.state = (d.state as DrifterState | undefined) ?? "idle";
      dr.stolen = optInt(d, "stolen", `scenario.drifters[${i}]`) ?? 0;
      dr.fleeTicks = dr.state === "flee" ? STD.drifterFleeTicks : 0;
      game.drifters.push(dr);
    });
    game.drifters.sort(byId);
    game.nextDrifterNum = maxNum + 1;
  }

  if (sc.charms !== undefined) {
    if (!Array.isArray(sc.charms)) fail("scenario.charms: array");
    game.charms = sc.charms.map((c, i) => {
      if (!isObj(c)) fail(`scenario.charms[${i}]: object`);
      const def = game.map.charms.find((m) => m.id === c.id);
      const pos = c.pos !== undefined ? vec3(c.pos, `scenario.charms[${i}].pos`) : def?.pos;
      if (!pos) fail(`scenario.charms[${i}].pos: required for unknown charm id`);
      const available = optBool(c, "available", `scenario.charms[${i}]`) ?? true;
      const respawn = optInt(c, "respawn_ticks", `scenario.charms[${i}]`) ?? (available ? 0 : STD.charmRespawnTicks);
      return { id: typeof c.id === "string" ? c.id : `C${i + 1}`, x: pos[0], y: pos[1], z: pos[2], available, respawnTicks: respawn };
    });
  }

  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) fail("scenario.lanterns: array");
    sc.lanterns.forEach((l, i) => {
      if (!isObj(l) || typeof l.id !== "string") fail(`scenario.lanterns[${i}]: object with string id`);
      const lan = game.lanterns.find((x) => x.id === l.id);
      if (!lan) return; // unknown id: ignored
      if (l.pos !== undefined) { const [x, y, z] = vec3(l.pos, `scenario.lanterns[${i}].pos`); lan.x = x; lan.y = y; lan.z = z; }
      const dep = optInt(l, "deposited", `scenario.lanterns[${i}]`); if (dep !== undefined) lan.deposited = dep;
      const lit = optBool(l, "lit", `scenario.lanterns[${i}]`); if (lit !== undefined) lan.lit = lit;
    });
  }

  if (sc.time_left_s !== undefined) {
    if (!isNum(sc.time_left_s) || sc.time_left_s < 0) fail("scenario.time_left_s: non-negative number");
    game.timeLeftTicks = Math.round(sc.time_left_s * 60);
  }
}

// ------------------------------------------------------------------ inputs
export type InputTimeline = (tick: number) => InputState;
const BUTTONS = ["jump", "interact", "pulse", "dash", "pause"] as const;

export function parseInputs(raw: unknown): InputTimeline {
  if (!isObj(raw) || !Array.isArray(raw.frames)) fail("inputs: expected { frames: [...] }");
  const frames = raw.frames as unknown[];
  const byTick = new Map<number, Record<string, unknown>>();
  let last = -1;
  frames.forEach((f, i) => {
    if (!isObj(f)) fail(`inputs.frames[${i}]: object`);
    if (!isNonNegInt(f.tick)) fail(`inputs.frames[${i}].tick: non-negative integer`);
    if (f.tick <= last) fail(`inputs.frames[${i}].tick: must strictly increase`);
    last = f.tick;
    if (f.move !== undefined && (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum)))
      fail(`inputs.frames[${i}].move: [x, z] numbers`);
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) fail(`inputs.frames[${i}].cam_yaw_deg: number`);
    for (const b of BUTTONS) if (f[b] !== undefined && typeof f[b] !== "boolean") fail(`inputs.frames[${i}].${b}: boolean`);
    byTick.set(f.tick, f);
  });

  // Sticky state: each frame only changes the fields it contains.
  let cur: InputState = { ...NEUTRAL_INPUT, move: [0, 0] };
  let lastTick = -1;
  return (tick: number) => {
    for (let k = lastTick + 1; k <= tick; k++) {
      const fr = byTick.get(k);
      if (!fr) continue;
      const next: InputState = { ...cur, move: [cur.move[0], cur.move[1]] };
      if (fr.move !== undefined) next.move = [(fr.move as number[])[0], (fr.move as number[])[1]];
      if (fr.cam_yaw_deg !== undefined) next.camYawDeg = fr.cam_yaw_deg as number;
      for (const b of BUTTONS) if (fr[b] !== undefined) next[b] = fr[b] as boolean;
      cur = next;
    }
    lastTick = Math.max(lastTick, tick);
    return cur;
  };
}

// ------------------------------------------------------------------ output
export const r3 = (v: number): number => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const sec = (ticks: number) => r3(ticks / 60);

export function snapshot(game: Game): Record<string, unknown> {
  const p = game.player;
  return {
    type: "snapshot",
    tick: game.tick,
    sim_tick: game.simTick,
    night: game.night,
    state: game.state,
    time_left_s: r3(game.timeLeftS),
    score: game.score,
    wind: { active: game.windActiveTicks > 0, dir_deg: game.windDirDeg },
    player: {
      pos: [r3(p.x), r3(p.y), r3(p.z)],
      vel: [r3(p.vx), r3(p.vy), r3(p.vz)],
      grounded: p.grounded,
      invuln: p.invulnTicks > 0,
      flames: p.flames,
      carried: p.carried,
      dash_cd_s: sec(p.dashCdTicks),
      pulse_cd_s: sec(p.pulseCdTicks),
      charm_s: sec(p.charmTicks),
    },
    lanterns: game.lanterns.map((l) => ({ id: l.id, pos: [r3(l.x), r3(l.y), r3(l.z)], lit: l.lit, deposited: l.deposited })),
    shades: game.shades.map((s) => ({ id: s.id, pos: [r3(s.x), r3(s.y), r3(s.z)], state: s.state })),
    motes_active: game.motes.length,
    motes: game.motes.map((m) => ({ id: m.id, pos: [r3(m.x), r3(m.y), r3(m.z)], kind: m.kind, ttl_s: m.ttl === null ? null : sec(m.ttl) })),
    drifters: game.drifters.map((d) => ({ id: d.id, pos: [r3(d.x), r3(d.y), r3(d.z)], state: d.state, stolen: d.stolen })),
    charms: game.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: sec(c.respawnTicks) })),
  };
}

export interface RunOptions {
  seed: number;
  ticks: number;
  night?: 1 | 2 | 3;
  snapshotEvery?: number;
  scenario?: unknown;
  inputs?: unknown;
}

/** Runs a full headless session and returns the JSONL lines (without trailing newline). */
export function runHeadless(opts: RunOptions): string[] {
  const game = new Game({ seed: opts.seed, night: opts.night ?? 1 });
  if (opts.scenario !== undefined) applyScenario(game, opts.scenario);
  const timeline = opts.inputs !== undefined ? parseInputs(opts.inputs) : () => NEUTRAL_INPUT;
  const every = opts.snapshotEvery ?? 10;
  const out: string[] = [JSON.stringify(snapshot(game))];
  out.push(JSON.stringify({ type: "event", tick: 0, name: "night_start", data: { night: game.night } }));

  for (let k = 0; k < opts.ticks && (game.state === "playing" || game.state === "paused"); k++) {
    game.step(timeline(k));
    for (const e of game.events) out.push(JSON.stringify({ type: "event", tick: e.tick, name: e.event.name, data: e.event.data }));
    if (game.tick % every === 0) out.push(JSON.stringify(snapshot(game)));
  }
  out.push(JSON.stringify({ type: "end", ticks: game.tick, state: game.state, score: game.score }));
  return out;
}
