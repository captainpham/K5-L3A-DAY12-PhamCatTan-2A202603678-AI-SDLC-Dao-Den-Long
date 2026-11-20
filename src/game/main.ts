// Windowed game: fixed 60 Hz simulation (same Game class as headless) + Three.js rendering + HUD.
import { Game } from "../sim/game";
import { DT } from "../sim/tuning";
import { Controls } from "./controls";
import { View } from "./view";

const $ = (id: string) => document.getElementById(id)!;
const view = new View($("app"));
const controls = new Controls(view.renderer.domElement);

let game: Game;
let running = false;
let acc = 0;
let last = performance.now();

function newGame(): void {
  game = new Game({ seed: (Math.random() * 2 ** 31) | 0 });
  view.bind(game);
  acc = 0;
}

function start(): void {
  newGame();
  controls.reset();
  running = true;
  $("overlay").classList.add("hidden");
}

controls.onRestart = start;
$("ov-btn").addEventListener("click", start);
addEventListener("keydown", (e) => {
  if (!running && (e.code === "Enter" || e.code === "Space")) start();
});

function showEnd(): void {
  running = false;
  const won = game.state === "won";
  $("ov-title").textContent = won ? "Đảo đã sáng trở lại!" : "Ánh sáng đã tắt…";
  const why = game.endReason === "dawn" ? "Trời đã sáng trước khi thắp đủ đèn." : game.endReason === "no_flames" ? "Mây đã hết lửa." : "Cả 5 Đèn Lồng Lớn đều đã sáng.";
  $("ov-text").textContent = `${why} Điểm: ${game.score}.`;
  $("ov-btn").textContent = "Chơi lại";
  $("overlay").classList.remove("hidden");
}

function hud(): void {
  const p = game.player, t = game.t;
  const lit = game.lanterns.filter((l) => l.lit).length;
  const secs = Math.ceil(game.timeLeftS);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
  const flames = "🔥".repeat(p.flames) || "—";
  const pulse = p.pulseCdTicks > 0 ? `${(p.pulseCdTicks / 60).toFixed(1)}s` : p.carried >= t.pulse_cost ? "sẵn sàng" : "thiếu sáng";
  $("hud").innerHTML = [
    `Lửa <b>${flames}</b>`,
    `Đom đóm <b>${p.carried}/${t.carry_capacity}</b>`,
    `Đèn <b>${lit}/${game.lanterns.length}</b>`,
    `Bình minh sau <b>${mm}:${ss}</b>`,
    `Điểm <b>${game.score}</b>`,
    `Tỏa sáng (F) <b>${pulse}</b>`,
  ].map((s) => `<span class="pill">${s}</span>`).join("");

  const near = game.lanterns.find((l) => !l.lit && Math.hypot(l.x - p.x, l.z - p.z) <= t.interact_radius);
  const hint = $("hint");
  if (near && running) {
    hint.style.display = "block";
    hint.textContent = p.carried > 0
      ? `E: nạp ánh sáng vào ${near.id} (${near.deposited}/${t.lantern_cost})`
      : `${near.id} cần ${t.lantern_cost - near.deposited} đom đóm nữa`;
  } else hint.style.display = "none";
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (running) {
    acc += dt;
    while (acc >= DT && game.state === "playing") {
      game.step(controls.sample(DT));
      for (const e of game.events) if (e.event.name === "pulse") view.pulse();
      acc -= DT;
    }
    if (game.state !== "playing") showEnd();
  }
  view.render(game, controls.camYawDeg, now / 1000, dt);
  hud();
  requestAnimationFrame(frame);
}

newGame();
requestAnimationFrame(frame);
