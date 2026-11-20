// Ticket-02 standard palette: listed components must stay within 10% per RGB channel of the given hex.
import { describe, expect, it } from "vitest";
import { PALETTE } from "../src/game/models";

const TICKET: Record<string, number> = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, cloudSea: 0x12384a,
  lanternLit: 0xffb347, lanternCore: 0xffe9b0, lanternOff: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shadeBody: 0x120a1a, shadeRim: 0x7a3cff, shadeStunned: 0x3a3450, mayShirt: 0xe8e2d0, mayScarf: 0xc8102e,
  charm: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8, danger: 0xff5a5f, uiText: 0xf5f1e6,
};
const rgb = (h: number) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

describe("standard palette", () => {
  for (const [key, want] of Object.entries(TICKET)) {
    it(`${key} within 10% of #${want.toString(16).padStart(6, "0")}`, () => {
      const got = rgb((PALETTE as Record<string, number>)[key]);
      rgb(want).forEach((c, i) => expect(Math.abs(got[i] - c)).toBeLessThanOrEqual(25.5));
    });
  }
});
