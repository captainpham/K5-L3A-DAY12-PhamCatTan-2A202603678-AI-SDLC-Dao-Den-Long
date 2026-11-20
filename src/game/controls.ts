// Keyboard/mouse -> contract InputState with remappable keys (Ticket-04). Buttons are latched so a quick tap between
// two ticks is never lost.
import type { InputState } from "../sim/types";

export type Action = "up" | "down" | "left" | "right" | "jump" | "dash" | "interact" | "pulse" | "pause";
export type Bindings = Record<Action, string>;

export const ACTIONS: { id: Action; label: string }[] = [
  { id: "up", label: "Đi tới" }, { id: "down", label: "Đi lùi" }, { id: "left", label: "Sang trái" }, { id: "right", label: "Sang phải" },
  { id: "jump", label: "Nhảy" }, { id: "dash", label: "Lướt" }, { id: "interact", label: "Tương tác (nạp / châm dầu)" },
  { id: "pulse", label: "Tỏa Sáng" }, { id: "pause", label: "Tạm dừng" },
];

export const DEFAULT_BINDINGS: Bindings = {
  up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", jump: "Space", dash: "ShiftLeft", interact: "KeyE", pulse: "KeyF", pause: "Escape",
};

/** pairs of actions bound to the same key */
export function conflicts(b: Bindings): [Action, Action][] {
  const out: [Action, Action][] = [];
  const ids = ACTIONS.map((a) => a.id);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (b[ids[i]] === b[ids[j]]) out.push([ids[i], ids[j]]);
  return out;
}

/** readable key name, e.g. KeyW -> W, ShiftLeft -> Shift trái */
export function keyName(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = { Space: "Space", ShiftLeft: "Shift trái", ShiftRight: "Shift phải", ControlLeft: "Ctrl trái", ControlRight: "Ctrl phải",
    AltLeft: "Alt trái", AltRight: "Alt phải", Escape: "Esc", Enter: "Enter", Tab: "Tab", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
  return map[code] ?? code;
}

export class Controls {
  camYawDeg = 0;
  sensitivity = 1;
  bindings: Bindings = { ...DEFAULT_BINDINGS };
  /** while set, the next key press is handed to it (key remapping) instead of the game */
  capture: ((code: string) => void) | null = null;
  private held = new Set<string>();
  private latched = new Set<string>();
  private dragging = false;
  private lastX = 0;
  onPause: () => void = () => {};

  constructor(el: HTMLElement) {
    addEventListener("keydown", (e) => {
      const k = e.code;
      if (this.capture) { e.preventDefault(); const c = this.capture; this.capture = null; c(k); return; }
      if (k === "Space" || k.startsWith("Arrow") || k === "Tab") e.preventDefault();
      if (k === this.bindings.pause && !e.repeat) this.onPause();
      if (!this.held.has(k)) this.latched.add(k);
      this.held.add(k);
    });
    addEventListener("keyup", (e) => this.held.delete(e.code));
    addEventListener("blur", () => this.held.clear());
    el.addEventListener("pointerdown", (e) => { this.dragging = true; this.lastX = e.clientX; });
    addEventListener("pointerup", () => (this.dragging = false));
    addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.camYawDeg -= (e.clientX - this.lastX) * 0.3 * this.sensitivity;
      this.lastX = e.clientX;
    });
  }

  reset(): void { this.latched.clear(); this.held.clear(); }

  private on(a: Action): boolean {
    const c = this.bindings[a];
    return this.held.has(c) || this.latched.has(c);
  }

  /** Called once per simulation tick. Camera: right of screen is move x = -1 (contract rotation). */
  sample(dt: number): InputState {
    if (this.held.has("ArrowLeft")) this.camYawDeg += 120 * dt * this.sensitivity;
    if (this.held.has("ArrowRight")) this.camYawDeg -= 120 * dt * this.sensitivity;
    const z = (this.on("up") ? 1 : 0) - (this.on("down") ? 1 : 0);
    const x = (this.on("left") ? 1 : 0) - (this.on("right") ? 1 : 0);
    const input: InputState = {
      move: [x, z], camYawDeg: this.camYawDeg,
      jump: this.on("jump"), interact: this.on("interact"), pulse: this.on("pulse"), dash: this.on("dash"), pause: false,
    };
    this.latched.clear();
    return input;
  }
}
