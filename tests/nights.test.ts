// Night 2 (Đảo Cau) and Night 3 (Đảo Chuông): standard maps, jump pads, ramps, cliffs, tower, wind, drifters, charms.
import { describe, expect, it } from "vitest";
import { bare, end, events, run, snapAt, snaps } from "./helpers";

describe("Night 2 — Đảo Cau", () => {
  it("6 lanterns at the standard positions, 330 s, charm C1 at (35,0,0)", () => {
    const s = run({ ticks: 0, night: 2 })[0];
    expect(s.lanterns.map((l: any) => l.pos)).toEqual([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]);
    expect(s.time_left_s).toBe(330);
    expect(s.charms).toEqual([{ id: "C1", available: true, respawn_s: 0 }]);
  });

  it("bamboo bridge connects the islands; stepping off the bridge side falls", () => {
    const walk = run({ ticks: 600, night: 2, snapshotEvery: 60, scenario: bare({ player: { pos: [20, 0, 0] } }), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }, { tick: 500, move: [0, 0] }] } });
    expect(events(walk, "player_hit")).toHaveLength(0);
    expect(snapAt(walk, 600).player.pos[0]).toBeCloseTo(70, 0);
    const off = run({ ticks: 200, night: 2, scenario: bare({ player: { pos: [35, 0, 0] } }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
    expect(events(off, "player_hit")[0].data.by).toBe("fall");
  });

  it("jump pad (20,0,18) launches toward island B and lands on it after ~1.4 s", () => {
    const l = run({ ticks: 120, night: 2, snapshotEvery: 1, scenario: bare({ player: { pos: [20, 0, 18] } }) });
    const s1 = snapAt(l, 1).player;
    expect(s1.grounded).toBe(false);
    expect(Math.hypot(s1.vel[0], s1.vel[2])).toBeCloseTo(24, 3);
    const landed = snaps(l).find((s) => s.tick > 1 && s.player.grounded)!;
    expect(landed.tick).toBeGreaterThan(80);
    expect(landed.tick).toBeLessThan(90);
    expect(Math.hypot(landed.player.pos[0] - 70, landed.player.pos[2])).toBeLessThan(28);
    expect(events(l, "player_hit")).toHaveLength(0);
  });

  it("charm: speed 7.2 m/s for 600 ticks, dash without cooldown, respawns after 2700 ticks", () => {
    const sc = bare({ player: { pos: [35, 0, -1] }, charms: [{ id: "C1" }] });
    const l = run({ ticks: 61, night: 2, snapshotEvery: 1, scenario: sc, inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 1, move: [1, 0] }] } });
    const pick = events(l, "charm_picked")[0];
    expect(pick).toMatchObject({ tick: 1, data: { charm_id: "C1", charm_ticks: 600 } });
    const x0 = snapAt(l, 1).player.pos[0];
    expect(snapAt(l, 61).player.pos[0] - x0).toBeCloseTo(7.2, 2);
    expect(snapAt(l, 1).charms[0]).toEqual({ id: "C1", available: false, respawn_s: 45 });
    const dash = run({ ticks: 40, night: 2, scenario: bare({ player: { charm_ticks: 600 } }), inputs: { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 20, dash: true }] } });
    expect(events(dash, "dash").map((e) => e.tick)).toEqual([1, 21]); // press during a dash is ignored, no cooldown after
  });

  it("drifter: chases when carrying >= 5 within 15 m, steals min(3, carried) once, flees 240 ticks then disappears", () => {
    const l = run({ ticks: 400, night: 2, snapshotEvery: 1, scenario: bare({ player: { carried: 6 }, drifters: [{ id: "D1", pos: [10, 0, 0] }] }) });
    expect(snapAt(l, 1).drifters[0].state).toBe("chase");
    const steal = events(l, "drifter_steal")[0];
    expect(steal.data).toEqual({ drifter_id: "D1", amount: 3, carried: 3 });
    expect(snapAt(l, steal.tick).drifters[0]).toMatchObject({ state: "flee", stolen: 3 });
    expect(snapAt(l, steal.tick + 239).drifters).toHaveLength(1);
    expect(snapAt(l, steal.tick + 240).drifters).toHaveLength(0);
    expect(snapAt(l, 400).player.flames).toBe(3); // drifters never cost flames
    const idle = run({ ticks: 10, night: 2, scenario: bare({ player: { carried: 4 }, drifters: [{ id: "D1", pos: [10, 0, 0] }] }) });
    expect(snapAt(idle, 10).drifters[0].state).toBe("idle");
  });

  it("pulse on a fleeing drifter with loot drops it as dropped motes (drifter_drop) and it vanishes after 120 ticks", () => {
    const sc = bare({ player: { carried: 3 }, drifters: [{ id: "D1", pos: [2, 0, 0], state: "flee", stolen: 3 }] });
    const l = run({ ticks: 130, night: 2, snapshotEvery: 1, scenario: sc, inputs: press0("pulse") });
    expect(events(l, "drifter_drop")[0]).toMatchObject({ tick: 1, data: { drifter_id: "D1", amount: 3 } });
    expect(snapAt(l, 1).motes.filter((m: any) => m.kind === "dropped")).toHaveLength(3);
    expect(snapAt(l, 120).drifters).toHaveLength(1);
    expect(snapAt(l, 121).drifters).toHaveLength(0);
    const chase = run({ ticks: 3, night: 2, snapshotEvery: 1, scenario: bare({ player: { carried: 6 }, drifters: [{ id: "D1", pos: [3, 0, 0], state: "chase" }] }), inputs: press0("pulse") });
    expect(events(chase, "drifter_steal")).toHaveLength(0);
    expect(snapAt(chase, 3).drifters[0].state).toBe("flee");
  });

  it("drifters spawn at tick 1200 (D1), max 2", () => {
    const l = run({ ticks: 3700, night: 2, snapshotEvery: 100, scenario: { random_shades: false, random_motes: false } });
    expect(snapAt(l, 1100).drifters).toHaveLength(0);
    expect(snapAt(l, 1200).drifters.map((d: any) => d.id)).toEqual(["D1"]);
    expect(snapAt(l, 3700).drifters.length).toBeLessThanOrEqual(2);
  });
});

function press0(btn: string) {
  return { frames: [{ tick: 0, [btn]: true }] };
}

describe("Night 3 — Đảo Chuông", () => {
  it("7 lanterns at the standard positions, 360 s, shades at 4.5 m/s", () => {
    const s = run({ ticks: 0, night: 3 })[0];
    expect(s.lanterns.map((l: any) => l.pos)).toEqual([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]);
    expect(s.time_left_s).toBe(360);
    const l = run({ ticks: 60, night: 3, scenario: bare({ player: { pos: [0, 0, -30] }, shades: [{ id: "S1", pos: [10, 0, -30] }] }) });
    expect(snapAt(l, 60).shades[0].pos[0]).toBeCloseTo(5.5, 3);
  });

  it("ramp at 30° climbs from r=30 (Y=0) to tier 1 (Y=3)", () => {
    // start at the ramp foot facing inward along the ramp: direction (-cos30, -sin30)
    const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
    const yaw = (Math.atan2(-c, -s) * 180) / Math.PI; // move [0,1] -> world (sin yaw, cos yaw)
    const l = run({ ticks: 120, night: 3, snapshotEvery: 1, scenario: bare({ player: { pos: [31 * c, 0, 31 * s] } }), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: yaw }] } });
    expect(snapAt(l, 120).player.pos[1]).toBeCloseTo(3, 3);
    expect(snapAt(l, 120).player.grounded).toBe(true);
  });

  it("tier cliffs block walking up (no ramp at 90°)", () => {
    const l = run({ ticks: 120, night: 3, scenario: bare({ player: { pos: [0, 0, 30] } }), inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
    const p = snapAt(l, 120).player;
    expect(p.pos[1]).toBe(0);
    expect(p.pos[2]).toBeGreaterThanOrEqual(24 - 1e-6);
  });

  it("jump pad (0,3,13) launches onto tier 2 (Y=6)", () => {
    const l = run({ ticks: 120, night: 3, snapshotEvery: 1, scenario: bare({ player: { pos: [0, 3, 13] } }) });
    const p = snapAt(l, 120).player;
    expect(p.pos[1]).toBe(6);
    expect(Math.hypot(p.pos[0], p.pos[2])).toBeLessThanOrEqual(8);
  });

  it("bell tower (r = 2) blocks movement", () => {
    const l = run({ ticks: 60, night: 3, scenario: bare({ player: { pos: [0, 6, 6] } }), inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
    expect(snapAt(l, 60).player.pos[2]).toBeGreaterThanOrEqual(2 - 1e-6);
  });

  it("wind: every 30 s a 5 s gust pushes 2 m/s (snapshot wind.active)", () => {
    const l = run({ ticks: 2100, night: 3, snapshotEvery: 100, scenario: bare({ wind_enabled: true }) });
    expect(snapAt(l, 1700).wind.active).toBe(false);
    expect(snapAt(l, 1800).wind.active).toBe(true);
    const p = snapAt(l, 2100).player.pos;
    expect(Math.hypot(p[0], p[2] + 30)).toBeCloseTo(2 * 5, 0);
    expect(snapAt(l, 2100).wind.active).toBe(false);
  });

  it("full night runs headless well under 30 s", () => {
    const t0 = Date.now();
    const l = run({ ticks: 21600, night: 3, snapshotEvery: 600 });
    expect(end(l).type).toBe("end");
    expect(Date.now() - t0).toBeLessThan(30000);
  });
});
