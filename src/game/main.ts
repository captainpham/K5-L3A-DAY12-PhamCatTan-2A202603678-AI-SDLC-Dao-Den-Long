// Windowed game: 3-night campaign, fixed 60 Hz simulation (same Game class as headless), Three.js view, HUD, menus,
// audio, leaderboard, accessibility, and the Ticket-04 benchmark page (?bench=1).
import { Game } from "../sim/game";
import { MAPS, type NightMap } from "../sim/maps";
import { exploreMap } from "../sim/explore";
import { DT } from "../sim/tuning";
import { NEUTRAL_INPUT } from "../sim/types";
import { BENCH, benchCamera, benchStats, makeBenchGame } from "../sim/bench";
import { isoWithOffset, validName, type LeaderEntry } from "../sim/leaderboard";
import { Audio, loadSettings, saveSettings } from "./audio";
import { ACTIONS, Controls, DEFAULT_BINDINGS, conflicts, keyName, type Action } from "./controls";
import { loadBoard, saveEntry } from "./leaderboard-client";
import { ScreenRecorder, clock } from "./recorder";
import { View } from "./view";

const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);
const view = new View($("app"));

// ================================================================== benchmark page (Ticket-04)
if (params.get("bench") === "1") runBench();
else runGame();

function runBench(): void {
  const seed = Number(params.get("seed") ?? 42), duration = Number(params.get("duration") ?? 30);
  const game = makeBenchGame(seed);
  view.load(game, { decor: false }); // creative decor off: every submission measures the same standard scene
  $("fps").classList.add("hidden");
  $("overlay").classList.add("hidden"); // no menu card over the scene: the benchmark shows the bare 3D view
  const w = window as unknown as { __benchFirstFrame?: () => void; __benchDone?: (r: unknown) => void };
  const dts: number[] = [];
  let start = -1, last = 0, acc = 0, peakHeap = 0;
  const heap = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
  const frame = (now: number) => {
    if (start < 0) { start = now; last = now; w.__benchFirstFrame?.(); }
    const dt = now - last;
    last = now;
    const t = (now - start) / 1000;
    acc += Math.min(dt, 100) / 1000;
    while (acc >= DT) { game.step(NEUTRAL_INPUT); acc -= DT; } // shades keep wandering; no spawns, damage, pickup, fuel burn, end
    view.render(game, 0, now / 1000, dt / 1000, benchCamera(t));
    if (t > BENCH.warmupS) { dts.push(dt); peakHeap = Math.max(peakHeap, heap()); } // the 3 s warm-up is not measured
    if (t >= BENCH.warmupS + duration) {
      const r = { ...benchStats(dts), renderer: view.rendererInfo(), peak_js_heap_mb: peakHeap ? Math.round(peakHeap / 2 ** 20) : null };
      $("fps").textContent = JSON.stringify(r);
      w.__benchDone?.(r);
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// ================================================================== the game
function runGame(): void {
  const controls = new Controls(view.renderer.domElement);
  const audio = new Audio();
  const settings = loadSettings();
  audio.setVolume(settings.volume);
  controls.sensitivity = settings.sensitivity;
  controls.bindings = { ...settings.keys };
  const applySettings = () => {
    view.colorblind = settings.colorblind;
    view.reduceMotion = settings.reduceMotion;
    document.body.classList.toggle("cb", settings.colorblind);
    document.body.classList.toggle("calm", settings.reduceMotion);
    document.documentElement.classList.toggle("large", settings.largeText);
    $("k-dash").textContent = keyName(settings.keys.dash).replace(" trái", "").replace(" phải", "");
    $("k-pulse").textContent = keyName(settings.keys.pulse);
  };
  applySettings();
  const save = () => { saveSettings(settings); applySettings(); };

  const LINES: Record<1 | 2 | 3, string> = {
    1: "Mây à, sương đen đã nuốt Đảo Bến. Thắp đèn và giữ cho chúng cháy tới bình minh nhé. Đèn cạn dầu thì châm thêm đom đóm.",
    2: "Hai hòn đảo nối nhau bằng cây cầu tre. Coi chừng Gió Lạc, chúng thích cướp ánh sáng của con đấy. Bục gỗ sẽ bắn con sang đảo bên kia.",
    3: "Đảo Chuông cao và lộng gió. Nghe tiếng lá bay là gió sắp nổi, đứng cho vững! Lên tầng cao bằng dốc hoặc bục nhảy.",
  };

  type Screen = "menu" | "intro" | "play" | "pause" | "settings" | "result" | "dawn" | "board" | "name";
  let screen: Screen = "menu";
  let night: 1 | 2 | 3 = 1;
  /** creative "Đảo lớn" mode (windowed game only; headless is always the standard map) */
  let explore = false;
  const exploreCache: Partial<Record<1 | 2 | 3, NightMap>> = {};
  const mapFor = (n: 1 | 2 | 3) => (explore ? (exploreCache[n] ??= exploreMap(n)) : MAPS[n]);
  let campaignSeed = 1;
  let game = new Game({ seed: 1, night: 1 });
  let wonScores: number[] = [];
  let pendingPause = false;
  let acc = 0;
  let last = performance.now();
  let lastCountdown = -1;
  view.load(game);

  // ---------------------------------------------------------------- screens
  function card(html: string, bind: Record<string, () => void> = {}): void {
    $("card").innerHTML = html;
    $("overlay").classList.remove("hidden");
    for (const [id, fn] of Object.entries(bind)) $(id).addEventListener("click", () => { audio.start(); fn(); });
  }
  const hideCard = () => $("overlay").classList.add("hidden");
  const total = () => wonScores.reduce((a, b) => a + (b ?? 0), 0);
  const nightsWon = () => wonScores.filter((s) => s !== undefined).length;
  const k = (a: Action) => `<kbd>${keyName(settings.keys[a])}</kbd>`;

  function showMenu(): void {
    screen = "menu";
    $("hudroot").classList.add("hidden");
    card(`<h1>Đảo Đèn Lồng</h1>
      <p>Giúp Mây thắp và giữ sáng Đèn Lồng Lớn trên ba hòn đảo tới bình minh, né Bóng Mực trong sương đen.</p>
      <p>${k("up")}${k("left")}${k("down")}${k("right")} đi · ${k("jump")} nhảy · ${k("dash")} lướt · ${k("interact")} nạp / châm dầu · ${k("pulse")} tỏa sáng · ${k("pause")} tạm dừng · kéo chuột / <kbd>←</kbd><kbd>→</kbd> xoay camera</p>
      <p><button id="b-start">Bắt đầu · Đảo chuẩn</button><button id="b-big">Bắt đầu · Đảo lớn (khám phá)</button></p>
      <p>Đảo chuẩn = bản đồ của ticket. Đảo lớn = bản đồ to gấp đôi, núi cao 25–45 m (sáng tạo).</p>
      <button class="ghost" id="b-board">🏆 Bảng xếp hạng</button><button class="ghost" id="b-set">Cài đặt</button>
      <p>Chơi thử từng đêm: <button class="ghost" id="b-n1">Đêm 1</button><button class="ghost" id="b-n2">Đêm 2</button><button class="ghost" id="b-n3">Đêm 3</button></p>`,
    {
      "b-start": () => newCampaign(false, 1), "b-big": () => newCampaign(true, 1),
      "b-board": () => void showBoard(), "b-set": () => showSettings("menu"),
      "b-n1": () => newCampaign(false, 1), "b-n2": () => newCampaign(false, 2), "b-n3": () => newCampaign(false, 3),
    });
  }

  function newCampaign(big: boolean, n: 1 | 2 | 3): void {
    explore = big;
    wonScores = [];
    campaignSeed = (Math.random() * 2 ** 31) | 0;
    showIntro(n);
  }

  function showIntro(n: 1 | 2 | 3): void {
    night = n;
    screen = "intro";
    game = new Game({ seed: campaignSeed + n, night: n, map: explore ? mapFor(n) : undefined });
    view.load(game);
    $("hudroot").classList.add("hidden");
    card(`<h2>Đêm ${n}</h2><h1>${mapFor(n).name}</h1><p class="quote"><b>Ông Đăng:</b> “${LINES[n]}”</p>
      <p>Giữ ít nhất <b>${game.litNeeded}/${game.lanterns.length}</b> đèn sáng lúc bình minh.</p>
      <button id="b-go">Vào đêm</button><button class="ghost" id="b-back">← Quay lại</button>`, { "b-go": startNight, "b-back": showMenu });
    backAction = showMenu;
  }

  function startNight(): void {
    screen = "play";
    hideCard();
    $("hudroot").classList.remove("hidden");
    controls.reset();
    acc = 0;
    lastCountdown = -1;
  }

  // ---------------------------------------------------------------- screen recording button (demo video)
  const recBtn = $("btn-rec") as HTMLButtonElement;
  const recorder = new ScreenRecorder();
  if (ScreenRecorder.supported()) recBtn.classList.remove("hidden");
  recorder.onState = (on) => { recBtn.classList.toggle("on", on); recBtn.textContent = on ? "⏹ Dừng quay 00:00" : "⏺ Quay màn hình"; };
  recorder.onTick = (s) => { recBtn.textContent = `⏹ Dừng quay ${clock(s)}`; };
  recorder.onError = (msg) => caption(msg, true, 5000);
  recorder.onSaved = (s) => {
    caption(`Đã lưu ${s.name} (${(s.size / 2 ** 20).toFixed(1)} MB, ${clock(s.seconds)}) vào thư mục Tải xuống`, false, 7000);
    if (params.get("debug") === "1") Object.assign(window, { __lastRecording: s });
  };
  recBtn.addEventListener("click", () => {
    audio.start();
    if (recorder.recording) recorder.stop(); else void recorder.start();
    recBtn.blur(); // so Space / Enter in the game never toggle the recording
  });

  /** where "← Quay lại" / Esc goes from the current menu screen (set by each screen) */
  let backAction: (() => void) | null = null;
  function togglePause(): void {
    if (screen === "play") { pendingPause = true; showPauseMenu(); } // the simulation pauses through the contract's pause input
    else if (screen === "pause") resume();
    else if ((screen === "settings" || screen === "board" || screen === "intro") && backAction) backAction();
  }
  // the in-game back button opens the pause menu (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu)
  $("btn-back").addEventListener("click", () => { audio.start(); if (screen === "play") togglePause(); });
  function showPauseMenu(): void {
    screen = "pause";
    card(`<h1>Tạm dừng</h1><button id="b-cont">Tiếp tục</button><button class="ghost" id="b-retry">Chơi lại Đêm</button>
      <button class="ghost" id="b-set">Cài đặt</button><button class="ghost" id="b-menu">Về menu</button>`,
    { "b-cont": resume, "b-retry": () => showIntro(night), "b-set": () => showSettings("pause"), "b-menu": showMenu });
  }
  function resume(): void { pendingPause = true; startNight(); }
  controls.onPause = togglePause;

  function showSettings(back: Screen): void {
    screen = "settings";
    const dups = conflicts(settings.keys);
    const dupSet = new Set(dups.flat());
    const label = (a: Action) => ACTIONS.find((x) => x.id === a)!.label;
    card(`<h1>Cài đặt</h1>
      <label>Âm lượng: <span id="v-vol">${Math.round(settings.volume * 100)}</span>%</label>
      <input id="s-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}" />
      <label>Độ nhạy chuột: <span id="v-sen">${settings.sensitivity.toFixed(2)}</span></label>
      <input id="s-sen" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}" />
      <label><input id="s-cb" type="checkbox" ${settings.colorblind ? "checked" : ""} /> Bảng màu dễ phân biệt (mù màu)</label>
      <label><input id="s-rm" type="checkbox" ${settings.reduceMotion ? "checked" : ""} /> Giảm chuyển động (tắt rung camera, chớp màn hình)</label>
      <label><input id="s-lt" type="checkbox" ${settings.largeText ? "checked" : ""} /> Chữ lớn (×1.25)</label>
      <h2>Phím</h2>
      <div class="keys">${ACTIONS.map((a) => `<span>${a.label}</span><button class="ghost${dupSet.has(a.id) ? " dup" : ""}" id="kb-${a.id}">${keyName(settings.keys[a.id])}</button>`).join("")}</div>
      ${dups.length ? `<p class="warn">⚠ Trùng phím: ${dups.map(([x, y]) => `${label(x)} và ${label(y)} (${keyName(settings.keys[x])})`).join("; ")}</p>` : ""}
      <p id="kb-msg"></p>
      <button class="ghost" id="b-keyreset">Khôi phục mặc định</button><button id="b-back">← Quay lại</button>`,
    {
      "b-back": () => (back === "pause" ? showPauseMenu() : showMenu()),
      "b-keyreset": () => { settings.keys = { ...DEFAULT_BINDINGS }; controls.bindings = { ...settings.keys }; save(); showSettings(back); },
    });
    backAction = () => (back === "pause" ? showPauseMenu() : showMenu());
    const bindInput = (id: string, ev: string, fn: (el: HTMLInputElement) => void) => $(id).addEventListener(ev, (e) => fn(e.target as HTMLInputElement));
    bindInput("s-vol", "input", (el) => { settings.volume = Number(el.value); $("v-vol").textContent = String(Math.round(settings.volume * 100)); audio.setVolume(settings.volume); save(); });
    bindInput("s-sen", "input", (el) => { settings.sensitivity = Number(el.value); $("v-sen").textContent = settings.sensitivity.toFixed(2); controls.sensitivity = settings.sensitivity; save(); });
    bindInput("s-cb", "change", (el) => { settings.colorblind = el.checked; save(); });
    bindInput("s-rm", "change", (el) => { settings.reduceMotion = el.checked; save(); });
    bindInput("s-lt", "change", (el) => { settings.largeText = el.checked; save(); });
    for (const a of ACTIONS) {
      $(`kb-${a.id}`).addEventListener("click", () => {
        $(`kb-${a.id}`).textContent = "Nhấn phím…";
        $("kb-msg").textContent = `Nhấn phím mới cho "${a.label}"`;
        controls.capture = (code) => {
          settings.keys[a.id] = code;
          controls.bindings = { ...settings.keys };
          save();
          showSettings(back); // re-render: duplicates are highlighted and reported
        };
      });
    }
  }

  async function showBoard(after?: () => void): Promise<void> {
    screen = "board";
    const list = await loadBoard();
    const rows = list.map((e, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(e.name)}</td><td><b>${e.score}</b></td><td>${e.nights_won}/3</td><td>${e.achieved_at.slice(0, 16).replace("T", " ")}</td></tr>`).join("");
    card(`<h1>🏆 Bảng xếp hạng</h1>
      ${list.length ? `<table><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm</th><th>Lúc</th></tr>${rows}</table>` : "<p>Chưa có ai. Hãy là người đầu tiên!</p>"}
      <button id="b-menu">← Quay lại</button>`, { "b-menu": after ?? showMenu });
    backAction = after ?? showMenu;
  }

  function showNameEntry(then: () => void): void {
    screen = "name";
    card(`<h1>Lưu điểm</h1><p>Tổng điểm các đêm đã thắng: <b>${total()}</b> · Đêm thắng: <b>${nightsWon()}/3</b></p>
      <p><input id="i-name" type="text" maxlength="12" placeholder="Tên của bạn" autocomplete="off" /></p>
      <p>3–12 ký tự: chữ (có dấu tiếng Việt), số hoặc _</p><p id="name-msg" class="warn"></p>
      <button id="b-save">Lưu</button><button class="ghost" id="b-skip">Bỏ qua</button>`,
    {
      "b-save": async () => {
        const name = validName(($("i-name") as HTMLInputElement).value);
        if (!name) { $("name-msg").textContent = "Tên không hợp lệ (3–12 ký tự: chữ, số, _)."; return; }
        const entry: LeaderEntry = { name, score: total(), nights_won: nightsWon(), achieved_at: isoWithOffset(), seed: campaignSeed };
        await saveEntry(entry);
        void showBoard(then);
      },
      "b-skip": then,
    });
    controls.capture = null;
    setTimeout(() => ($("i-name") as HTMLInputElement | null)?.focus(), 50);
  }

  function showResult(): void {
    screen = "result";
    $("hudroot").classList.add("hidden");
    if (game.state === "won") {
      wonScores[night - 1] = game.score;
      audio.play("win");
      if (night === 3) return showDawn();
      card(`<h2>Đêm ${night} hoàn thành</h2><h1>${mapFor(night).name} còn sáng lúc bình minh!</h1><p>Điểm đêm này: <b>${game.score}</b> · Tổng: <b>${total()}</b></p>
        <button id="b-next">Đêm ${night + 1}</button>`, { "b-next": () => showIntro((night + 1) as 2 | 3) });
    } else {
      audio.play("lose");
      const why = game.endReason === "dawn" ? `Bình minh đến nhưng chỉ còn ${game.lanterns.filter((l) => l.lit).length}/${game.lanterns.length} đèn sáng (cần ${game.litNeeded}).` : "Mây đã hết Ngọn Lửa.";
      card(`<h1>Ánh sáng đã tắt…</h1><p>${why}</p><p>Tổng điểm các đêm đã thắng: <b>${total()}</b></p>
        <button id="b-save">Lưu điểm</button><button class="ghost" id="b-retry">Chơi lại Đêm ${night}</button><button class="ghost" id="b-menu">Về menu</button>`,
      { "b-save": () => showNameEntry(showMenu), "b-retry": () => showIntro(night), "b-menu": showMenu });
    }
  }

  function showDawn(): void {
    screen = "dawn";
    $("hudroot").classList.add("hidden");
    card(`<h1>🌅 Bình Minh</h1><p>Ba hòn đảo đã sáng trở lại. Ông Đăng mỉm cười: “Giỏi lắm, Mây!”</p>
      <p>Tổng điểm: <b style="color:var(--gold);font-size:1.3rem">${total()}</b></p>
      <p>Đêm 1: ${wonScores[0] ?? "—"} · Đêm 2: ${wonScores[1] ?? "—"} · Đêm 3: ${wonScores[2] ?? "—"}</p>
      <button id="b-save">Lưu điểm</button><button class="ghost" id="b-menu">Về menu</button>`,
    { "b-save": () => showNameEntry(showMenu), "b-menu": showMenu });
  }

  addEventListener("keydown", (e) => {
    if (e.code !== "Enter" || controls.capture) return;
    if (screen === "name") { ($("b-save") as HTMLButtonElement).click(); return; }
    const btn = $("card").querySelector("button");
    if (!$("overlay").classList.contains("hidden") && btn) (btn as HTMLButtonElement).click();
  });

  // ---------------------------------------------------------------- captions, flash, arrows (accessibility)
  function caption(text: string, danger = false, ms = 3000): void {
    const d = document.createElement("div");
    d.textContent = (danger && settings.colorblind ? "⚠ " : "") + text;
    if (danger) d.className = "danger";
    $("captions").appendChild(d);
    setTimeout(() => d.remove(), ms);
    while ($("captions").children.length > 4) $("captions").firstChild!.remove();
  }
  function flash(color: string): void {
    if (settings.reduceMotion) return; // no screen flashes with reduced motion
    const f = $("flash") as HTMLElement;
    f.style.transition = "none"; f.style.background = color; f.style.opacity = "0.35";
    requestAnimationFrame(() => { f.style.transition = "opacity .35s"; f.style.opacity = "0"; });
  }
  const shadeArrows = new Map<string, { el: HTMLElement; until: number }>();
  function placeArrow(el: HTMLElement, x: number, y: number, z: number): boolean {
    const s = view.project(x, y, z);
    const off = s.behind || s.x < 0 || s.x > innerWidth || s.y < 0 || s.y > innerHeight;
    el.style.display = off ? "block" : "none";
    if (off) {
      const cx = innerWidth / 2, cy = innerHeight / 2;
      let dx = s.x - cx, dy = s.y - cy;
      if (s.behind) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx), r = Math.min(innerWidth, innerHeight) * 0.42;
      el.style.left = `${cx + Math.cos(ang) * r - 14}px`;
      el.style.top = `${cy + Math.sin(ang) * r - 15}px`;
      el.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
    }
    return off;
  }
  const lowWarned = new Set<string>();

  // ---------------------------------------------------------------- HUD
  const bar = $("bar");
  for (let i = 0; i < 20; i++) bar.appendChild(document.createElement("i"));
  function hud(now: number): void {
    const p = game.player, t = game.t;
    $("flames").textContent = "🔥".repeat(p.flames) + "·".repeat(Math.max(0, t.flames - p.flames));
    const secs = Math.ceil(game.timeLeftS);
    $("clock").textContent = `${secs <= 30 && settings.colorblind ? "⚠ " : ""}${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
    $("clock").classList.toggle("danger", secs <= 30);
    const lit = game.lanterns.filter((l) => l.lit).length;
    const enough = lit >= game.litNeeded;
    $("topright").innerHTML = `Đèn <b>${lit}/${game.lanterns.length}</b> <span class="${enough ? "" : "need"}">${enough ? "✓" : (settings.colorblind ? "⚠ " : "") + "cần " + game.litNeeded}</span><br/>Điểm <b>${total() + game.score}</b>`;
    const cap = game.capacity;
    bar.querySelectorAll("i").forEach((el, i) => { (el as HTMLElement).style.display = i < cap ? "block" : "none"; el.classList.toggle("on", i < p.carried); });
    bar.dataset.label = `${p.carried}/${cap}`;
    const cd = (id: string, ticks: number, full: number) => ($(id).querySelector(".ring") as HTMLElement).style.setProperty("--p", `${(ticks / full) * 100}%`);
    cd("cd-dash", p.charmTicks > 0 ? 0 : p.dashCdTicks, 90);
    cd("cd-pulse", p.carried < t.pulse_cost ? 180 : p.pulseCdTicks, 180);
    $("charmhud").style.display = p.charmTicks > 0 ? "block" : "none";
    $("charmhud").textContent = `🧧 Bùa Gió ${(p.charmTicks / 60).toFixed(1)}s`;
    $("wind").style.display = game.windWarning || game.windActiveTicks > 0 ? "block" : "none";
    $("wind").textContent = game.windActiveTicks > 0 ? "🍃 Gió mạnh!" : "🍃 Gió sắp nổi…";

    const near = game.lanterns.find((l) => Math.hypot(l.x - p.x, l.z - p.z) <= t.interact_radius && Math.abs(l.y - p.y) <= 1.5 && (!l.lit || l.fuelU < game.fuelMaxU));
    $("hint").style.display = near ? "block" : "none";
    if (near) {
      const cost = near.everLit ? t.relight_cost : t.lantern_cost;
      $("hint").textContent = near.lit
        ? `${keyName(settings.keys.interact)} — Châm dầu (${Math.floor(near.fuelU / 60)}/${t.fuel_max})`
        : `${keyName(settings.keys.interact)} — ${near.everLit ? "Thắp lại" : "Nạp ánh sáng"} (${near.deposited}/${cost})`;
    }
    const unlit = game.lanterns.filter((l) => !l.lit);
    const target = unlit.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (target) placeArrow($("arrow"), target.x, target.y + 3, target.z); else $("arrow").style.display = "none";
    // arrows toward newly appeared shades (for 4 s)
    for (const [id, a] of shadeArrows) {
      const s = game.shades.find((x) => x.id === id);
      if (!s || now > a.until) { a.el.remove(); shadeArrows.delete(id); continue; }
      placeArrow(a.el, s.x, s.y, s.z);
    }
  }

  // ---------------------------------------------------------------- main loop
  let frames = 0, fpsT = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (screen === "play" || screen === "pause" || screen === "settings") {
      acc += dt;
      while (acc >= DT && (game.state === "playing" || game.state === "paused")) {
        const input = screen === "play" ? controls.sample(DT) : { ...NEUTRAL_INPUT, camYawDeg: controls.camYawDeg };
        if (pendingPause) { input.pause = true; pendingPause = false; }
        const wasGrounded = game.player.grounded;
        game.step(input);
        if (wasGrounded && !game.player.grounded && game.player.vy > 5) audio.play("jump");
        for (const e of game.events) {
          const ev = e.event;
          switch (ev.name) {
            case "pulse": view.pulse(); audio.play("pulse"); flash("#fff6c2"); break;
            case "mote_picked": audio.play("pick"); break;
            case "lantern_lit": audio.play("lit"); caption(`${ev.data.lantern_id} ${ev.data.relight ? "đã thắp lại" : "đã sáng"}`); lowWarned.delete(ev.data.lantern_id); break;
            case "lantern_out": audio.play("out"); caption(`Đèn ${ev.data.lantern_id} đã tắt!`, true); break;
            case "refuel": audio.play("refuel"); if (ev.data.fuel >= 30) lowWarned.delete(ev.data.lantern_id); break;
            case "player_hit": audio.play("hit"); view.shake(); flash("#ff5a5f"); caption(ev.data.by === "fall" ? "Mây rơi khỏi đảo!" : "Bị Bóng Mực chạm!", true); break;
            case "dash": audio.play("dash"); break;
            case "shade_spawned": {
              audio.play("shade"); caption("Bóng Mực xuất hiện!", true);
              const el = document.createElement("div"); el.className = "hud arrow shade"; $("shadearrows").appendChild(el);
              shadeArrows.set(ev.data.id, { el, until: now + 4000 });
              break;
            }
            case "charm_picked": audio.play("charm"); caption("Bùa Gió: chạy nhanh, lướt không hồi chiêu!"); break;
            case "drifter_steal": audio.play("steal"); caption(`Gió Lạc cướp ${ev.data.amount} đom đóm!`, true); break;
            case "fuel_drain": caption(`Bóng Mực đang hút dầu đèn ${ev.data.lantern_id}!`, true); break;
            default: break;
          }
        }
        if (game.windWarning && game.simTick % 1800 === 1800 - 120) { audio.play("wind"); caption("Gió sắp thổi!"); }
        for (const l of game.lanterns) {
          if (l.lit && l.fuelU < game.lowFuelU && !lowWarned.has(l.id)) { lowWarned.add(l.id); caption(`Đèn ${l.id} sắp hết dầu (< 30)!`, true); }
        }
        const secs = Math.ceil(game.timeLeftS);
        if (secs <= 10 && secs !== lastCountdown && game.state === "playing") {
          lastCountdown = secs; audio.play("tick");
          if (secs === 10) caption("Còn 10 giây tới bình minh!", true);
        }
        acc -= DT;
      }
      if (game.state === "won" || game.state === "lost") showResult();
    }
    view.render(game, controls.camYawDeg, now / 1000, dt);
    if (screen === "play") hud(now);
    frames++;
    if (now - fpsT >= 1000) {
      $("fps").textContent = `${Math.round((frames * 1000) / (now - fpsT))} FPS · ${innerWidth}×${innerHeight} · ${view.quality}`;
      frames = 0; fpsT = now;
    }
    requestAnimationFrame(frame);
  }

  // debug hook for the screenshot scripts only (?debug=1): lets a script read the game and view
  if (params.get("debug") === "1") Object.assign(window, { __ddl: { view, get game() { return game; } } });

  showMenu();
  requestAnimationFrame(frame);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
