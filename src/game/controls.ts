// Keyboard/mouse -> contract InputState. Buttons are latched so a quick tap between two ticks is never lost.
import type { InputState } from "../sim/types";

export class Controls {
  camYawDeg = 0;
  private held = new Set<string>();
  private latched = new Set<string>();
  private dragging = false;
  private lastX = 0;
  onRestart: () => void = () => {};

  constructor(el: HTMLElement) {
    addEventListener("keydown", (e) => {
      const k = e.code;
      if (k === "Space") e.preventDefault();
      if (k === "KeyR") this.onRestart();
      if (!this.held.has(k)) this.latched.add(k);
      this.held.add(k);
    });
    addEventListener("keyup", (e) => this.held.delete(e.code));
    addEventListener("blur", () => this.held.clear());
    el.addEventListener("pointerdown", (e) => { this.dragging = true; this.lastX = e.clientX; });
    addEventListener("pointerup", () => (this.dragging = false));
    addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.camYawDeg -= (e.clientX - this.lastX) * 0.3;
      this.lastX = e.clientX;
    });
  }

  private on(...codes: string[]): boolean {
    return codes.some((c) => this.held.has(c) || this.latched.has(c));
  }

  /** Forget pending taps (e.g. the Space press that started the game must not make Mây jump). */
  reset(): void {
    this.latched.clear();
    this.held.clear();
  }

  /** Called once per simulation tick. */
  sample(dt: number): InputState {
    if (this.held.has("ArrowLeft")) this.camYawDeg += 120 * dt;
    if (this.held.has("ArrowRight")) this.camYawDeg -= 120 * dt;
    // Camera looks along (sin yaw, cos yaw); with the contract's rotation, screen-right is move x = -1.
    const z = (this.on("KeyW", "ArrowUp") ? 1 : 0) - (this.on("KeyS", "ArrowDown") ? 1 : 0);
    const x = (this.on("KeyA") ? 1 : 0) - (this.on("KeyD") ? 1 : 0);
    const input: InputState = {
      move: [x, z],
      camYawDeg: this.camYawDeg,
      jump: this.on("Space"),
      interact: this.on("KeyE"),
      pulse: this.on("KeyF"),
      dash: false,
    };
    this.latched.clear();
    return input;
  }
}
