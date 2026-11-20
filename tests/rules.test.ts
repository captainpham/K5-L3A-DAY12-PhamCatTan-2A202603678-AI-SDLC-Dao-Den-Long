// Game rules of PRD-0 / Test Contract v1.0, checked through the headless runner.
import { describe, expect, it } from "vitest";
import { TUNING as T } from "../src/sim/tuning";
import { bare, end, events, run, snapAt } from "./helpers";

const fwd = { frames: [{ tick: 0, move: [0, 1] }] };

describe("tick model & movement", () => {
  it("tick 0 snapshot is the state before any input; player starts at origin", () => {
    const l = run({ ticks: 0, scenario: bare() });
    expect(l[0]).toMatchObject({ type: "snapshot", tick: 0, sim_tick: 0, state: "playing", score: 0 });
    expect(l[0].player.pos).toEqual([0, 0, 0]);
    expect(end(l)).toEqual({ type: "end", ticks: 0, state: "playing", score: 0 });
  });

  it("moves player_speed m/s along +Z with move [0,1], yaw 0", () => {
    const l = run({ ticks: 60, scenario: bare(), inputs: fwd });
    expect(snapAt(l, 60).player.pos[2]).toBeCloseTo(T.player_speed, 3);
    expect(snapAt(l, 60).time_left_s).toBeCloseTo(T.night1_duration_s - 1, 3);
  });

  it("rotates move by cam_yaw_deg (yaw 90: forward becomes +X)", () => {
    const l = run({ ticks: 60, scenario: bare(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
    const [x, , z] = snapAt(l, 60).player.pos;
    expect(x).toBeCloseTo(T.player_speed, 2);
    expect(z).toBeCloseTo(0, 2);
  });

  it("normalizes diagonal move vectors to length 1", () => {
    const l = run({ ticks: 60, scenario: bare(), inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
    const [x, , z] = snapAt(l, 60).player.pos;
    expect(Math.hypot(x, z)).toBeCloseTo(T.player_speed, 2);
  });

  it("input fields are sticky; tick k input produces state k+1", () => {
    const l = run({ ticks: 20, scenario: bare(), snapshotEvery: 1, inputs: { frames: [{ tick: 5, move: [0, 1] }, { tick: 10, cam_yaw_deg: 0 }] } });
    expect(snapAt(l, 5).player.pos[2]).toBe(0);
    expect(snapAt(l, 6).player.pos[2]).toBeCloseTo(T.player_speed / 60, 3);
    expect(snapAt(l, 20).player.pos[2]).toBeCloseTo((15 * T.player_speed) / 60, 3);
  });

  it("jump lifts the player and lands back on Y = 0", () => {
    const l = run({ ticks: 120, scenario: bare(), snapshotEvery: 10, inputs: { frames: [{ tick: 0, jump: true }] } });
    expect(snapAt(l, 20).player.pos[1]).toBeGreaterThan(0.5);
    expect(snapAt(l, 120).player.pos[1]).toBe(0);
  });
});

describe("fireflies", () => {
  it("picks a mote exactly at pickup_radius (<= r)", () => {
    const l = run({ ticks: 1, scenario: bare({ motes: [[T.pickup_radius, 0, 0]] }) });
    expect(events(l, "mote_picked")).toEqual([{ type: "event", tick: 1, name: "mote_picked", data: { carried: 1 } }]);
    expect(end(l).score).toBe(T.score.per_mote);
  });

  it("does not pick a mote just outside pickup_radius", () => {
    const l = run({ ticks: 1, scenario: bare({ motes: [[T.pickup_radius + 0.01, 0, 0]] }) });
    expect(events(l, "mote_picked")).toHaveLength(0);
  });

  it("respects carry_capacity", () => {
    const l = run({ ticks: 1, scenario: bare({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] }) });
    expect(events(l, "mote_picked")).toHaveLength(0);
    expect(l[l.length - 2].type).toBe("snapshot");
  });

  it("random_motes true spawns a deterministic initial field", () => {
    const l = run({ ticks: 0, scenario: { random_shades: false } });
    expect(l[0].motes_active).toBe(25);
  });
});

describe("lanterns", () => {
  const near = (extra: Record<string, unknown>) =>
    bare({ lanterns: [{ id: "L1", pos: [0, 0, T.interact_radius] }], ...extra });

  it("deposits on interact rising edge within interact_radius and lights at lantern_cost", () => {
    const l = run({ ticks: 3, scenario: near({ player: { carried: T.lantern_cost } }), inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(events(l, "deposit")[0]).toMatchObject({ tick: 1, data: { lantern_id: "L1", amount: T.lantern_cost, deposited: T.lantern_cost } });
    expect(events(l, "lantern_lit")[0]).toMatchObject({ tick: 1, data: { lantern_id: "L1" } });
    expect(end(l).score).toBe(T.score.per_lantern);
  });

  it("partial deposit does not light; holding interact does not repeat", () => {
    const l = run({ ticks: 10, scenario: near({ player: { carried: 2 } }), inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(events(l, "deposit")).toHaveLength(1);
    expect(events(l, "lantern_lit")).toHaveLength(0);
    expect(snapAt(l, 10).lanterns[0]).toMatchObject({ id: "L1", deposited: 2, lit: false });
  });

  it("interact out of range does nothing", () => {
    const l = run({ ticks: 2, scenario: bare({ player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, T.interact_radius + 0.01] }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(events(l, "deposit")).toHaveLength(0);
  });

  it("lighting the last lantern wins with time and flame bonus", () => {
    const sc = bare({
      player: { carried: T.lantern_cost },
      lanterns: [
        { id: "L1", pos: [0, 0, 1] },
        { id: "L2", lit: true }, { id: "L3", lit: true }, { id: "L4", lit: true }, { id: "L5", lit: true },
      ],
      time_left_s: 100,
    });
    const l = run({ ticks: 50, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
    const bonus = Math.floor(100 - 1 / 60) * T.score.per_second_left + T.flames * T.score.per_flame_left;
    expect(events(l, "game_over")[0]).toMatchObject({ tick: 1, data: { result: "won", reason: "all_lit" } });
    expect(end(l)).toEqual({ type: "end", ticks: 1, state: "won", score: T.score.per_lantern + bonus });
  });

  it("pre-lit lanterns from the scenario give no events and no score", () => {
    const l = run({ ticks: 0, scenario: bare({ lanterns: [{ id: "L1", lit: true }] }) });
    expect(events(l)).toHaveLength(0);
    expect(l[0].score).toBe(0);
    expect(l[0].lanterns[0].lit).toBe(true);
  });

  it("night 1 has 5 lanterns L1..L5", () => {
    const l = run({ ticks: 0 });
    expect(l[0].lanterns.map((x: any) => x.id)).toEqual(["L1", "L2", "L3", "L4", "L5"]);
  });
});

describe("ink shades", () => {
  it("chase the player at shade_speed", () => {
    const l = run({ ticks: 60, scenario: bare({ shades: [{ id: "S1", pos: [10, 0, 0] }] }) });
    expect(snapAt(l, 60).shades[0].pos[0]).toBeCloseTo(10 - T.shade_speed, 3);
    expect(snapAt(l, 60).shades[0].state).toBe("chase");
  });

  it("hit costs a flame, drops hit_drop_ratio of carried, then invulnerable for invuln_s", () => {
    const l = run({ ticks: 120, scenario: bare({ player: { carried: 4 }, shades: [{ id: "S1", pos: [0, 0, 0] }] }) });
    const hits = events(l, "player_hit");
    expect(hits[0]).toMatchObject({ tick: 1, data: { by: "shade", flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) } });
    expect(hits[1].tick).toBe(1 + Math.round(T.invuln_s * 60));
  });

  it("losing all flames ends the night (no_flames)", () => {
    const l = run({ ticks: 600, scenario: bare({ player: { flames: 1 }, shades: [{ pos: [0, 0, 0] }] }) });
    expect(events(l, "game_over")[0]).toMatchObject({ tick: 1, data: { result: "lost", reason: "no_flames" } });
    expect(end(l)).toMatchObject({ ticks: 1, state: "lost" });
  });

  it("cannot enter safe_radius of a lit lantern", () => {
    const l = run({ ticks: 600, scenario: bare({ player: { pos: [0, 0, 20] }, lanterns: [{ id: "L1", pos: [0, 0, 20], lit: true }], shades: [{ id: "S1", pos: [0, 0, 0] }] }) });
    for (const s of l.filter((x) => x.type === "snapshot")) {
      const [x, , z] = s.shades[0].pos;
      expect(Math.hypot(x, z - 20)).toBeGreaterThan(T.safe_radius);
    }
    expect(events(l, "player_hit")).toHaveLength(0);
  });

  it("random shades spawn with shade_spawned events and unique ids", () => {
    // many flames so the standing player survives long enough for several spawns
    const l = run({ ticks: 60 * 75, scenario: { random_motes: false, player: { flames: 99 } } });
    const ids = events(l, "shade_spawned").map((e) => e.data.id);
    expect(ids.slice(0, 2)).toEqual(["S1", "S2"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("pulse", () => {
  const sc = (shadeX: number, carried = 3) => bare({ player: { carried }, shades: [{ id: "S1", pos: [shadeX, 0, 0] }] });
  const press = { frames: [{ tick: 0, pulse: true }] };

  it("stuns + pushes shades within pulse_radius, costs pulse_cost, scores per_stun", () => {
    const l = run({ ticks: 1, scenario: sc(T.pulse_radius), inputs: press });
    expect(events(l, "pulse")[0]).toMatchObject({ tick: 1, data: { stunned_ids: ["S1"] } });
    expect(end(l).score).toBe(T.score.per_stun);
    const l2 = run({ ticks: 10, scenario: sc(T.pulse_radius), inputs: press });
    expect(snapAt(l2, 10).shades[0]).toMatchObject({ state: "stunned" });
    expect(snapAt(l2, 10).shades[0].pos[0]).toBeCloseTo(T.pulse_radius + T.pulse_push_m, 3);
    expect(snapAt(l2, 10).player.carried).toBe(3 - T.pulse_cost);
  });

  it("stun lasts pulse_stun_s then the shade chases again", () => {
    const stun = Math.round(T.pulse_stun_s * 60);
    const l = run({ ticks: stun + 2, snapshotEvery: 1, scenario: sc(3), inputs: press });
    expect(snapAt(l, stun).shades[0].state).toBe("stunned");
    expect(snapAt(l, stun + 1).shades[0].state).toBe("chase");
  });

  it("misses shades outside pulse_radius (empty stunned_ids)", () => {
    const l = run({ ticks: 1, scenario: sc(T.pulse_radius + 0.01), inputs: press });
    expect(events(l, "pulse")[0].data.stunned_ids).toEqual([]);
  });

  it("respects pulse_cooldown_s", () => {
    const cd = Math.round(T.pulse_cooldown_s * 60);
    const inputs = { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: cd - 2, pulse: true }, { tick: cd - 1, pulse: false }, { tick: cd, pulse: true }] };
    const l = run({ ticks: cd + 2, scenario: sc(30, 5), inputs });
    expect(events(l, "pulse").map((e) => e.tick)).toEqual([1, cd + 1]);
  });

  it("needs pulse_cost carried light", () => {
    const l = run({ ticks: 2, scenario: sc(3, T.pulse_cost - 1), inputs: press });
    expect(events(l, "pulse")).toHaveLength(0);
  });
});

describe("dawn", () => {
  it("time running out loses with reason dawn", () => {
    const l = run({ ticks: 200, scenario: bare({ time_left_s: 1 }) });
    expect(events(l, "game_over")[0]).toMatchObject({ tick: 60, data: { result: "lost", reason: "dawn" } });
    expect(end(l)).toMatchObject({ ticks: 60, state: "lost" });
  });
});
