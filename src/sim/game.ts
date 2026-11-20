// Pure game logic (Ticket-02 / Test Contract v1.1). No DOM, no Three.js, no Math.random:
// runs identically in the browser and in headless mode.
// Tick order (mandatory, Ticket-02):
//   1 input (pause first)  2 timers  3 Mây move (jump, dash, pads, wind) + fall check  4 pickup motes/charms
//   5 lantern interact  6 safe zones  7 pulse  8 shades + drifters move  9 touch (drifters steal, then shade hit by id)
//   10 spawns  11 win/lose  (12 snapshot: done by the runner)
import { makeRng } from "./rng";
import { MAPS, type NightMap } from "./maps";
import { DT, STD, TUNING, nightDurationS, type Tuning } from "./tuning";
import type { Charm, Drifter, GameEvent, GameState, InputState, Lantern, Mote, Player, Shade, TickEvent } from "./types";

const secToTicks = (s: number) => Math.round(s * 60);
const distXZ = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
export const idNum = (id: string) => { const m = /(\d+)$/.exec(id); return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER; };
export const byId = (a: { id: string }, b: { id: string }) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** fuel units (1/60) -> fuel with 1 decimal for output */
export const fuel1 = (u: number) => Math.round((Math.max(0, u) / 60) * 10) / 10;

export interface GameOptions {
  seed: number; night?: 1 | 2 | 3; tuning?: Tuning;
  /** creative explore map (windowed game only). The headless runner never sets it -> always the standard map. */
  map?: NightMap;
}

export class Game {
  readonly t: Tuning;
  readonly map: NightMap;
  readonly night: 1 | 2 | 3;
  readonly rng: () => number;

  tick = 0; // all steps, including paused ones
  simTick = 0; // gameplay steps only
  state: GameState = "playing";
  paused = false;
  endReason: "dawn_survived" | "dawn" | "no_flames" | null = null;
  score = 0;
  timeLeftTicks: number;

  player: Player;
  lanterns: Lantern[];
  shades: Shade[] = [];
  motes: Mote[] = [];
  drifters: Drifter[] = [];
  charms: Charm[];

  randomMotes = true;
  randomShades = true;
  randomDrifters: boolean;
  windEnabled: boolean;
  windActiveTicks = 0;
  windDirDeg = 0;

  /** Ticket-03: successful lights this night (relights count, scenario pre-lit lanterns do not) */
  successfulLights = 0;

  nextMoteNum = 1;
  nextShadeNum = 1;
  nextDrifterNum = 1;

  /** Creative extra (windowed game only): solid props such as trees that block Mây.
   *  Headless never sets it, so the contract output is unchanged. */
  extraSolids: { x: number; z: number; r: number }[] = [];

  events: TickEvent[] = [];
  private prev: InputState = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };

  constructor(opts: GameOptions) {
    this.t = opts.tuning ?? TUNING;
    this.night = opts.night ?? 1;
    this.map = opts.map ?? MAPS[this.night];
    this.rng = makeRng(opts.seed);
    this.timeLeftTicks = secToTicks(nightDurationS(this.night));
    this.randomDrifters = this.map.drifters;
    this.windEnabled = this.map.wind;
    const [sx, sy, sz] = this.map.start;
    this.player = {
      x: sx, y: sy, z: sz, vx: 0, vy: 0, vz: 0, grounded: true, faceX: 0, faceZ: 1,
      flames: this.t.flames, carried: 0, invulnTicks: 0, dashCdTicks: 0, dashTicksLeft: 0, dashDirX: 0, dashDirZ: 1,
      pulseCdTicks: 0, charmTicks: 0, launched: false, launchVx: 0, launchVz: 0, fallWaitTicks: 0,
    };
    this.lanterns = this.map.lanterns.map((l) => ({ id: l.id, x: l.pos[0], y: l.pos[1], z: l.pos[2], lit: false, deposited: 0, fuelU: 0, everLit: false, relitCount: 0 }));
    this.charms = this.map.charms.map((c) => ({ id: c.id, x: c.pos[0], y: c.pos[1], z: c.pos[2], available: true, respawnTicks: 0 }));
    // 20 fireflies at 20 different spawn points
    for (let i = 0; i < STD.moteInitial; i++) this.spawnRandomMote();
  }

  // ------------------------------------------------------------------ helpers
  private emit(event: GameEvent): void { this.events.push({ tick: this.tick, event }); }
  private pick<T>(list: T[]): T { return list[Math.floor(this.rng() * list.length)]; }
  get shadeSpeed(): number { return this.night === 3 ? this.map.shadeSpeed : this.t.shade_speed; }
  /** carrying capacity = 10 + 2 x successful lights, max 20 (Ticket-03) */
  get capacity(): number { return Math.min(this.t.capacity_max, this.t.carry_capacity + STD.capacityPerLight * this.successfulLights); }
  get fuelMaxU(): number { return this.t.fuel_max * 60; }
  get lowFuelU(): number { return this.t.low_fuel_threshold * 60; }
  /** lit lanterns with fuel >= 30 keep a safe zone; exactly 30 still counts */
  hasSafeZone(l: Lantern): boolean { return l.lit && l.fuelU >= this.lowFuelU; }
  get timeLeftS(): number { return this.timeLeftTicks / 60; }
  get playerActive(): boolean { return this.player.fallWaitTicks === 0; }
  get windWarning(): boolean { // render-only: gust coming within 2 s
    if (!this.windEnabled || this.windActiveTicks > 0) return false;
    const next = STD.windEveryTicks - (this.simTick % STD.windEveryTicks);
    return next <= STD.windWarnTicks;
  }

  private spawnRandomMote(): void {
    const free = this.map.moteSpawns.filter(([x, , z]) => !this.motes.some((m) => m.kind === "random" && distXZ(m.x, m.z, x, z) < 0.01));
    if (free.length === 0) return; // no empty point: skip
    const [x, y, z] = this.pick(free);
    this.motes.push({ id: `M${this.nextMoteNum++}`, x, y, z, kind: "random", ttl: null, pickableFrom: 0 });
  }

  addDropped(x: number, z: number, fallbackY: number): void {
    const g = this.map.ground(x, z);
    this.motes.push({ id: `M${this.nextMoteNum++}`, x, y: g ?? fallbackY, z, kind: "dropped", ttl: STD.dropTtl, pickableFrom: this.simTick + 1 });
  }

  newShade(id: string, x: number, z: number, state: Shade["state"], stateTicks: number): Shade {
    const g = this.map.ground(x, z) ?? 0;
    return { id, x, y: g + STD.shadeCenterY, z, state, stateTicks, pushTicks: 0, pushX: 1, pushZ: 0, recoilX: 1, recoilZ: 0,
      wanderX: 1, wanderZ: 0, wanderTicks: 0, expelTicks: 0, expelLx: 0, expelLz: 0, targetLanternId: null, drainTicks: 0 };
  }

  newDrifter(id: string, x: number, z: number): Drifter {
    const g = this.map.ground(x, z) ?? 0;
    return { id, x, y: g + STD.drifterHoverY, z, state: "idle", stolen: 0, fleeTicks: 0, anchorX: x, anchorZ: z, angle: 0 };
  }

  /** Is (x,z) a place a ground-bound shade at feet height `feetY` can move to? */
  private shadeCanStand(x: number, z: number, feetY: number): boolean {
    const g = this.map.ground(x, z);
    return g !== null && Math.abs(g - feetY) <= STD.stepUp && !this.map.solid(x, z, feetY);
  }

  /** Lit lanterns block shades at the edge of safe_radius. */
  private clampOutOfLight(s: Shade): void {
    const r = this.t.safe_radius;
    for (const l of this.lanterns) {
      if (!this.hasSafeZone(l)) continue; // fuel < 30: no safe zone (Ticket-03)
      const d = distXZ(s.x, s.z, l.x, l.z);
      if (d < r) {
        const ux = d > 1e-9 ? (s.x - l.x) / d : 1, uz = d > 1e-9 ? (s.z - l.z) / d : 0;
        s.x = l.x + ux * r; s.z = l.z + uz * r;
      }
    }
  }

  private moveShade(s: Shade, dx: number, dz: number): boolean {
    const nx = s.x + dx, nz = s.z + dz, feet = s.y - STD.shadeCenterY;
    if (!this.shadeCanStand(nx, nz, feet)) return false;
    s.x = nx; s.z = nz;
    s.y = (this.map.ground(nx, nz) ?? feet) + STD.shadeCenterY;
    return true;
  }

  // ------------------------------------------------------------------ main step
  step(input: InputState): void {
    this.events = [];
    if (this.state === "won" || this.state === "lost") return;
    this.tick += 1;
    const prev = this.prev;
    this.prev = { ...input, move: [input.move[0], input.move[1]] };
    const rise = (k: "jump" | "interact" | "pulse" | "dash" | "pause") => input[k] && !prev[k];

    // 1. input: pause first
    if (rise("pause")) {
      if (!this.paused) { this.paused = true; this.state = "paused"; this.emit({ name: "paused", data: {} }); return; }
      this.paused = false; this.state = "playing"; this.emit({ name: "resumed", data: {} });
    } else if (this.paused) return;

    this.simTick += 1;
    const t = this.t, p = this.player;

    // 2. timers
    this.timeLeftTicks = Math.max(0, this.timeLeftTicks - 1);
    if (p.pulseCdTicks > 0) p.pulseCdTicks--;
    if (p.dashCdTicks > 0) p.dashCdTicks--;
    if (p.invulnTicks > 0) p.invulnTicks--;
    if (p.charmTicks > 0) p.charmTicks--;
    for (const s of this.shades) {
      if (s.expelTicks > 0) s.expelTicks--;
      if ((s.state === "stunned" || s.state === "recoil" || s.state === "spawning") && s.stateTicks > 0) {
        s.stateTicks--;
        if (s.stateTicks === 0) { s.state = "wander"; s.wanderTicks = 0; }
      }
    }
    for (const m of this.motes) if (m.ttl !== null) m.ttl--;
    this.motes = this.motes.filter((m) => m.ttl === null || m.ttl > 0);
    for (const c of this.charms) if (!c.available && --c.respawnTicks <= 0) { c.available = true; c.respawnTicks = 0; }
    for (const d of this.drifters) if (d.state === "flee" && --d.fleeTicks <= 0) d.state = "removed";
    this.drifters = this.drifters.filter((d) => d.state !== "removed");
    if (this.windActiveTicks > 0) this.windActiveTicks--;
    if (this.windEnabled && this.simTick % STD.windEveryTicks === 0) {
      this.windActiveTicks = STD.windTicks;
      this.windDirDeg = Math.floor(this.rng() * 360);
    }
    // lantern fuel (Ticket-03): own decay + every draining shade, in integer 1/60 units
    for (const l of this.lanterns) if (l.lit) l.fuelU -= t.fuel_decay_per_s;
    for (const s of [...this.shades].sort(byId)) {
      if (s.state !== "drain") continue;
      const l = this.lanterns.find((x) => x.id === s.targetLanternId);
      if (!l || !l.lit) continue;
      l.fuelU -= t.drain_per_s;
      if (++s.drainTicks % STD.drainEventTicks === 0) {
        this.emit({ name: "fuel_drain", data: { lantern_id: l.id, shade_id: s.id, fuel: fuel1(l.fuelU) } });
      }
    }
    // right after step 2: lanterns out of fuel go dark
    for (const l of this.lanterns) {
      if (l.lit && l.fuelU <= 0) {
        l.lit = false; l.deposited = 0; l.fuelU = 0;
        this.emit({ name: "lantern_out", data: { lantern_id: l.id } });
      }
    }

    // 3. move Mây
    this.movePlayer(input, rise("jump"), rise("dash"));

    // 4. pickup (not while waiting to respawn)
    if (this.playerActive) {
      const keep: Mote[] = [];
      for (const m of this.motes) {
        if (p.carried < this.capacity && this.simTick >= m.pickableFrom &&
            distXZ(p.x, p.z, m.x, m.z) <= t.pickup_radius && Math.abs(p.y - m.y) <= STD.pickupMaxDy) {
          p.carried++;
          this.emit({ name: "mote_picked", data: { carried: p.carried } });
        } else keep.push(m);
      }
      this.motes = keep;
      for (const c of this.charms) {
        if (c.available && distXZ(p.x, p.z, c.x, c.z) <= t.pickup_radius && Math.abs(p.y - c.y) <= STD.pickupMaxDy) {
          c.available = false; c.respawnTicks = STD.charmRespawnTicks;
          p.charmTicks = STD.charmTicks;
          this.emit({ name: "charm_picked", data: { charm_id: c.id, charm_ticks: STD.charmTicks } });
        }
      }
    }

    // 5. lantern interact: light an unlit lantern (10, or 5 if it was ever lit) or refuel a lit, not-full one
    const expelFrom: Lantern[] = [];
    if (rise("interact") && this.playerActive) {
      let best: Lantern | null = null, bestD = Infinity;
      for (const l of [...this.lanterns].sort(byId)) {
        if (Math.abs(p.y - l.y) > STD.interactMaxDy) continue;
        if (l.lit && l.fuelU >= this.fuelMaxU) continue; // full lantern: not selectable
        const d = distXZ(p.x, p.z, l.x, l.z);
        if (d <= t.interact_radius && d < bestD) { best = l; bestD = d; }
      }
      if (best && best.lit) { // refuel
        const perMoteU = t.fuel_per_mote * 60;
        const used = Math.min(p.carried, Math.ceil((this.fuelMaxU - best.fuelU) / perMoteU));
        if (used > 0) {
          const wasLow = best.fuelU < this.lowFuelU;
          best.fuelU = Math.min(this.fuelMaxU, best.fuelU + used * perMoteU);
          p.carried -= used;
          this.score += used * t.score.per_mote;
          this.emit({ name: "refuel", data: { lantern_id: best.id, amount: used, fuel: fuel1(best.fuelU) } });
          if (wasLow && best.fuelU >= this.lowFuelU) expelFrom.push(best);
        }
      } else if (best) { // light / relight
        const cost = best.everLit ? t.relight_cost : t.lantern_cost;
        const amount = Math.max(0, Math.min(p.carried, cost - best.deposited));
        if (amount > 0) {
          best.deposited += amount;
          p.carried -= amount;
          this.score += amount * t.score.per_mote;
          this.emit({ name: "deposit", data: { lantern_id: best.id, amount, deposited: best.deposited } });
        }
        if (best.deposited >= cost) {
          const relight = best.everLit;
          best.lit = true; best.everLit = true; best.fuelU = this.fuelMaxU;
          if (relight) best.relitCount++;
          this.successfulLights++;
          this.score += relight ? STD.scoreRelight : t.score.per_lantern;
          this.emit({ name: "lantern_lit", data: { lantern_id: best.id, relight } });
          expelFrom.push(best);
        }
      }
    }

    // 6. safe zones: shades inside a freshly lit (or refuelled to >= 30) lantern are pushed out over <= 30 ticks, harmless meanwhile
    for (const l of expelFrom) {
      for (const s of this.shades) {
        if (distXZ(s.x, s.z, l.x, l.z) < t.safe_radius) { s.expelTicks = STD.expelTicks; s.expelLx = l.x; s.expelLz = l.z; }
      }
    }

    // 7. pulse
    if (rise("pulse") && this.playerActive && p.pulseCdTicks === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.pulseCdTicks = secToTicks(t.pulse_cooldown_s);
      const cy = p.y + STD.pulseCenterY;
      const stunned: string[] = [];
      for (const s of [...this.shades].sort(byId)) {
        if (Math.hypot(s.x - p.x, s.y - cy, s.z - p.z) > t.pulse_radius) continue;
        const d = distXZ(s.x, s.z, p.x, p.z);
        s.pushX = d > 1e-9 ? (s.x - p.x) / d : 1; s.pushZ = d > 1e-9 ? (s.z - p.z) / d : 0;
        this.score += s.state === "drain" ? STD.scoreStunDraining : t.score.per_stun; // +15 total if it was draining
        s.state = "stunned"; s.stateTicks = secToTicks(t.pulse_stun_s); s.pushTicks = STD.pulsePushTicks;
        s.targetLanternId = null; s.drainTicks = 0;
        stunned.push(s.id);
      }
      for (const d of [...this.drifters].sort(byId)) {
        if (Math.hypot(d.x - p.x, d.y - cy, d.z - p.z) > t.pulse_radius) continue;
        if (d.state === "chase") { d.state = "flee"; d.fleeTicks = STD.drifterFleeTicks; }
        else if (d.state === "flee" && d.stolen > 0) {
          const amount = d.stolen;
          for (let i = 0; i < amount; i++) this.addDropped(d.x, d.z, p.y);
          d.stolen = 0; d.fleeTicks = STD.drifterDropFleeTicks;
          this.emit({ name: "drifter_drop", data: { drifter_id: d.id, amount } });
        }
      }
      this.emit({ name: "pulse", data: { stunned_ids: stunned } });
    }

    // 8. shades and drifters move
    this.moveShades();
    this.moveDrifters();

    // 9. touch: drifters steal first, then shade hits (by id, max one flame per tick)
    if (this.playerActive) {
      for (const d of [...this.drifters].sort(byId)) {
        if ((d.state === "idle" || d.state === "chase") && p.carried > 0 && distXZ(d.x, d.z, p.x, p.z) <= STD.drifterTouch) {
          const amount = Math.min(STD.drifterSteal, p.carried);
          p.carried -= amount; d.stolen = amount; d.state = "flee"; d.fleeTicks = STD.drifterFleeTicks;
          this.emit({ name: "drifter_steal", data: { drifter_id: d.id, amount, carried: p.carried } });
        }
      }
      for (const s of [...this.shades].sort(byId)) {
        if (s.state !== "wander" && s.state !== "chase") continue;
        if (s.expelTicks > 0) continue;
        if (distXZ(s.x, s.z, p.x, p.z) > t.shade_hit_radius || Math.abs(p.y - s.y) > STD.hitMaxDy) continue;
        if (p.invulnTicks > 0) continue; // touching an invulnerable Mây does nothing
        p.flames = Math.max(0, p.flames - 1);
        const dropped = Math.floor(p.carried * t.hit_drop_ratio);
        p.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = this.rng() * Math.PI * 2, r = STD.dropRingMin + this.rng() * (STD.dropRingMax - STD.dropRingMin);
          this.addDropped(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, p.y);
        }
        p.invulnTicks = secToTicks(t.invuln_s);
        const d = distXZ(s.x, s.z, p.x, p.z);
        s.recoilX = d > 1e-9 ? (s.x - p.x) / d : 1; s.recoilZ = d > 1e-9 ? (s.z - p.z) / d : 0;
        s.state = "recoil"; s.stateTicks = STD.recoilTicks;
        // recoil starts this tick: 60 steps of 2/60 m (this tick + 59 following ticks)
        this.moveShade(s, (s.recoilX * STD.recoilDist) / STD.recoilTicks, (s.recoilZ * STD.recoilDist) / STD.recoilTicks);
        this.emit({ name: "player_hit", data: { by: "shade", flames: p.flames, dropped } });
        break;
      }
    }

    // 10. spawns (new entities interact from the next tick)
    if (this.randomMotes && this.simTick % STD.moteEveryTicks === 0 && this.motes.length < STD.moteMax) this.spawnRandomMote();
    if (this.randomShades) {
      const n = this.simTick === STD.shadeFirstTick ? STD.shadeFirstCount
        : this.simTick > STD.shadeFirstTick && (this.simTick - STD.shadeFirstTick) % this.map.shadeEveryTicks === 0 ? 1 : 0;
      for (let i = 0; i < n && this.shades.length < this.map.shadeMax; i++) {
        const valid = this.map.shadeSpawns.filter(([x, , z]) => distXZ(x, z, p.x, p.z) >= STD.shadeMinDistToPlayer
          && !this.shades.some((s) => distXZ(s.x, s.z, x, z) < 0.5));
        if (valid.length === 0) break; // no valid point: skip
        const [x, , z] = this.pick(valid);
        const s = this.newShade(`S${this.nextShadeNum++}`, x, z, "spawning", STD.shadeSpawningTicks);
        this.shades.push(s);
        this.emit({ name: "shade_spawned", data: { id: s.id } });
      }
    }
    if (this.randomDrifters && this.simTick % STD.drifterEveryTicks === 0 && this.drifters.length < STD.drifterMax) {
      const [x, , z] = this.pick(this.map.shadeSpawns);
      this.drifters.push(this.newDrifter(`D${this.nextDrifterNum++}`, x, z));
    }

    // 11. win / lose (Ticket-03): no early win; at dawn enough lanterns must still be lit
    if (p.flames <= 0) this.finish("lost", "no_flames");
    else if (this.timeLeftTicks <= 0) {
      const lit = this.lanterns.filter((l) => l.lit);
      if (lit.length >= this.litNeeded) {
        for (const l of lit) this.score += STD.scoreDawnLantern + Math.floor(l.fuelU / 60);
        this.score += p.flames * t.score.per_flame_left;
        this.finish("won", "dawn_survived");
      } else this.finish("lost", "dawn");
    }
  }

  /** lanterns that must be lit at dawn: ceil(win_ratio x total) -> 3/5, 4/6, 5/7 */
  get litNeeded(): number { return Math.ceil(this.t.win_ratio * this.lanterns.length - 1e-9); }

  // ------------------------------------------------------------------ Mây movement
  private canEnter(x: number, z: number, feetY: number): boolean {
    if (this.map.solid(x, z, feetY)) return false;
    for (const s of this.extraSolids) if (Math.hypot(x - s.x, z - s.z) < s.r) return false;
    const g = this.map.ground(x, z);
    return g === null || g <= feetY + STD.stepUp; // cliffs higher than a step block; no ground = walk off (fall)
  }

  private movePlayer(input: InputState, jump: boolean, dash: boolean): void {
    const p = this.player, t = this.t;
    if (p.fallWaitTicks > 0) {
      p.fallWaitTicks--;
      if (p.fallWaitTicks === 0) { // respawn at the start, velocity 0, invulnerable
        [p.x, p.y, p.z] = this.map.start;
        p.vx = p.vy = p.vz = 0; p.grounded = true; p.launched = false; p.dashTicksLeft = 0;
        p.invulnTicks = secToTicks(t.invuln_s);
      }
      return;
    }

    // intent
    let [mx, mz] = input.move;
    mx = Math.max(-1, Math.min(1, mx)); mz = Math.max(-1, Math.min(1, mz));
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (input.camYawDeg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const moving = Math.hypot(wx, wz) > 1e-9;

    // dash: direction = movement direction, or facing when standing still
    const charm = p.charmTicks > 0;
    if (dash && p.dashTicksLeft === 0 && (p.dashCdTicks === 0 || charm)) {
      const l = Math.hypot(wx, wz);
      p.dashDirX = moving ? wx / l : p.faceX; p.dashDirZ = moving ? wz / l : p.faceZ;
      p.dashTicksLeft = secToTicks(t.dash_duration_s);
      p.dashCdTicks = charm ? 0 : secToTicks(t.dash_cooldown_s);
      p.vy = 0;
      this.emit({ name: "dash", data: {} });
    }
    if (moving) { const l = Math.hypot(wx, wz); p.faceX = wx / l; p.faceZ = wz / l; }

    const dashing = p.dashTicksLeft > 0;
    let hx: number, hz: number;
    if (dashing) { hx = p.dashDirX * t.dash_speed; hz = p.dashDirZ * t.dash_speed; p.dashTicksLeft--; }
    else if (p.launched) { hx = p.launchVx; hz = p.launchVz; }
    else { const sp = charm ? STD.charmSpeed : t.player_speed; hx = wx * sp; hz = wz * sp; }
    if (this.windActiveTicks > 0) {
      const a = (this.windDirDeg * Math.PI) / 180;
      hx += Math.cos(a) * STD.windSpeed; hz += Math.sin(a) * STD.windSpeed;
    }
    p.vx = hx; p.vz = hz;

    // horizontal move with cliff / tower collision (slide along one axis if blocked)
    const dx = hx * DT, dz = hz * DT;
    if (this.canEnter(p.x + dx, p.z + dz, p.y)) { p.x += dx; p.z += dz; }
    else if (this.canEnter(p.x + dx, p.z, p.y)) p.x += dx;
    else if (this.canEnter(p.x, p.z + dz, p.y)) p.z += dz;

    // vertical
    if (p.grounded) {
      const g = this.map.ground(p.x, p.z);
      if (g === null || g < p.y - STD.stepUp) { p.grounded = false; p.vy = 0; }
      else p.y = g; // follow ramps
    }
    if (jump && p.grounded && !dashing) { p.vy = STD.jumpSpeed; p.grounded = false; }
    if (!p.grounded) {
      const prevY = p.y;
      if (!dashing) p.vy -= STD.gravity * DT; else p.vy = 0; // air dash keeps altitude
      p.y += p.vy * DT;
      const g = this.map.ground(p.x, p.z);
      if (g !== null && p.y <= g && prevY >= g - STD.stepUp) { p.y = g; p.vy = 0; p.grounded = true; p.launched = false; }
    }

    // jump pads
    if (p.grounded) {
      for (const pad of this.map.pads) {
        if (distXZ(p.x, p.z, pad.x, pad.z) <= pad.r && Math.abs(p.y - pad.y) < 0.05) {
          p.launched = true; p.launchVx = pad.dirX * pad.vh; p.launchVz = pad.dirZ * pad.vh;
          p.vy = pad.vy; p.grounded = false;
          p.vx = p.launchVx; p.vz = p.launchVz;
          break;
        }
      }
    }
    if (p.grounded) p.vy = 0;

    // fall off the island: once, ignores invulnerability
    if (p.y < STD.fallY) {
      p.flames = Math.max(0, p.flames - 1);
      const lost = p.carried;
      p.carried = 0;
      p.fallWaitTicks = STD.fallWaitTicks;
      p.vx = p.vy = p.vz = 0; p.dashTicksLeft = 0; p.launched = false;
      this.emit({ name: "player_hit", data: { by: "fall", flames: p.flames, dropped: 0, lost } });
    }
  }

  // ------------------------------------------------------------------ shades
  private moveShades(): void {
    const p = this.player;
    const step = this.shadeSpeed * DT;
    for (const s of this.shades) {
      if (s.expelTicks > 0) { // pushed out of a freshly lit lantern, at most 30 ticks
        const d = distXZ(s.x, s.z, s.expelLx, s.expelLz), r = this.t.safe_radius;
        const ux = d > 1e-9 ? (s.x - s.expelLx) / d : 1, uz = d > 1e-9 ? (s.z - s.expelLz) / d : 0;
        const nd = s.expelTicks === 1 ? r : Math.min(r, d + r / STD.expelTicks);
        s.x = s.expelLx + ux * nd; s.z = s.expelLz + uz * nd;
        if (nd >= r) s.expelTicks = 0;
        continue;
      }
      switch (s.state) {
        case "spawning":
          break;
        case "stunned":
          if (s.pushTicks > 0) {
            const per = this.t.pulse_push_m / STD.pulsePushTicks;
            if (this.moveShade(s, s.pushX * per, s.pushZ * per)) s.pushTicks--; else s.pushTicks = 0;
          }
          break;
        case "recoil": {
          const per = STD.recoilDist / STD.recoilTicks;
          this.moveShade(s, s.recoilX * per, s.recoilZ * per);
          break;
        }
        default: { // wander / chase / drain
          const d = distXZ(s.x, s.z, p.x, p.z);
          if (s.state === "drain") { // Ticket-03 transitions out of drain
            const l = this.lanterns.find((x) => x.id === s.targetLanternId);
            if (this.playerActive && d <= STD.drainChase) { s.state = "chase"; s.targetLanternId = null; }
            else if (!l || !l.lit || l.fuelU >= this.lowFuelU || distXZ(s.x, s.z, l.x, l.z) > STD.drainReach) {
              s.state = "wander"; s.targetLanternId = null;
            } else break; // keep draining, standing still
            s.drainTicks = 0;
          }
          if (!this.playerActive) { if (s.state === "chase") s.state = "wander"; }
          else if (s.state === "chase" && d > STD.shadeLose) s.state = "wander";
          else if (s.state === "wander" && d <= STD.shadeDetect) s.state = "chase";
          if (s.state === "wander" && this.wanderToLantern(s)) break;
          if (s.state === "chase") {
            if (d > 1e-9) {
              const l = Math.min(step, d);
              if (!this.moveShade(s, ((p.x - s.x) / d) * l, ((p.z - s.z) / d) * l)) {
                // slide along an axis around obstacles
                if (!this.moveShade(s, Math.sign(p.x - s.x) * l, 0)) this.moveShade(s, 0, Math.sign(p.z - s.z) * l);
              }
            }
          } else {
            if (--s.wanderTicks <= 0) {
              const a = this.rng() * Math.PI * 2;
              s.wanderX = Math.cos(a); s.wanderZ = Math.sin(a); s.wanderTicks = STD.shadeWanderTurnTicks;
            }
            const l = STD.shadeWanderSpeed * DT;
            if (!this.moveShade(s, s.wanderX * l, s.wanderZ * l)) s.wanderTicks = 0;
          }
        }
      }
      if (s.expelTicks === 0) this.clampOutOfLight(s);
    }
  }

  /** Ticket-03 wander: head for the nearest lit lantern with fuel < 30 (tie: smaller id) and drain it within 2 m;
   *  otherwise head for the nearest unlit lantern and wait there. Returns false when there is no lantern target. */
  private wanderToLantern(s: Shade): boolean {
    const near = (list: Lantern[]) => list
      .map((l) => ({ l, d: distXZ(s.x, s.z, l.x, l.z) }))
      .sort((a, b) => a.d - b.d || byId(a.l, b.l))[0];
    const weak = near(this.lanterns.filter((l) => l.lit && l.fuelU < this.lowFuelU));
    const target = weak ?? near(this.lanterns.filter((l) => !l.lit));
    if (!target) { s.targetLanternId = null; return false; }
    s.targetLanternId = target.l.id;
    if (target.d <= STD.drainReach) {
      if (weak) { s.state = "drain"; s.drainTicks = 0; }
      return true; // at an unlit lantern: hover and wait
    }
    const l = Math.min(this.shadeSpeed * DT, target.d - STD.drainReach * 0.5);
    const ux = (target.l.x - s.x) / target.d, uz = (target.l.z - s.z) / target.d;
    if (!this.moveShade(s, ux * l, uz * l)) {
      if (!this.moveShade(s, Math.sign(ux) * l, 0)) this.moveShade(s, 0, Math.sign(uz) * l);
    }
    if (weak && distXZ(s.x, s.z, target.l.x, target.l.z) <= STD.drainReach) { s.state = "drain"; s.drainTicks = 0; }
    return true;
  }

  // ------------------------------------------------------------------ drifters
  private moveDrifters(): void {
    const p = this.player;
    for (const d of this.drifters) {
      const dist = distXZ(d.x, d.z, p.x, p.z);
      if (d.state === "idle" || d.state === "chase") {
        d.state = this.playerActive && p.carried >= STD.drifterChaseCarried && dist <= STD.drifterChaseDist ? "chase" : "idle";
      }
      if (d.state === "chase" && dist > 1e-9) {
        const l = Math.min(STD.drifterSpeed * DT, dist);
        d.x += ((p.x - d.x) / dist) * l; d.z += ((p.z - d.z) / dist) * l;
      } else if (d.state === "flee") {
        const ux = dist > 1e-9 ? (d.x - p.x) / dist : 1, uz = dist > 1e-9 ? (d.z - p.z) / dist : 0;
        d.x += ux * STD.drifterSpeed * DT; d.z += uz * STD.drifterSpeed * DT;
      } else if (d.state === "idle") { // slow glide on a 3 m circle around its anchor
        d.angle += (STD.drifterIdleSpeed / 3) * DT;
        const tx = d.anchorX + Math.cos(d.angle) * 3, tz = d.anchorZ + Math.sin(d.angle) * 3;
        const dd = distXZ(d.x, d.z, tx, tz);
        if (dd > 1e-9) { const l = Math.min(STD.drifterIdleSpeed * DT, dd); d.x += ((tx - d.x) / dd) * l; d.z += ((tz - d.z) / dd) * l; }
      }
      d.y = (this.map.ground(d.x, d.z) ?? 0) + STD.drifterHoverY;
    }
  }

  private finish(result: "won" | "lost", reason: "dawn_survived" | "dawn" | "no_flames"): void {
    this.state = result;
    this.endReason = reason;
    this.emit({ name: "game_over", data: { result, reason } });
  }
}
