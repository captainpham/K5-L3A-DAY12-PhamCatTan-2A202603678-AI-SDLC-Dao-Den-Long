// Every tests/scenarios/*.json runs through the built CLI twice: expectations + determinism.
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM helper shared with scripts/proof.mjs
import { listScenarios, runScenario } from "../scripts/scenarios.mjs";
import { TUNING as T } from "../src/sim/tuning";

describe("headless scenarios", () => {
  for (const file of listScenarios() as string[]) {
    it(file, () => {
      const r = runScenario(file);
      expect(r.problems).toEqual([]);
      if (r.name === "05-safe-radius") {
        const lantern = [0, 25];
        for (const s of r.lines.filter((l: any) => l.type === "snapshot")) {
          for (const sh of s.shades) expect(Math.hypot(sh.pos[0] - lantern[0], sh.pos[2] - lantern[1])).toBeGreaterThan(T.safe_radius);
        }
      }
    });
  }
});
