// Single source of truth: the numbers the game uses are read from game.contract.json,
// so the declared tuning can never drift from the simulation.
import contract from "../../game.contract.json";

export type Tuning = typeof contract.tuning;
export const TUNING: Tuning = contract.tuning;

/** Simulation rate fixed by Test Contract v1.0. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/** World constants that are NOT part of the contract tuning (documented in docs/notes/assumptions.md). */
export const WORLD = {
  islandRadius: 40,
  lanternRingRadius: 25,
  jumpSpeed: 7,
  gravity: 20,
  shadeHoverY: 1,
  // random fireflies
  motesInitial: 25,
  motesMax: 30,
  moteRespawnS: 3,
  moteMinR: 3,
  moteMaxR: 37,
  // random ink shades
  shadeFirstS: 10,
  shadeEveryS: 20,
  shadeMax: 4,
  shadeSpawnR: 36,
  shadeMinDistToPlayer: 15,
} as const;
