export type GameState = "playing" | "paused" | "won" | "lost";
export type ShadeState = "spawning" | "wander" | "chase" | "recoil" | "stunned";
export type DrifterState = "idle" | "chase" | "flee" | "removed";

/** One tick of player intent, exactly as the Test Contract describes it. */
export interface InputState {
  move: [number, number];
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export const NEUTRAL_INPUT: InputState = {
  move: [0, 0],
  camYawDeg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
};

export interface Player {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  grounded: boolean;
  faceX: number; faceZ: number;
  flames: number;
  carried: number;
  invulnTicks: number;
  dashCdTicks: number;
  dashTicksLeft: number;
  dashDirX: number; dashDirZ: number;
  pulseCdTicks: number;
  charmTicks: number;
  launched: boolean;
  launchVx: number; launchVz: number;
  fallWaitTicks: number;
}

export interface Lantern { id: string; x: number; y: number; z: number; lit: boolean; deposited: number }

export interface Shade {
  id: string;
  x: number; y: number; z: number; // y = centre
  state: ShadeState;
  stateTicks: number; // ticks left in spawning / recoil / stunned
  pushTicks: number; pushX: number; pushZ: number; // pulse knock-back (first 15 stun ticks)
  recoilX: number; recoilZ: number;
  wanderX: number; wanderZ: number; wanderTicks: number;
  expelTicks: number; expelLx: number; expelLz: number; // being pushed out of a freshly lit lantern
}

export interface Mote {
  id: string;
  x: number; y: number; z: number;
  kind: "random" | "dropped";
  ttl: number | null; // ticks, dropped only
  pickableFrom: number; // sim_tick from which it can be picked
}

export interface Drifter {
  id: string;
  x: number; y: number; z: number;
  state: DrifterState;
  stolen: number;
  fleeTicks: number;
  anchorX: number; anchorZ: number; angle: number;
}

export interface Charm { id: string; x: number; y: number; z: number; available: boolean; respawnTicks: number }

export type GameEvent =
  | { name: "night_start"; data: { night: number } }
  | { name: "mote_picked"; data: { carried: number } }
  | { name: "deposit"; data: { lantern_id: string; amount: number; deposited: number } }
  | { name: "lantern_lit"; data: { lantern_id: string } }
  | { name: "pulse"; data: { stunned_ids: string[] } }
  | { name: "player_hit"; data: { by: "shade"; flames: number; dropped: number } | { by: "fall"; flames: number; dropped: number; lost: number } }
  | { name: "shade_spawned"; data: { id: string } }
  | { name: "dash"; data: Record<string, never> }
  | { name: "charm_picked"; data: { charm_id: string; charm_ticks: number } }
  | { name: "drifter_steal"; data: { drifter_id: string; amount: number; carried: number } }
  | { name: "drifter_drop"; data: { drifter_id: string; amount: number } }
  | { name: "paused"; data: Record<string, never> }
  | { name: "resumed"; data: Record<string, never> }
  | { name: "game_over"; data: { result: "won" | "lost"; reason: "all_lit" | "dawn" | "no_flames" } };

export interface TickEvent {
  tick: number;
  event: GameEvent;
}
