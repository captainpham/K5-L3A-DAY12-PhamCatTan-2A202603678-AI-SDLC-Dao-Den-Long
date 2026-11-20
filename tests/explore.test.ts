// Creative "Đảo lớn" explore maps (windowed game only): bigger, irregular, real mountains; gameplay spots intact.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Game } from "../src/sim/game";
import { MAPS } from "../src/sim/maps";
import { exploreMap, EXPLORE_SCALE } from "../src/sim/explore";
import { NEUTRAL_INPUT } from "../src/sim/types";

const nights = [1, 2, 3] as const;

describe("explore maps", () => {
  for (const n of nights) {
    const m = exploreMap(n), std = MAPS[n];

    it(`night ${n}: x2 bigger than the standard map, irregular coast`, () => {
      expect(m.bounds.maxX - m.bounds.minX).toBeGreaterThanOrEqual(2 * (std.bounds.maxX - std.bounds.minX));
      const r = Array.from({ length: 72 }, (_, i) => m.isles![0].coast((i / 72) * Math.PI * 2));
      expect(Math.max(...r) / Math.min(...r)).toBeGreaterThan(1.1);
    });

    it(`night ${n}: mountains 25-45 m on the island`, () => {
      expect(m.mountains!.length).toBeGreaterThanOrEqual(2);
      for (const mt of m.mountains!) {
        expect(mt.h).toBeGreaterThanOrEqual(25);
        expect(mt.h).toBeLessThanOrEqual(45);
        expect(m.ground(mt.x, mt.z)).toBeCloseTo(mt.h, 3);
      }
    });

    it(`night ${n}: every gameplay spot is on land; lanterns, pads, charms, start keep their standard height`, () => {
      const flat: [number, number, number][] = [
        ...m.lanterns.map((l) => l.pos), ...m.charms.map((c) => c.pos), m.start,
        ...m.pads.map((p) => [p.x, p.y, p.z] as [number, number, number]),
      ];
      for (const [x, y, z] of flat) expect(m.ground(x, z)).toBe(y);
      // spawn points may be on a mountain slope: their Y is the ground there
      for (const [x, y, z] of [...m.moteSpawns, ...m.shadeSpawns]) expect(m.ground(x, z)).toBeCloseTo(y, 6);
      expect(m.lanterns.map((l) => l.pos)).toEqual(std.lanterns.map((l) => [l.pos[0] * EXPLORE_SCALE, l.pos[1], l.pos[2] * EXPLORE_SCALE]));
    });
  }

  const fly = (n: 2 | 3, pad: number) => {
    const map = exploreMap(n), p = map.pads[pad];
    const g = new Game({ seed: 1, night: n, map });
    g.randomShades = false; g.randomDrifters = false;
    [g.player.x, g.player.y, g.player.z] = [p.x, p.y, p.z];
    for (let i = 0; i < 240 && g.player.fallWaitTicks === 0; i++) g.step(NEUTRAL_INPUT);
    return g;
  };

  it("night 2 pads (x2 push) still land on the other island", () => {
    const a = fly(2, 0);
    expect(a.player.fallWaitTicks).toBe(0);
    expect(a.player.flames).toBe(3);
    expect(a.player.x).toBeGreaterThan(100); // island B centre is at x = 140
    const b = fly(2, 1);
    expect(b.player.flames).toBe(3);
    expect(b.player.x).toBeLessThan(40);
  });

  it("night 3 pad still lands on tier 2 (Y = 6)", () => {
    const g = fly(3, 0);
    expect(g.player.y).toBe(6);
    expect(g.player.flames).toBe(3);
  });

  it("Mây can climb a mountain", () => {
    const map = exploreMap(1), mt = map.mountains![0];
    const g = new Game({ seed: 1, night: 1, map });
    g.randomShades = false;
    const a = Math.atan2(mt.z, mt.x);
    [g.player.x, g.player.z] = [mt.x + Math.cos(a) * (mt.r + 1), mt.z + Math.sin(a) * (mt.r + 1)];
    g.player.y = map.ground(g.player.x, g.player.z)!;
    // walk toward the peak: world dir = (sin yaw, cos yaw) for move [0, 1]
    const dx = mt.x - g.player.x, dz = mt.z - g.player.z;
    const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
    let top = 0; // walking straight on crosses the summit, so track the highest point reached
    for (let i = 0; i < 300; i++) { g.step({ ...NEUTRAL_INPUT, move: [0, 1], camYawDeg: yaw }); top = Math.max(top, g.player.y); }
    expect(top).toBeGreaterThan(mt.h * 0.8);
    expect(g.player.flames).toBe(3);
  });

  it("the headless bundle never contains the explore maps", () => {
    expect(readFileSync("dist/headless.cjs", "utf8")).not.toMatch(/exploreMap|đảo lớn/);
  });
});
