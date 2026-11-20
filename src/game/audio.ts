// Procedural audio with WebAudio (no sound files -> nothing to license): night music pad + effects. Also the settings store.
import { DEFAULT_BINDINGS, type Bindings } from "./controls";
export type Sfx = "pick" | "lit" | "pulse" | "hit" | "jump" | "dash" | "win" | "lose" | "shade" | "tick" | "wind" | "charm" | "steal" | "out" | "refuel";

export interface Settings {
  volume: number; sensitivity: number; colorblind: boolean;
  /** Ticket-04 accessibility */
  reduceMotion: boolean; largeText: boolean; keys: Bindings;
}
const KEY = "ddl-settings";

export function loadSettings(): Settings {
  const def: Settings = { volume: 0.7, sensitivity: 1, colorblind: false, reduceMotion: false, largeText: false, keys: { ...DEFAULT_BINDINGS } };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const keys = { ...DEFAULT_BINDINGS };
    if (s.keys && typeof s.keys === "object") for (const a of Object.keys(keys) as (keyof Bindings)[]) if (typeof s.keys[a] === "string") keys[a] = s.keys[a];
    return {
      volume: typeof s.volume === "number" ? s.volume : def.volume,
      sensitivity: typeof s.sensitivity === "number" ? s.sensitivity : def.sensitivity,
      colorblind: s.colorblind === true, reduceMotion: s.reduceMotion === true, largeText: s.largeText === true, keys,
    };
  } catch { return def; }
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage may be blocked */ }
}

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music: OscillatorNode[] = [];
  private volume = 0.7;

  /** must be called from a user gesture (browser autoplay policy) */
  start(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /** slow, warm night pad: a minor chord drifting with a soft LFO */
  private startMusic(): void {
    const ctx = this.ctx!;
    const bus = ctx.createGain(); bus.gain.value = 0.05;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 700;
    bus.connect(filter); filter.connect(this.master);
    for (const f of [110, 130.81, 164.81, 220]) {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lg = ctx.createGain(); lg.gain.value = 0.35;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(bus);
      o.start(); lfo.start();
      this.music.push(o, lfo);
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number): void {
    const ctx = this.ctx; if (!ctx) return;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  play(s: Sfx): void {
    switch (s) {
      case "pick": this.tone(1200, 0.12, "sine", 0.15, 1800); break;
      case "lit": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.15, undefined, i * 0.08)); break;
      case "pulse": this.tone(300, 0.5, "sine", 0.25, 900); this.noise(0.4, 0.15, 1500); break;
      case "hit": this.tone(160, 0.35, "sawtooth", 0.2, 60); break;
      case "jump": this.tone(400, 0.15, "square", 0.06, 700); break;
      case "dash": this.noise(0.18, 0.25, 2500); break;
      case "win": [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.6, "triangle", 0.15, undefined, i * 0.12)); break;
      case "lose": [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.6, "sine", 0.15, undefined, i * 0.18)); break;
      case "shade": this.tone(90, 0.8, "sawtooth", 0.08, 55); break;
      case "tick": this.tone(880, 0.06, "square", 0.08); break;
      case "wind": this.noise(2.0, 0.2, 500); break;
      case "charm": this.tone(660, 0.3, "triangle", 0.15, 1320); break;
      case "steal": this.tone(700, 0.3, "sine", 0.12, 250); break;
      case "out": this.tone(500, 0.7, "triangle", 0.15, 120); break;
      case "refuel": this.tone(600, 0.2, "sine", 0.12, 900); break;
    }
  }
}
