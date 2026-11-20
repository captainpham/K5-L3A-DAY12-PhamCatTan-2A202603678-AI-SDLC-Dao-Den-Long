// Ticket-03 "Đèn cạn dầu": lantern fuel, relight, refuel, drain, dawn win, growing capacity, new score (contract v1.2).
import { describe, expect, it } from "vitest";
import { bare, end, events, run, snapAt } from "./helpers";

const press = (btn: string, tick = 0) => ({ frames: [{ tick, [btn]: true }] });
const at = (id: string, pos: number[], extra: Record<string, unknown> = {}) => ({ id, pos, ...extra });

describe("fuel", () => {
  it("first light: fuel 100, ever_lit, relight:false, capacity 12; decays 1/s (1 decimal in snapshot)", () => {
    const l = run({ ticks: 61, snapshotEvery: 1, scenario: bare({ player: { carried: 10 }, lanterns: [at("L1", [0, 0, 1])] }), inputs: press("interact") });
    expect(events(l, "lantern_lit")[0].data).toEqual({ lantern_id: "L1", relight: false });
    expect(snapAt(l, 1).lanterns[0]).toMatchObject({ lit: true, fuel: 100, ever_lit: true, relit_count: 0 });
    expect(snapAt(l, 61).lanterns[0].fuel).toBe(99);
    expect(snapAt(l, 1).player).toMatchObject({ capacity: 12, carried: 0 });
    expect(end(l).score).toBe(10 * 5 + 100);
  });

  it("fuel <= 0: lantern goes out (lantern_out), deposited 0, fuel 0, ever_lit stays true", () => {
    const l = run({ ticks: 70, snapshotEvery: 1, scenario: bare({ lanterns: [at("L1", [0, 0, 20], { lit: true, fuel: 1 })] }) });
    expect(events(l, "lantern_out")[0]).toMatchObject({ tick: 60, data: { lantern_id: "L1" } });
    expect(snapAt(l, 60).lanterns[0]).toMatchObject({ lit: false, fuel: 0, deposited: 0, ever_lit: true });
    expect(snapAt(l, 59).lanterns[0].fuel).toBeCloseTo(0, 1);
  });

  it("relight needs only 5 motes, +40, relight:true, relit_count 1", () => {
    const sc = bare({ player: { carried: 7 }, lanterns: [at("L1", [0, 0, 1], { lit: false, ever_lit: true })] });
    const l = run({ ticks: 1, snapshotEvery: 1, scenario: sc, inputs: press("interact") });
    expect(events(l, "deposit")[0].data).toEqual({ lantern_id: "L1", amount: 5, deposited: 5 });
    expect(events(l, "lantern_lit")[0].data).toEqual({ lantern_id: "L1", relight: true });
    expect(snapAt(l, 1).lanterns[0]).toMatchObject({ lit: true, fuel: 100, relit_count: 1 });
    expect(end(l).score).toBe(5 * 5 + 40);
  });

  it("refuel: used = min(carried, ceil((100 - fuel)/10)), fuel += 10 x used (max 100), +5 per mote", () => {
    const sc = bare({ player: { carried: 10 }, lanterns: [at("L1", [0, 0, 1], { lit: true, fuel: 50.5 })] });
    const l = run({ ticks: 1, snapshotEvery: 1, scenario: sc, inputs: press("interact") });
    // step 2 burns 1/60 first: 50.4833 -> needs ceil(49.52/10) = 5
    expect(events(l, "refuel")[0].data).toEqual({ lantern_id: "L1", amount: 5, fuel: 100 });
    expect(snapAt(l, 1).player.carried).toBe(5);
    expect(end(l).score).toBe(25);
    const few = run({ ticks: 1, scenario: bare({ player: { carried: 2 }, lanterns: [at("L1", [0, 0, 1], { lit: true, fuel: 20 })] }), inputs: press("interact") });
    expect(events(few, "refuel")[0].data.amount).toBe(2);
    expect(events(few, "refuel")[0].data.fuel).toBeCloseTo(40, 0);
    const none = run({ ticks: 1, scenario: bare({ player: { carried: 0 }, lanterns: [at("L1", [0, 0, 1], { lit: true, fuel: 20 })] }), inputs: press("interact") });
    expect(events(none, "refuel")).toHaveLength(0);
  });

  it("lit lantern without fuel in the scenario defaults to fuel 100", () => {
    expect(run({ ticks: 0, scenario: bare({ lanterns: [at("L1", [0, 0, 20], { lit: true })] }) })[0].lanterns[0].fuel).toBe(100);
  });
});

describe("shades drain weak lanterns", () => {
  const weak = (fuel: number, shades: unknown[], extra: Record<string, unknown> = {}) =>
    bare({ player: { pos: [0, 0, -30] }, lanterns: [at("L1", [0, 0, 20], { lit: true, fuel })], shades, ...extra });

  it("fuel < 30 loses the safe zone; exactly 30 keeps it", () => {
    // 5 m away: walks 3 m into the (lost) safe zone at 4 m/s and starts draining
    const inside = run({ ticks: 60, scenario: weak(29, [{ id: "S1", pos: [0, 0, 15] }]) });
    expect(snapAt(inside, 60).shades[0].state).toBe("drain");
    const keep = run({ ticks: 30, scenario: weak(31, [{ id: "S1", pos: [0, 0, 13] }]) });
    const s = snapAt(keep, 30).shades[0];
    expect(Math.hypot(s.pos[0], s.pos[2] - 20)).toBeGreaterThanOrEqual(6 - 1e-3);
  });

  it("a wander shade within 2 m drains 5/s (plus 1/s decay), fuel_drain every 60 ticks", () => {
    const l = run({ ticks: 130, snapshotEvery: 1, scenario: weak(20, [{ id: "S1", pos: [0, 0, 18.5] }]) });
    expect(snapAt(l, 1).shades[0].state).toBe("drain");
    const ev = events(l, "fuel_drain");
    expect(ev[0]).toMatchObject({ tick: 61, data: { lantern_id: "L1", shade_id: "S1" } });
    expect(ev[0].data.fuel).toBeCloseTo(20 - 61 / 60 - 5, 1);
    expect(ev[1].tick).toBe(121);
  });

  it("several draining shades add up", () => {
    const l = run({ ticks: 61, scenario: weak(20, [{ id: "S1", pos: [0, 0, 18.5] }, { id: "S2", pos: [1, 0, 19] }]) });
    expect(snapAt(l, 60).lanterns[0].fuel).toBeCloseTo(20 - 1 - 2 * 5 * (59 / 60), 1);
  });

  it("wander shades head for the nearest weak lantern (tie: smaller id), otherwise the nearest unlit one", () => {
    const sc = bare({ player: { pos: [0, 0, -35] }, lanterns: [at("L1", [10, 0, 0], { lit: true, fuel: 20 }), at("L2", [-10, 0, 0], { lit: true, fuel: 20 })], shades: [{ id: "S1", pos: [0, 0, 5] }] });
    const l = run({ ticks: 200, scenario: sc });
    expect(snapAt(l, 200).shades[0].state).toBe("drain");
    expect(snapAt(l, 200).shades[0].pos[0]).toBeGreaterThan(7); // went to L1 (tie broken by id)
  });

  it("drain -> chase when Mây comes within 6 m; -> wander when refuelled to >= 30 (pushed out, harmless)", () => {
    const chase = run({ ticks: 2, snapshotEvery: 1, scenario: weak(20, [{ id: "S1", pos: [0, 0, 18.5], state: "drain", target_lantern_id: "L1" }], { player: { pos: [0, 0, 13] } }) });
    expect(snapAt(chase, 1).shades[0].state).toBe("chase");
    const sc = bare({ player: { pos: [0, 0, 18.2], carried: 10 }, lanterns: [at("L1", [0, 0, 20], { lit: true, fuel: 20 })], shades: [{ id: "S1", pos: [1.5, 0, 20], state: "drain", target_lantern_id: "L1" }] });
    // Mây is within 6 m too, so the shade would chase; the refuel happens first in the tick and pushes it out harmlessly
    const ref = run({ ticks: 31, snapshotEvery: 1, scenario: sc, inputs: press("interact") });
    expect(events(ref, "refuel")[0].data.fuel).toBeGreaterThanOrEqual(30);
    expect(events(ref, "player_hit")).toHaveLength(0);
    const s = snapAt(ref, 30).shades[0];
    expect(Math.hypot(s.pos[0], s.pos[2] - 20)).toBeCloseTo(6, 2);
  });

  it("pulse on a draining shade scores 15 in total (5 otherwise)", () => {
    const sc = bare({ player: { carried: 3, pos: [0, 0, 16] }, lanterns: [at("L1", [0, 0, 20], { lit: true, fuel: 20 })], shades: [{ id: "S1", pos: [0, 0, 18.5], state: "drain", target_lantern_id: "L1" }] });
    const l = run({ ticks: 1, scenario: sc, inputs: press("pulse") });
    expect(events(l, "pulse")[0].data.stunned_ids).toEqual(["S1"]);
    expect(end(l).score).toBe(15);
  });

  it("stun ends -> wander", () => {
    const l = run({ ticks: 3, snapshotEvery: 1, scenario: bare({ player: { pos: [0, 0, -30] }, shades: [{ id: "S1", pos: [0, 0, 10], state: "stunned", state_ticks_left: 1 }] }) });
    expect(snapAt(l, 1).shades[0].state).toBe("wander");
  });
});

describe("dawn win", () => {
  const lanterns = (n: number) => ["L1", "L2", "L3", "L4", "L5"].map((id, i) => at(id, [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]][i], i < n ? { lit: true, fuel: 50 } : {}));

  it("alive at dawn with >= ceil(0.6 x 5) = 3 lit: won dawn_survived, +50 + floor(fuel) per lit lantern, +50 per flame", () => {
    const l = run({ ticks: 100, scenario: bare({ lanterns: lanterns(3), time_left_s: 1 }) });
    expect(events(l, "game_over")[0]).toMatchObject({ tick: 60, data: { result: "won", reason: "dawn_survived" } });
    expect(end(l)).toEqual({ type: "end", ticks: 60, state: "won", score: 3 * (50 + 49) + 3 * 50 });
  });

  it("2 of 5 lit at dawn loses (dawn); lighting everything early does not end the night", () => {
    const l = run({ ticks: 100, scenario: bare({ lanterns: lanterns(2), time_left_s: 1 }) });
    expect(events(l, "game_over")[0].data).toEqual({ result: "lost", reason: "dawn" });
    expect(end(run({ ticks: 30, scenario: bare({ lanterns: lanterns(5) }) })).state).toBe("playing");
  });

  it("losing the last flame on the dawn tick is no_flames", () => {
    const l = run({ ticks: 5, scenario: bare({ player: { flames: 1 }, lanterns: lanterns(5), shades: [{ id: "S1", pos: [0.5, 0, 0] }], time_left_s: 1 / 60 }) });
    expect(events(l, "game_over")[0]).toMatchObject({ tick: 1, data: { result: "lost", reason: "no_flames" } });
  });

  it("thresholds: Night 2 needs 4/6, Night 3 needs 5/7", () => {
    const lit = (night: 2 | 3, n: number) => {
      const ids = Array.from({ length: night === 2 ? 6 : 7 }, (_, i) => `L${i + 1}`);
      const sc = bare({ lanterns: ids.map((id, i) => (i < n ? { id, lit: true } : { id })), time_left_s: 1 / 60, player: { pos: night === 3 ? [0, 0, -30] : [0, 0, 0] } });
      return end(run({ ticks: 2, night, scenario: sc })).state;
    };
    expect([lit(2, 3), lit(2, 4), lit(3, 4), lit(3, 5)]).toEqual(["lost", "won", "lost", "won"]);
  });
});

describe("capacity", () => {
  it("10 + 2 x successful_lights, max 20; reset each night", () => {
    expect(run({ ticks: 0, scenario: bare({ player: { successful_lights: 3 } }) })[0].player.capacity).toBe(16);
    expect(run({ ticks: 0, scenario: bare({ player: { successful_lights: 9 } }) })[0].player.capacity).toBe(20);
    expect(run({ ticks: 0, night: 2 })[0].player.capacity).toBe(10);
    const pick = run({ ticks: 1, scenario: bare({ player: { carried: 10, successful_lights: 1 }, motes: [[0, 0, 0]] }) });
    expect(events(pick, "mote_picked")[0].data.carried).toBe(11);
  });

  it("scenario pre-lit lanterns do not count as successful lights", () => {
    expect(run({ ticks: 0, scenario: bare({ lanterns: [at("L1", [0, 0, 20], { lit: true })] }) })[0].player.capacity).toBe(10);
  });
});
