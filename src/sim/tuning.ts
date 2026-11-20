// Single source of truth: the numbers the game uses are read from game.contract.json,
// so the declared tuning can never drift from the simulation.
import contract from "../../game.contract.json";

export type Tuning = typeof contract.tuning;
export const TUNING: Tuning = contract.tuning;

/** Simulation rate fixed by the Test Contract. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/** Ticket-02 standard numbers that are not contract tuning keys (all in ticks unless noted). */
export const STD = {
  jumpSpeed: 7,
  gravity: 20,
  pickupMaxDy: 1.5,
  hitMaxDy: 1.5,
  interactMaxDy: 1.5, // assumption: same height rule as pickup
  shadeCenterY: 1, // shade.pos is its centre, 1 m above its ground
  pulseCenterY: 0.8,
  pulsePushTicks: 15,
  shadeDetect: 12,
  shadeLose: 18,
  shadeWanderSpeed: 1.5, // assumption
  shadeWanderTurnTicks: 120, // assumption
  shadeSpawningTicks: 60, // assumption: length of the "spawning" state
  shadeFirstTick: 300,
  shadeFirstCount: 2,
  shadeMinDistToPlayer: 15,
  recoilTicks: 60,
  recoilDist: 2,
  expelTicks: 30,
  moteMax: 30,
  moteInitial: 20,
  moteEveryTicks: 240,
  dropRingMin: 1.5,
  dropRingMax: 2.5,
  dropTtl: 480,
  fallY: -10,
  fallWaitTicks: 60,
  charmTicks: 600,
  charmRespawnTicks: 2700,
  charmSpeed: 7.2,
  drifterSpeed: 7,
  drifterIdleSpeed: 2,
  drifterMax: 2,
  drifterEveryTicks: 1200,
  drifterChaseCarried: 5,
  drifterChaseDist: 15,
  drifterTouch: 1.2,
  drifterSteal: 3,
  drifterFleeTicks: 240,
  drifterDropFleeTicks: 120,
  drifterHoverY: 1.5,
  windEveryTicks: 1800,
  windTicks: 300,
  windWarnTicks: 120,
  windSpeed: 2,
  stepUp: 0.35, // max height the feet can step up/down without jumping/falling (ramps)
  towerTop: 14,
  // Ticket-03 numbers that are not contract tuning keys
  drainReach: 2, // a wander shade starts draining within 2 m (XZ) of its weak lantern
  drainChase: 6, // a draining shade chases Mây inside 6 m
  drainEventTicks: 60,
  scoreRelight: 40,
  scoreStunDraining: 15,
  scoreDawnLantern: 50,
  capacityPerLight: 2,
} as const;

export function nightDurationS(night: 1 | 2 | 3): number {
  return night === 1 ? TUNING.night1_duration_s : night === 2 ? TUNING.night2_duration_s : TUNING.night3_duration_s;
}
