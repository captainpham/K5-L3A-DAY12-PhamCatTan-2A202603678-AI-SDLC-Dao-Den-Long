// Ticket-02 standard rules (Part 1) and Test Contract v1.1, checked through the headless runner.
// Phase 1 rules that still hold are kept (regression); rules replaced by Ticket-02 are noted inline.
import { describe, expect, it } from "vitest";
import { STD, TUNING as T } from "../src/sim/tuning";
import { bare, end, events, run, snapAt, snaps } from "./helpers";

const fwd = { frames: [{ tick: 0, move: [0, 1] }] };
const press = (btn: string, tick = 0) => ({ frames: [{ tick, [btn]: true }] });

describe("tick model & movement", () => {
  it("tick 0 snapshot is the state before input; night_start event at tick 0", () => {
    const l = run({ ticks: 0, scenario: bare() });
    expect(l[0]).toMatchObject({ type: "snapshot", tick: 0, sim_tick: 0, night: 1, state: "playing", score: 0 });
    expect(l[0].player).toMatchObject({ pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, invuln: false, flames: 3 });
    expect(l[1]).toMatchObject({ type: "event", tick: 0, name: "night_start", data: { night: 1 } });
    expect(end(l)).toEqual({ type: "end", ticks: 0, state: "playing", score: 0 });
  });

  it("runs at 6.0 m/s (reaches full speed within 0.1 s)", () => {
    const l = run({ ticks: 60, scenario: bare(), inputs: fwd });
    expect(snapAt(l, 60).player.pos[2]).toBeGreaterThan(6 - 0.6 * 0.1);
    expect(snapAt(l, 60).player.pos[2]).toBeLessThanOrEqual(6 + 1e-6);
    expect(snapAt(l, 60).time_left_s).toBeCloseTo(299, 3);
  });

  it("rotates move by cam_yaw_deg and normalizes diagonals", () => {
    const l = run({ ticks: 60, scenario: bare(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
    expect(snapAt(l, 60).player.pos[0]).toBeCloseTo(6, 2);
    const d = run({ ticks: 60, scenario: bare(), inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
    const [x, , z] = snapAt(d, 60).player.pos;
    expect(Math.hypot(x, z)).toBeCloseTo(6, 2);
  });

  it("inputs are sticky; tick k input produces state k+1", () => {
    const l = run({ ticks: 20, scenario: bare(), snapshotEvery: 1, inputs: { frames: [{ tick: 5, move: [0, 1] }, { tick: 10, cam_yaw_deg: 0 }] } });
    expect(snapAt(l, 5).player.pos[2]).toBe(0);
    expect(snapAt(l, 6).player.pos[2]).toBeCloseTo(0.1, 3);
    expect(snapAt(l, 20).player.pos[2]).toBeCloseTo(1.5, 3);
  });

  it("jump: 7 m/s, gravity 20, apex ~1.225 m, lands on Y=0; only from the ground", () => {
    const l = run({ ticks: 60, scenario: bare(), snapshotEvery: 1, inputs: { frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, jump: true }] } });
    const ys = snaps(l).map((s) => s.player.pos[1]);
    expect(Math.max(...ys)).toBeGreaterThan(1.1);
    expect(Math.max(...ys)).toBeLessThan(1.3);
    expect(snapAt(l, 60).player.pos[1]).toBe(0);
    expect(snapAt(l, 60).player.grounded).toBe(true);
    expect(snapAt(l, 1).player.vel[1]).toBeGreaterThan(0);
  });
});

describe("dash", () => {
  it("14 m/s for 0.2 s in the facing direction when standing (start faces +Z), dash event", () => {
    const l = run({ ticks: 20, scenario: bare(), snapshotEvery: 1, inputs: press("dash") });
    expect(events(l, "dash")[0]).toMatchObject({ tick: 1, data: {} });
    expect(snapAt(l, 12).player.pos[2]).toBeCloseTo(14 * 0.2, 3);
    expect(snapAt(l, 20).player.pos[2]).toBeCloseTo(2.8, 3);
    expect(snapAt(l, 1).player.dash_cd_s).toBeCloseTo(1.5, 3);
  });

  it("cooldown 1.5 s counted from dash start", () => {
    const inputs = { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 88, dash: true }, { tick: 89, dash: false }, { tick: 90, dash: true }] };
    const l = run({ ticks: 100, scenario: bare(), inputs });
    expect(events(l, "dash").map((e) => e.tick)).toEqual([1, 91]);
  });

  it("air dash keeps altitude", () => {
    const l = run({ ticks: 30, scenario: bare(), snapshotEvery: 1, inputs: { frames: [{ tick: 0, jump: true }, { tick: 10, dash: true }] } });
    const y11 = snapAt(l, 11).player.pos[1];
    expect(snapAt(l, 22).player.pos[1]).toBeCloseTo(y11, 6);
  });
});

describe("fireflies", () => {
  it("20 at start on 20 different standard spawn points", () => {
    const l = run({ ticks: 0, scenario: { random_shades: false } });
    const pos = l[0].motes.map((m: any) => m.pos.join(","));
    expect(pos).toHaveLength(20);
    expect(new Set(pos).size).toBe(20);
    for (const m of l[0].motes) {
      const r = Math.hypot(m.pos[0], m.pos[2]);
      expect([12, 33].some((x) => Math.abs(r - x) < 1e-3)).toBe(true);
      expect(m).toMatchObject({ kind: "random", ttl_s: null });
    }
  });

  it("spawns one more at tick 240 when below the cap", () => {
    const l = run({ ticks: 240, scenario: { random_shades: false } });
    expect(snapAt(l, 230).motes_active).toBe(20);
    expect(snapAt(l, 240).motes_active).toBe(21);
  });

  it("pickup at XZ <= 1.0 and height difference <= 1.5; capacity 10", () => {
    const at = (pos: number[], carried = 0) => events(run({ ticks: 1, scenario: bare({ player: { carried }, motes: [pos] }) }), "mote_picked");
    expect(at([1, 0, 0])).toEqual([{ type: "event", tick: 1, name: "mote_picked", data: { carried: 1 } }]);
    expect(at([1.01, 0, 0])).toHaveLength(0);
    expect(at([0, 0, 0], 10)).toHaveLength(0);
    // height: mote on a 1.5 m ledge is reachable, 1.6 m is not
    expect(at([0, 1.5, 0])).toHaveLength(1);
    expect(at([0, 1.6, 0])).toHaveLength(0);
  });

  it("picking gives no score (score is per deposited mote since Ticket-02)", () => {
    const l = run({ ticks: 1, scenario: bare({ motes: [[0, 0, 0]] }) });
    expect(end(l).score).toBe(0);
  });
});

describe("lanterns", () => {
  const near = (extra: Record<string, unknown>) => bare({ lanterns: [{ id: "L1", pos: [0, 0, 2] }], ...extra });

  it("costs 10, deposits min(carried, missing), remembers progress, +10 per mote, +100 when lit", () => {
    const first = run({ ticks: 2, scenario: near({ player: { carried: 6 } }), inputs: press("interact") });
    expect(events(first, "deposit")[0].data).toEqual({ lantern_id: "L1", amount: 6, deposited: 6 });
    expect(events(first, "lantern_lit")).toHaveLength(0);
    expect(end(first).score).toBe(60);
    // progress is remembered: 6 already deposited, carrying 6 -> deposits only the missing 4
    const second = run({ ticks: 2, scenario: near({ player: { carried: 6 }, lanterns: [{ id: "L1", pos: [0, 0, 2], deposited: 6 }] }), inputs: press("interact") });
    expect(events(second, "deposit")[0].data).toEqual({ lantern_id: "L1", amount: 4, deposited: 10 });
    expect(events(second, "lantern_lit")[0]).toMatchObject({ tick: 1, data: { lantern_id: "L1" } });
    expect(end(second).score).toBe(40 + 100);
    expect(snapAt(run({ ticks: 10, scenario: near({ player: { carried: 6 }, lanterns: [{ id: "L1", pos: [0, 0, 2], deposited: 6 }] }), inputs: press("interact") }), 10).player.carried).toBe(2);
  });

  it("interact radius 2.0; nearest unlit lantern; tie -> smaller id", () => {
    const out = run({ ticks: 1, scenario: bare({ player: { carried: 1 }, lanterns: [{ id: "L1", pos: [0, 0, 2.01] }] }), inputs: press("interact") });
    expect(events(out, "deposit")).toHaveLength(0);
    const tie = run({ ticks: 1, scenario: bare({ player: { carried: 1 }, lanterns: [{ id: "L2", pos: [1, 0, 0] }, { id: "L1", pos: [-1, 0, 0] }] }), inputs: press("interact") });
    expect(events(tie, "deposit")[0].data.lantern_id).toBe("L1");
  });

  it("lighting the last lantern wins with floor(seconds left) x 2 + 50 x flames", () => {
    const sc = bare({
      player: { carried: 10 },
      lanterns: [{ id: "L1", pos: [0, 0, 1] }, { id: "L2", lit: true }, { id: "L3", lit: true }, { id: "L4", lit: true }, { id: "L5", lit: true }],
      time_left_s: 100,
    });
    const l = run({ ticks: 5, scenario: sc, inputs: press("interact") });
    expect(events(l, "game_over")[0]).toMatchObject({ tick: 1, data: { result: "won", reason: "all_lit" } });
    expect(end(l)).toEqual({ type: "end", ticks: 1, state: "won", score: 100 + 100 + 99 * 2 + 3 * 50 });
  });

  it("standard Night 1 map: L1..L5 at the ticket positions", () => {
    const l = run({ ticks: 0 });
    expect(l[0].lanterns.map((x: any) => x.pos)).toEqual([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  });
});

describe("ink shades", () => {
  it("chase at 4.0 m/s inside 12 m; 13 m away they only wander", () => {
    const l = run({ ticks: 60, scenario: bare({ shades: [{ id: "S1", pos: [10, 0, 0] }] }) });
    expect(snapAt(l, 60).shades[0].pos[0]).toBeCloseTo(6, 3);
    expect(snapAt(l, 60).shades[0].state).toBe("chase");
    const far = run({ ticks: 10, scenario: bare({ shades: [{ id: "S1", pos: [13, 0, 0] }] }) });
    expect(snapAt(far, 10).shades[0].state).toBe("wander");
  });

  it("shade centre is 1 m above the ground", () => {
    const l = run({ ticks: 0, scenario: bare({ shades: [{ id: "S1", pos: [10, 0, 0] }] }) });
    expect(l[0].shades[0].pos).toEqual([10, 1, 0]);
  });

  it("hit: -1 flame, floor(carried/2) dropped on a 1.5-2.5 m ring (ttl 8 s), shade recoils 2 m over 60 ticks, 90 invuln ticks", () => {
    const l = run({ ticks: 120, snapshotEvery: 1, scenario: bare({ player: { carried: 5 }, shades: [{ id: "S1", pos: [0.5, 0, 0] }] }) });
    const hit = events(l, "player_hit")[0];
    expect(hit).toMatchObject({ tick: 1, data: { by: "shade", flames: 2, dropped: 2 } });
    const s1 = snapAt(l, 1);
    expect(s1.player).toMatchObject({ carried: 3, invuln: true });
    const dropped = s1.motes.filter((m: any) => m.kind === "dropped");
    expect(dropped).toHaveLength(2);
    for (const m of dropped) {
      const r = Math.hypot(m.pos[0], m.pos[2]);
      expect(r).toBeGreaterThanOrEqual(1.5 - 1e-3);
      expect(r).toBeLessThanOrEqual(2.5 + 1e-3);
      expect(m.ttl_s).toBeCloseTo(8, 3);
    }
    expect(s1.shades[0].state).toBe("recoil");
    // tick 1: chased 4/60 m in, then hit -> recoil 2 m outward over 60 ticks (ticks 1..60)
    expect(snapAt(l, 60).shades[0].pos[0]).toBeCloseTo(0.5 - 4 / 60 + 2, 3);
    expect(snapAt(l, 61).shades[0].state).not.toBe("recoil");
    // the shade comes back and is in contact again: next hit lands exactly when the 90 invuln ticks end
    expect(snapAt(l, 90).player.invuln).toBe(true);
    expect(events(l, "player_hit")[1].tick).toBe(91);
  });

  it("at most one flame per tick, by increasing id", () => {
    const l = run({ ticks: 1, scenario: bare({ shades: [{ id: "S2", pos: [0.5, 0, 0] }, { id: "S1", pos: [-0.5, 0, 0] }] }) });
    expect(events(l, "player_hit")).toHaveLength(1);
    expect(snapAt(run({ ticks: 10, scenario: bare({ shades: [{ id: "S2", pos: [0.5, 0, 0] }, { id: "S1", pos: [-0.5, 0, 0] }] }) }), 10).shades
      .find((s: any) => s.id === "S1").state).toBe("recoil");
  });

  it("losing all flames ends the night (no_flames), even if all lanterns are lit the same tick", () => {
    const l = run({ ticks: 5, scenario: bare({ player: { flames: 1 }, shades: [{ pos: [0, 0, 0] }] }) });
    expect(events(l, "game_over")[0]).toMatchObject({ tick: 1, data: { result: "lost", reason: "no_flames" } });
  });

  it("blocked at the 6 m edge of a lit lantern", () => {
    const l = run({ ticks: 600, scenario: bare({ player: { pos: [0, 0, 20] }, lanterns: [{ id: "L1", pos: [0, 0, 20], lit: true }], shades: [{ id: "S1", pos: [0, 0, 10] }] }) });
    for (const s of snaps(l)) {
      const [x, , z] = s.shades[0].pos;
      expect(Math.hypot(x, z - 20)).toBeGreaterThanOrEqual(T.safe_radius - 1e-3);
    }
    expect(events(l, "player_hit")).toHaveLength(0);
  });

  it("a shade inside when the lantern is lit is pushed out within 30 ticks and does no damage meanwhile", () => {
    const sc = bare({ player: { carried: 10, invuln_ticks: 0 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }], shades: [{ id: "S1", pos: [0.5, 0, 0] }] });
    const l = run({ ticks: 40, snapshotEvery: 1, scenario: { ...sc, shades: [{ id: "S1", pos: [0.5, 0, 0], state: "stunned", state_ticks_left: 1 }] }, inputs: press("interact") });
    expect(events(l, "lantern_lit")).toHaveLength(1);
    expect(events(l, "player_hit")).toHaveLength(0);
    const s = snapAt(l, 30).shades[0];
    expect(Math.hypot(s.pos[0], s.pos[2] - 1)).toBeCloseTo(6, 2);
  });

  it("schedule: 2 shades at tick 300 (S1, S2) in spawning state, then 1 every 8 s, max 6", () => {
    const l = run({ ticks: 300 + 480 * 6, scenario: { random_motes: false, player: { flames: 99 } } });
    const sp = events(l, "shade_spawned");
    expect(sp.slice(0, 3).map((e) => [e.tick, e.data.id])).toEqual([[300, "S1"], [300, "S2"], [780, "S3"]]);
    expect(sp).toHaveLength(6);
    expect(snapAt(l, 300).shades[0].state).toBe("spawning");
    for (const s of snapAt(l, 300).shades) expect(Math.hypot(s.pos[0], s.pos[2])).toBeCloseTo(37, 3);
  });
});

describe("pulse", () => {
  const sc = (shadeX: number, carried = 5) => bare({ player: { carried }, shades: [{ id: "S1", pos: [shadeX, 0, 0] }] });

  it("costs 3, radius 5 (3D from feet+0.8 to shade centre), +5 per shade, stun 120 ticks", () => {
    // shade centre (x,1,0), pulse centre (0,0.8,0): 3D distance = hypot(x, 0.2)
    const edge = Math.sqrt(25 - 0.04);
    const l = run({ ticks: 125, snapshotEvery: 1, scenario: sc(edge), inputs: press("pulse") });
    expect(events(l, "pulse")[0]).toMatchObject({ tick: 1, data: { stunned_ids: ["S1"] } });
    expect(snapAt(l, 1).player.carried).toBe(2);
    expect(end(l).score).toBe(5);
    expect(snapAt(l, 120).shades[0].state).toBe("stunned");
    expect(snapAt(l, 121).shades[0].state).not.toBe("stunned");
    const miss = run({ ticks: 1, scenario: sc(5.01), inputs: press("pulse") });
    expect(events(miss, "pulse")[0].data.stunned_ids).toEqual([]);
  });

  it("pushes 4 m horizontally during the first 15 ticks", () => {
    const l = run({ ticks: 30, snapshotEvery: 1, scenario: sc(3), inputs: press("pulse") });
    expect(snapAt(l, 15).shades[0].pos[0]).toBeCloseTo(7, 3);
    expect(snapAt(l, 30).shades[0].pos[0]).toBeCloseTo(7, 3);
  });

  it("needs 3 motes; cooldown 3 s; re-pulse refreshes stun and scores again", () => {
    expect(events(run({ ticks: 2, scenario: sc(3, 2), inputs: press("pulse") }), "pulse")).toHaveLength(0);
    const inputs = { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 178, pulse: true }, { tick: 179, pulse: false }, { tick: 180, pulse: true }] };
    const l = run({ ticks: 182, scenario: bare({ player: { carried: 9 }, shades: [{ id: "S1", pos: [2, 0, 0], state: "stunned", state_ticks_left: 500 }] }), inputs });
    expect(events(l, "pulse").map((e) => e.tick)).toEqual([1, 181]);
    expect(end(l).score).toBe(10);
  });
});

describe("fall, dawn, pause", () => {
  it("walking off Night 1 (r > 40) falls: -1 flame, all motes lost, respawn at start after 60 ticks, invulnerable", () => {
    const l = run({ ticks: 200, snapshotEvery: 1, scenario: bare({ player: { pos: [0, 0, 39.5], carried: 4 } }), inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 10, move: [0, 0] }] } });
    const hit = events(l, "player_hit")[0];
    expect(hit.data).toEqual({ by: "fall", flames: 2, dropped: 0, lost: 4 });
    const t = hit.tick;
    expect(snapAt(l, t).player.pos[1]).toBeLessThan(-10);
    expect(snapAt(l, t + 60).player).toMatchObject({ pos: [0, 0, 0], vel: [0, 0, 0], invuln: true, carried: 0 });
    expect(events(l, "player_hit")).toHaveLength(1);
  });

  it("dawn: time running out loses", () => {
    const l = run({ ticks: 400, scenario: bare({ time_left_s: 1 }) });
    expect(events(l, "game_over")[0]).toMatchObject({ tick: 60, data: { result: "lost", reason: "dawn" } });
  });

  it("pause freezes sim_tick, time and motion; snapshot state paused; resume continues", () => {
    const inputs = { frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 30, pause: true }] };
    const l = run({ ticks: 40, snapshotEvery: 1, scenario: bare(), inputs });
    expect(events(l, "paused")[0].tick).toBe(11);
    expect(events(l, "resumed")[0].tick).toBe(31);
    expect(snapAt(l, 20)).toMatchObject({ state: "paused", sim_tick: 10 });
    expect(snapAt(l, 20).player.pos[2]).toBeCloseTo(1, 3);
    expect(snapAt(l, 20).time_left_s).toBeCloseTo(300 - 10 / 60, 3);
    expect(snapAt(l, 31)).toMatchObject({ state: "playing", sim_tick: 11 });
    expect(end(l)).toMatchObject({ ticks: 40 });
  });
});

describe("creative extra: solid trees (windowed game only)", () => {
  it("blocks Mây when the game passes tree solids; headless never sets them", async () => {
    const { Game } = await import("../src/sim/game");
    const { NEUTRAL_INPUT } = await import("../src/sim/types");
    const walk = (solids: { x: number; z: number; r: number }[]) => {
      const g = new Game({ seed: 1, night: 1 });
      g.randomShades = false;
      g.extraSolids = solids;
      for (let i = 0; i < 60; i++) g.step({ ...NEUTRAL_INPUT, move: [0, 1] });
      return g.player.z;
    };
    expect(walk([])).toBeCloseTo(6, 3);
    expect(walk([{ x: 0, z: 3, r: 0.8 }])).toBeLessThan(2.3);
    expect(new Game({ seed: 1 }).extraSolids).toEqual([]); // runHeadless builds exactly this
  });
});

describe("contract", () => {
  it("snapshot has all v1.1 fields", () => {
    const s = run({ ticks: 0, night: 3 })[0];
    expect(Object.keys(s)).toEqual(expect.arrayContaining(["night", "wind", "motes", "drifters", "charms", "motes_active"]));
    expect(Object.keys(s.player)).toEqual(expect.arrayContaining(["vel", "grounded", "invuln", "dash_cd_s", "pulse_cd_s", "charm_s"]));
    expect(s.wind).toEqual({ active: false, dir_deg: 0 });
    expect(s.charms).toEqual([{ id: "C1", available: true, respawn_s: 0 }, { id: "C2", available: true, respawn_s: 0 }]);
    expect(s.lanterns).toHaveLength(7);
    expect(STD.moteMax).toBe(30);
  });
});
