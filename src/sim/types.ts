export type GameState = "playing" | "won" | "lost";
export type ShadeState = "chase" | "stunned";

/** One tick of player intent, exactly as the Test Contract describes it. */
export interface InputState {
  move: [number, number];
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}

export const NEUTRAL_INPUT: InputState = {
  move: [0, 0],
  camYawDeg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
};

export interface Player {
  x: number;
  y: number;
  z: number;
  vy: number;
  grounded: boolean;
  flames: number;
  carried: number;
  invulnTicks: number;
  pulseCdTicks: number;
  /** last facing direction on XZ (render only, not in contract output) */
  faceX: number;
  faceZ: number;
}

export interface Lantern {
  id: string;
  x: number;
  z: number;
  lit: boolean;
  deposited: number;
}

export interface Shade {
  id: string;
  x: number;
  z: number;
  stunTicks: number;
}

export interface Mote {
  id: string;
  x: number;
  z: number;
}

export type GameEvent =
  | { name: "mote_picked"; data: { carried: number } }
  | { name: "deposit"; data: { lantern_id: string; amount: number; deposited: number } }
  | { name: "lantern_lit"; data: { lantern_id: string } }
  | { name: "pulse"; data: { stunned_ids: string[] } }
  | { name: "player_hit"; data: { by: "shade" | "fall"; flames: number; dropped: number } }
  | { name: "shade_spawned"; data: { id: string } }
  | { name: "game_over"; data: { result: "won" | "lost"; reason: "all_lit" | "dawn" | "no_flames" } };

export interface TickEvent {
  tick: number;
  event: GameEvent;
}
