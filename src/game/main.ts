// Windowed game: 3-night campaign, fixed 60 Hz simulation (same Game class as headless), Three.js view, HUD, menus, audio.
import { Game } from "../sim/game";
import { MAPS } from "../sim/maps";
import { DT } from "../sim/tuning";
import { Audio, loadSettings, saveSettings } from "./audio";
import { Controls } from "./controls";
import { View } from "./view";

const $ = (id: string) => document.getElementById(id)!;
const view = new View($("app"));
const controls = new Controls(view.renderer.domElement);
const audio = new Audio();
const settings = loadSettings();
audio.setVolume(settings.volume);
controls.sensitivity = settings.sensitivity;

const LINES: Record<1 | 2 | 3, string> = {
  1: "Mây à, sương đen đã nuốt Đảo Bến. Gom đom đóm, thắp lại năm ngọn đèn trước khi trời sáng nhé.",
  2: "Hai hòn đảo nối nhau bằng cây cầu tre. Coi chừng Gió Lạc, chúng thích cướp ánh sáng của con đấy. Bục gỗ sẽ bắn con sang đảo bên kia.",
  3: "Đảo Chuông cao và lộng gió. Nghe tiếng lá bay là gió sắp nổi, đứng cho vững! Lên tầng cao bằng dốc hoặc bục nhảy.",
};

type Screen = "menu" | "intro" | "play" | "pause" | "settings" | "result" | "dawn";
let screen: Screen = "menu";
let settingsBack: Screen = "menu";
let night: 1 | 2 | 3 = 1;
let game = new Game({ seed: 1, night: 1 });
let wonScores: number[] = [];
let pendingPause = false;
let acc = 0;
let last = performance.now();
let lastCountdown = -1;
view.load(game);

// ------------------------------------------------------------------ screens
function card(html: string, bind: Record<string, () => void> = {}): void {
  $("card").innerHTML = html;
  $("overlay").classList.remove("hidden");
  for (const [id, fn] of Object.entries(bind)) $(id).addEventListener("click", () => { audio.start(); fn(); });
}
function hideCard(): void { $("overlay").classList.add("hidden"); }
const total = () => wonScores.reduce((a, b) => a + b, 0);

function showMenu(): void {
  screen = "menu";
  $("hudroot").classList.add("hidden");
  card(`<h1>Đảo Đèn Lồng</h1>
    <p>Giúp Mây gom đom đóm, thắp lại Đèn Lồng Lớn trên ba hòn đảo và né Bóng Mực trong sương đen.</p>
    <p><kbd>WASD</kbd> đi · <kbd>Space</kbd> nhảy · <kbd>Shift</kbd> lướt · <kbd>E</kbd> nạp đèn · <kbd>F</kbd> tỏa sáng<br/>
    Kéo chuột / <kbd>←</kbd><kbd>→</kbd> xoay camera · <kbd>Esc</kbd>/<kbd>P</kbd> tạm dừng</p>
    <button id="b-start">Bắt đầu</button><button class="ghost" id="b-set">Cài đặt</button>
    <p style="font-size:13px">Chơi thử từng đêm: <button class="ghost" id="b-n1">Đêm 1</button><button class="ghost" id="b-n2">Đêm 2</button><button class="ghost" id="b-n3">Đêm 3</button></p>`,
  {
    "b-start": () => { wonScores = []; showIntro(1); },
    "b-set": () => showSettings("menu"),
    "b-n1": () => { wonScores = []; showIntro(1); },
    "b-n2": () => { wonScores = []; showIntro(2); },
    "b-n3": () => { wonScores = []; showIntro(3); },
  });
}

function showIntro(n: 1 | 2 | 3): void {
  night = n;
  screen = "intro";
  game = new Game({ seed: (Math.random() * 2 ** 31) | 0, night: n });
  view.load(game);
  $("hudroot").classList.add("hidden");
  card(`<h2>Đêm ${n}</h2><h1>${MAPS[n].name}</h1><p class="quote"><b>Ông Đăng:</b> “${LINES[n]}”</p>
    <button id="b-go">Vào đêm</button>`, { "b-go": startNight });
}

function startNight(): void {
  screen = "play";
  hideCard();
  $("hudroot").classList.remove("hidden");
  controls.reset();
  acc = 0;
  lastCountdown = -1;
}

function togglePause(): void {
  if (screen === "play") {
    pendingPause = true; // the simulation pauses through the contract's pause input
    showPauseMenu();
  } else if (screen === "pause") resume();
}
function showPauseMenu(): void {
  screen = "pause";
  card(`<h1>Tạm dừng</h1><button id="b-cont">Tiếp tục</button><button class="ghost" id="b-retry">Chơi lại Đêm</button>
    <button class="ghost" id="b-set">Cài đặt</button><button class="ghost" id="b-menu">Về menu</button>`,
  { "b-cont": resume, "b-retry": () => showIntro(night), "b-set": () => showSettings("pause"), "b-menu": showMenu });
}
function resume(): void {
  pendingPause = true;
  startNight();
}
controls.onPause = togglePause;

function showSettings(back: Screen): void {
  settingsBack = back;
  screen = "settings";
  card(`<h1>Cài đặt</h1>
    <label>Âm lượng: <span id="v-vol">${Math.round(settings.volume * 100)}</span>%</label>
    <input id="s-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}" />
    <label>Độ nhạy chuột: <span id="v-sen">${settings.sensitivity.toFixed(2)}</span></label>
    <input id="s-sen" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}" />
    <button id="b-back">Xong</button>`, { "b-back": () => (settingsBack === "pause" ? showPauseMenu() : showMenu()) });
  ($("s-vol") as HTMLInputElement).addEventListener("input", (e) => {
    settings.volume = Number((e.target as HTMLInputElement).value);
    $("v-vol").textContent = String(Math.round(settings.volume * 100));
    audio.setVolume(settings.volume); saveSettings(settings);
  });
  ($("s-sen") as HTMLInputElement).addEventListener("input", (e) => {
    settings.sensitivity = Number((e.target as HTMLInputElement).value);
    $("v-sen").textContent = settings.sensitivity.toFixed(2);
    controls.sensitivity = settings.sensitivity; saveSettings(settings);
  });
}

function showResult(): void {
  screen = "result";
  $("hudroot").classList.add("hidden");
  if (game.state === "won") {
    wonScores[night - 1] = game.score;
    audio.play("win");
    if (night === 3) return showDawn();
    card(`<h2>Đêm ${night} hoàn thành</h2><h1>${MAPS[night].name} đã sáng!</h1><p>Điểm đêm này: <b>${game.score}</b> · Tổng: <b>${total()}</b></p>
      <button id="b-next">Đêm ${night + 1}</button>`, { "b-next": () => showIntro((night + 1) as 2 | 3) });
  } else {
    audio.play("lose");
    const why = game.endReason === "dawn" ? "Trời đã sáng trước khi thắp đủ đèn." : "Mây đã hết Ngọn Lửa.";
    card(`<h1>Ánh sáng đã tắt…</h1><p>${why}</p><p>Tổng điểm các đêm đã thắng: <b>${total()}</b></p>
      <button id="b-retry">Chơi lại Đêm ${night}</button><button class="ghost" id="b-menu">Về menu</button>`,
    { "b-retry": () => showIntro(night), "b-menu": showMenu });
  }
}

function showDawn(): void {
  screen = "dawn";
  $("hudroot").classList.add("hidden");
  card(`<h1>🌅 Bình Minh</h1><p>Ba hòn đảo đã sáng trở lại. Ông Đăng mỉm cười: “Giỏi lắm, Mây!”</p>
    <p>Tổng điểm: <b style="color:var(--gold);font-size:22px">${total()}</b></p>
    <p style="font-size:14px">Đêm 1: ${wonScores[0] ?? "—"} · Đêm 2: ${wonScores[1] ?? "—"} · Đêm 3: ${wonScores[2] ?? "—"}</p>
    <button id="b-menu">Về menu</button>`, { "b-menu": showMenu });
}

addEventListener("keydown", (e) => {
  if (e.code !== "Enter") return;
  const btn = $("card").querySelector("button");
  if (!$("overlay").classList.contains("hidden") && btn) (btn as HTMLButtonElement).click();
});

// ------------------------------------------------------------------ HUD
const bar = $("bar");
for (let i = 0; i < 10; i++) bar.appendChild(document.createElement("i"));
function hud(): void {
  const p = game.player, t = game.t;
  $("flames").textContent = "🔥".repeat(p.flames) + "·".repeat(Math.max(0, t.flames - p.flames));
  const secs = Math.ceil(game.timeLeftS);
  $("clock").textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  $("clock").classList.toggle("danger", secs <= 30);
  const lit = game.lanterns.filter((l) => l.lit).length;
  $("topright").innerHTML = `Đèn <b>${lit}/${game.lanterns.length}</b><br/>Điểm <b>${total() + game.score}</b>`;
  bar.querySelectorAll("i").forEach((el, i) => el.classList.toggle("on", i < p.carried));
  const cd = (id: string, ticks: number, full: number) => ($(id) as HTMLElement).style.setProperty("--p", `${(ticks / full) * 100}%`);
  cd("cd-dash", p.charmTicks > 0 ? 0 : p.dashCdTicks, 90);
  cd("cd-pulse", p.carried < t.pulse_cost ? 180 : p.pulseCdTicks, 180);
  $("charmhud").style.display = p.charmTicks > 0 ? "block" : "none";
  $("charmhud").textContent = `🧧 Bùa Gió ${(p.charmTicks / 60).toFixed(1)}s`;
  $("wind").style.display = game.windWarning || game.windActiveTicks > 0 ? "block" : "none";
  $("wind").textContent = game.windActiveTicks > 0 ? "🍃 Gió mạnh!" : "🍃 Gió sắp nổi…";

  // hint near an unlit lantern + arrow to the nearest unlit lantern when it is off-screen
  const unlit = game.lanterns.filter((l) => !l.lit);
  const near = unlit.find((l) => Math.hypot(l.x - p.x, l.z - p.z) <= t.interact_radius && Math.abs(l.y - p.y) <= 1.5);
  $("hint").style.display = near ? "block" : "none";
  if (near) $("hint").textContent = `E — Nạp ánh sáng (${near.deposited}/${t.lantern_cost})`;
  const arrow = $("arrow");
  const target = unlit.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (target) {
    const s = view.project(target.x, target.y + 3, target.z);
    const off = s.behind || s.x < 0 || s.x > innerWidth || s.y < 0 || s.y > innerHeight;
    arrow.style.display = off ? "block" : "none";
    if (off) {
      const cx = innerWidth / 2, cy = innerHeight / 2;
      let dx = s.x - cx, dy = s.y - cy;
      if (s.behind) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const r = Math.min(innerWidth, innerHeight) * 0.4;
      arrow.style.left = `${cx + Math.cos(ang) * r - 14}px`;
      arrow.style.top = `${cy + Math.sin(ang) * r - 15}px`;
      arrow.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
    }
  } else arrow.style.display = "none";
}

// ------------------------------------------------------------------ main loop
let frames = 0, fpsT = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (screen === "play" || screen === "pause" || screen === "settings") {
    acc += dt;
    while (acc >= DT && (game.state === "playing" || game.state === "paused")) {
      const input = screen === "play" ? controls.sample(DT) : { move: [0, 0] as [number, number], camYawDeg: controls.camYawDeg, jump: false, interact: false, pulse: false, dash: false, pause: false };
      if (pendingPause) { input.pause = true; pendingPause = false; }
      const wasGrounded = game.player.grounded;
      game.step(input);
      if (wasGrounded && !game.player.grounded && game.player.vy > 5) audio.play("jump");
      for (const e of game.events) {
        const n = e.event.name;
        if (n === "pulse") { view.pulse(); audio.play("pulse"); }
        else if (n === "mote_picked") audio.play("pick");
        else if (n === "lantern_lit") audio.play("lit");
        else if (n === "player_hit") audio.play("hit");
        else if (n === "dash") audio.play("dash");
        else if (n === "shade_spawned") audio.play("shade");
        else if (n === "charm_picked") audio.play("charm");
        else if (n === "drifter_steal") audio.play("steal");
      }
      if (game.windWarning && (game.simTick % 1800) === 1800 - 120) audio.play("wind");
      const secs = Math.ceil(game.timeLeftS);
      if (secs <= 10 && secs !== lastCountdown && game.state === "playing") { lastCountdown = secs; audio.play("tick"); }
      acc -= DT;
    }
    if (game.state === "won" || game.state === "lost") showResult();
  }
  view.render(game, controls.camYawDeg, now / 1000, dt);
  if (screen === "play") hud();
  frames++;
  if (now - fpsT >= 1000) {
    $("fps").textContent = `${Math.round((frames * 1000) / (now - fpsT))} FPS · ${innerWidth}×${innerHeight} · ${view.quality}`;
    frames = 0; fpsT = now;
  }
  requestAnimationFrame(frame);
}

showMenu();
requestAnimationFrame(frame);
