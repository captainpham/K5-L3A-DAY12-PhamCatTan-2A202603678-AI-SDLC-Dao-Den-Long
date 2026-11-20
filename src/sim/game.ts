// Pure game logic for Night 1. No DOM, no Three.js: runs identically in the browser and in headless mode.
// Step order inside one tick (documented in docs/notes/assumptions.md):
//   timers (invuln, pulse cooldown, stun) -> player move/jump -> pickup -> interact/deposit -> pulse -> shades move -> shade hit
//   -> spawns -> clock -> end checks (won > no_flames > dawn)
import { makeRng } from "./rng";
import { TUNING, WORLD, TICK_RATE, DT, type Tuning } from "./tuning";
import type { GameEvent, GameState, InputState, Lantern, Mote, Player, Shade, TickEvent } from "./types";

const secToTicks = (s: number) => Math.round(s * TICK_RATE);
const distXZ = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

export interface GameOptions {
  seed: number;
  tuning?: Tuning;
}

export class Game {
  readonly t: Tuning;
  readonly rng: () => number;

  tick = 0; // number of steps run so far (== sim_tick)
  state: GameState = "playing";
  endReason: "all_lit" | "dawn" | "no_flames" | null = null;
  score = 0;
  timeLeftTicks: number;

  player: Player;
  lanterns: Lantern[] = [];
  shades: Shade[] = [];
  motes: Mote[] = [];

  randomMotes = true;
  randomShades = true;
  nextMoteNum = 1;
  nextShadeNum = 1;
  moteTimer = 0;
  nextShadeTick: number;

  /** events emitted by the most recent step() */
  events: TickEvent[] = [];
  private prev: InputState = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false };

  constructor(opts: GameOptions) {
    this.t = opts.tuning ?? TUNING;
    this.rng = makeRng(opts.seed);
    this.timeLeftTicks = secToTicks(this.t.night1_duration_s);
    this.nextShadeTick = secToTicks(WORLD.shadeFirstS);
    this.player = {
      x: 0, y: 0, z: 0, vy: 0, grounded: true,
      flames: this.t.flames, carried: 0, invulnTicks: 0, pulseCdTicks: 0, faceX: 0, faceZ: 1,
    };
    // 5 Big Lanterns on a ring; L1 on +Z, then every 72 degrees.
    for (let i = 0; i < this.t.lantern_count_night1; i++) {
      const a = (i * 2 * Math.PI) / this.t.lantern_count_night1;
      const r = WORLD.lanternRingRadius;
      this.lanterns.push({ id: `L${i + 1}`, x: r * Math.sin(a), z: r * Math.cos(a), lit: false, deposited: 0 });
    }
    for (let i = 0; i < WORLD.motesInitial; i++) this.spawnMote();
  }

  // ---------------------------------------------------------------- spawning
  private randomIslandPoint(minR: number, maxR: number): [number, number] {
    const a = this.rng() * Math.PI * 2;
    const r = Math.sqrt(minR * minR + this.rng() * (maxR * maxR - minR * minR));
    return [r * Math.cos(a), r * Math.sin(a)];
  }

  private spawnMote(): void {
    const [x, z] = this.randomIslandPoint(WORLD.moteMinR, WORLD.moteMaxR);
    this.motes.push({ id: `M${this.nextMoteNum++}`, x, z });
  }

  private spawnShade(): Shade {
    let x = 0, z = 0;
    for (let tries = 0; tries < 8; tries++) {
      const a = this.rng() * Math.PI * 2;
      x = WORLD.shadeSpawnR * Math.cos(a);
      z = WORLD.shadeSpawnR * Math.sin(a);
      if (distXZ(x, z, this.player.x, this.player.z) >= WORLD.shadeMinDistToPlayer) break;
    }
    const s: Shade = { id: `S${this.nextShadeNum++}`, x, z, stunTicks: 0 };
    this.keepOutOfLight(s);
    this.shades.push(s);
    return s;
  }

  // ---------------------------------------------------------------- helpers
  private emit(event: GameEvent): void {
    this.events.push({ tick: this.tick, event });
  }

  private clampToIsland(o: { x: number; z: number }): void {
    const r = Math.hypot(o.x, o.z);
    if (r > WORLD.islandRadius) {
      o.x *= WORLD.islandRadius / r;
      o.z *= WORLD.islandRadius / r;
    }
  }

  /** Ink shades fear lit lanterns: they can never be within safe_radius of a lit lantern. */
  keepOutOfLight(s: { x: number; z: number }): void {
    const r = this.t.safe_radius;
    if (!(r > 0)) return;
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      const d = distXZ(s.x, s.z, l.x, l.z);
      if (d <= r) {
        const edge = r + 0.01; // strictly outside: "within r" means <= r
        if (d < 1e-9) { s.x = l.x + edge; s.z = l.z; }
        else { s.x = l.x + ((s.x - l.x) / d) * edge; s.z = l.z + ((s.z - l.z) / d) * edge; }
      }
    }
  }

  shadeState(s: Shade): "chase" | "stunned" {
    return s.stunTicks > 0 ? "stunned" : "chase";
  }

  // ---------------------------------------------------------------- main step
  step(input: InputState): void {
    this.events = [];
    if (this.state !== "playing") return;
    this.tick += 1; // events of this step are tagged k+1
    const t = this.t, p = this.player;
    const rise = (k: "jump" | "interact" | "pulse") => input[k] && !this.prev[k];

    // 1. timers
    if (p.invulnTicks > 0) p.invulnTicks--;
    if (p.pulseCdTicks > 0) p.pulseCdTicks--;
    // stun counts down at the start of a step, so a stun set in step k lasts exactly pulse_stun_s of states
    for (const s of this.shades) if (s.stunTicks > 0) s.stunTicks--;

    // 2. movement (camera-relative, contract formula)
    let [mx, mz] = input.move;
    mx = Math.max(-1, Math.min(1, mx));
    mz = Math.max(-1, Math.min(1, mz));
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (input.camYawDeg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    p.x += wx * t.player_speed * DT;
    p.z += wz * t.player_speed * DT;
    if (len > 1e-6) { const l = Math.hypot(wx, wz); p.faceX = wx / l; p.faceZ = wz / l; }
    this.clampToIsland(p); // fall_enabled = false: the island edge is a wall

    // jump (vertical only; all contract distances are horizontal)
    if (rise("jump") && p.grounded) { p.vy = WORLD.jumpSpeed; p.grounded = false; }
    if (!p.grounded) {
      p.vy -= WORLD.gravity * DT;
      p.y += p.vy * DT;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
    }

    // 3. pickup (automatic when within pickup_radius and not full)
    if (this.motes.length) {
      const keep: Mote[] = [];
      for (const m of this.motes) {
        if (p.carried < t.carry_capacity && distXZ(p.x, p.z, m.x, m.z) <= t.pickup_radius) {
          p.carried++;
          this.score += t.score.per_mote;
          this.emit({ name: "mote_picked", data: { carried: p.carried } });
        } else keep.push(m);
      }
      this.motes = keep;
    }

    // 4. interact: deposit into the nearest unlit lantern within interact_radius
    if (rise("interact")) {
      let best: Lantern | null = null, bestD = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = distXZ(p.x, p.z, l.x, l.z);
        if (d <= t.interact_radius && d < bestD) { best = l; bestD = d; }
      }
      if (best) {
        const amount = Math.max(0, Math.min(p.carried, t.lantern_cost - best.deposited));
        if (amount > 0) {
          best.deposited += amount;
          p.carried -= amount;
          this.emit({ name: "deposit", data: { lantern_id: best.id, amount, deposited: best.deposited } });
        }
        if (best.deposited >= t.lantern_cost) {
          best.lit = true;
          this.score += t.score.per_lantern;
          this.emit({ name: "lantern_lit", data: { lantern_id: best.id } });
          for (const s of this.shades) this.keepOutOfLight(s);
        }
      }
    }

    // 5. pulse: costs carried light, stuns + pushes shades within pulse_radius
    if (rise("pulse") && p.pulseCdTicks === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.pulseCdTicks = secToTicks(t.pulse_cooldown_s);
      const stunned: string[] = [];
      for (const s of this.shades) {
        const d = distXZ(p.x, p.z, s.x, s.z);
        if (d <= t.pulse_radius) {
          const ux = d > 1e-9 ? (s.x - p.x) / d : 1, uz = d > 1e-9 ? (s.z - p.z) / d : 0;
          s.x += ux * t.pulse_push_m;
          s.z += uz * t.pulse_push_m;
          this.clampToIsland(s);
          this.keepOutOfLight(s);
          s.stunTicks = secToTicks(t.pulse_stun_s);
          stunned.push(s.id);
        }
      }
      this.score += t.score.per_stun * stunned.length;
      this.emit({ name: "pulse", data: { stunned_ids: stunned } });
    }

    // 6. shades chase the player (stunned shades do not move)
    for (const s of this.shades) {
      if (s.stunTicks > 0) continue;
      const d = distXZ(s.x, s.z, p.x, p.z);
      if (d > 1e-9) {
        const stepLen = Math.min(t.shade_speed * DT, d);
        s.x += ((p.x - s.x) / d) * stepLen;
        s.z += ((p.z - s.z) / d) * stepLen;
      }
      this.clampToIsland(s);
      this.keepOutOfLight(s);
    }

    // 7. shade touches player
    if (p.invulnTicks === 0) {
      for (const s of this.shades) {
        if (s.stunTicks > 0) continue;
        if (distXZ(s.x, s.z, p.x, p.z) <= t.shade_hit_radius) {
          p.flames = Math.max(0, p.flames - 1);
          const dropped = Math.floor(p.carried * t.hit_drop_ratio);
          p.carried -= dropped; // dropped light dissolves into the fog
          p.invulnTicks = secToTicks(t.invuln_s);
          this.emit({ name: "player_hit", data: { by: "shade", flames: p.flames, dropped } });
          break;
        }
      }
    }

    // 8. random spawns
    if (this.randomMotes) {
      this.moteTimer++;
      if (this.moteTimer >= secToTicks(WORLD.moteRespawnS)) {
        this.moteTimer = 0;
        if (this.motes.length < WORLD.motesMax) this.spawnMote();
      }
    }
    if (this.randomShades && this.tick >= this.nextShadeTick) {
      this.nextShadeTick += secToTicks(WORLD.shadeEveryS);
      if (this.shades.length < WORLD.shadeMax) {
        const s = this.spawnShade();
        this.emit({ name: "shade_spawned", data: { id: s.id } });
      }
    }

    // 9. clock
    this.timeLeftTicks = Math.max(0, this.timeLeftTicks - 1);

    // 10. end of night
    if (this.lanterns.every((l) => l.lit)) {
      this.score += Math.floor(this.timeLeftTicks / TICK_RATE) * t.score.per_second_left + p.flames * t.score.per_flame_left;
      this.finish("won", "all_lit");
    } else if (p.flames <= 0) {
      this.finish("lost", "no_flames");
    } else if (this.timeLeftTicks <= 0) {
      this.finish("lost", "dawn");
    }

    this.prev = { ...input, move: [input.move[0], input.move[1]] };
  }

  private finish(result: "won" | "lost", reason: "all_lit" | "dawn" | "no_flames"): void {
    this.state = result;
    this.endReason = reason;
    this.emit({ name: "game_over", data: { result, reason } });
  }

  get timeLeftS(): number {
    return this.timeLeftTicks / TICK_RATE;
  }
}
