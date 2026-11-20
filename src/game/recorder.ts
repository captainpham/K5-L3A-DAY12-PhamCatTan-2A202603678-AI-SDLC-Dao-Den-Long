// In-game screen recorder (for the demo video): getDisplayMedia + MediaRecorder, no library.
// Records the current tab (HUD and game sound included), stops by itself at 4:55 (Ticket-04: video < 5 min),
// then downloads the file. Chrome >= 126 records .mp4; older browsers fall back to .webm.

/** hard cap so the demo video is always under 5 minutes */
export const MAX_SECONDS = 295;

const MIMES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

/** first container the browser can record, preferring mp4 (the ticket asks for .mp4) */
export function pickMime(isSupported: (m: string) => boolean): string | null {
  return MIMES.find(isSupported) ?? null;
}

export function recordingName(d: Date, mime: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  return `dao-den-long-demo-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

/** 83 -> "01:23" */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export interface Saved { name: string; size: number; type: string; seconds: number }

export class ScreenRecorder {
  recording = false;
  /** called every 0.5 s while recording, with the elapsed seconds */
  onTick: (seconds: number) => void = () => {};
  /** called when recording starts (true) or stops (false) */
  onState: (recording: boolean) => void = () => {};
  /** called with the saved file info after the download starts */
  onSaved: (s: Saved) => void = () => {};
  /** called with a readable reason when starting fails (permission denied, unsupported...) */
  onError: (msg: string) => void = () => {};
  private rec: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private timer = 0;
  private startMs = 0;
  private mime = "video/webm";

  static supported(): boolean {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined";
  }

  async start(): Promise<void> {
    if (this.recording) return;
    try {
      // preferCurrentTab: the picker offers "this tab" first; tab audio carries the WebAudio of the game
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
    } catch (e) {
      const err = e as DOMException;
      this.onError(err.name === "NotAllowedError" ? "Bạn đã từ chối chia sẻ màn hình." : `Không quay được: ${err.message || err.name}`);
      return;
    }
    const mime = pickMime((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) { this.stream.getTracks().forEach((t) => t.stop()); this.onError("Trình duyệt không hỗ trợ quay video."); return; }
    this.mime = mime;
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    this.rec.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.rec.onstop = () => this.finish();
    // the browser's own "Stop sharing" bar must also end the recording cleanly
    this.stream.getVideoTracks()[0].addEventListener("ended", () => this.stop());
    this.startMs = performance.now();
    this.rec.start(1000);
    this.recording = true;
    this.onState(true);
    this.timer = window.setInterval(() => {
      const s = (performance.now() - this.startMs) / 1000;
      this.onTick(s);
      if (s >= MAX_SECONDS) this.stop();
    }, 500);
  }

  stop(): void {
    if (!this.recording) return;
    this.recording = false;
    window.clearInterval(this.timer);
    if (this.rec && this.rec.state !== "inactive") this.rec.stop(); else this.finish();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.onState(false);
  }

  private finish(): void {
    const type = this.mime.split(";")[0];
    const blob = new Blob(this.chunks, { type });
    this.chunks = [];
    const seconds = (performance.now() - this.startMs) / 1000;
    if (blob.size === 0) { this.onError("Video rỗng, hãy thử quay lại."); return; }
    const name = recordingName(new Date(), this.mime);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    this.onSaved({ name, size: blob.size, type, seconds });
  }
}
