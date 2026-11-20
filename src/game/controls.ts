// Keyboard/mouse -> contract InputState. Buttons are latched so a quick tap between two ticks is never lost.
import type { InputState } from "../sim/types";

export class Controls {
  camYawDeg = 0;
  sensitivity = 1;
  private held = new Set<string>();
  private latched = new Set<string>();
  private dragging = false;
  private lastX = 0;
  /** called on Esc / P (pause menu) */
  onPause: () => void = () => {};

  constructor(el: HTMLElement) {
    addEventListener("keydown", (e) => {
      const k = e.code;
      if (k === "Space" || k.startsWith("Arrow")) e.preventDefault();
      if ((k === "Escape" || k === "KeyP") && !e.repeat) this.onPause();
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

  /** Forget pending taps (e.g. the key press that closed a menu must not trigger an action). */
  reset(): void {
    this.latched.clear();
    this.held.clear();
  }

  private on(...codes: string[]): boolean {
    return codes.some((c) => this.held.has(c) || this.latched.has(c));
  }

  /** Called once per simulation tick. Camera: right of screen is move x = -1 (contract rotation). */
  sample(dt: number): InputState {
    if (this.held.has("ArrowLeft")) this.camYawDeg += 120 * dt * this.sensitivity;
    if (this.held.has("ArrowRight")) this.camYawDeg -= 120 * dt * this.sensitivity;
    const z = (this.on("KeyW", "ArrowUp") ? 1 : 0) - (this.on("KeyS", "ArrowDown") ? 1 : 0);
    const x = (this.on("KeyA") ? 1 : 0) - (this.on("KeyD") ? 1 : 0);
    const input: InputState = {
      move: [x, z],
      camYawDeg: this.camYawDeg,
      jump: this.on("Space"),
      interact: this.on("KeyE"),
      pulse: this.on("KeyF"),
      dash: this.on("ShiftLeft", "ShiftRight"),
      pause: false,
    };
    this.latched.clear();
    return input;
  }
}
