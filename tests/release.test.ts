// Ticket-04: leaderboard, benchmark statistics + scene, soak, export command, key bindings, contract v1.3.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import contract from "../game.contract.json";
import { BENCH, benchCamera, benchStats, makeBenchGame } from "../src/sim/bench";
import { MAX_ENTRIES, addEntry, isoWithOffset, toEntry, validName, type LeaderEntry } from "../src/sim/leaderboard";
import { DEFAULT_BINDINGS, conflicts } from "../src/game/controls";
import { soak } from "../src/tools/soak";
import { MAX_SECONDS, clock, pickMime, recordingName } from "../src/game/recorder";

const entry = (name: string, score: number, at: string): LeaderEntry => ({ name, score, nights_won: 1, achieved_at: at, seed: 1 });

describe("leaderboard", () => {
  it("name: 3-12 chars of [A-Za-z0-9_] (Vietnamese letters accepted)", () => {
    for (const ok of ["abc", "Mây_01", "A_B_C_D_E_F_", "Nguyễn", "x1y"]) expect(validName(ok), ok).toBe(ok.normalize("NFC"));
    for (const bad of ["ab", "", "a".repeat(13), "a b c", "ab!", "a-b-c", "<script>"]) expect(validName(bad), bad).toBeNull();
  });

  it("keeps the top 10, score desc, ties: earlier achieved_at first", () => {
    let list: LeaderEntry[] = [];
    for (let i = 0; i < 14; i++) list = addEntry(list, entry(`P${i}`, 100 + (i % 3) * 50, `2026-11-20T10:${String(i).padStart(2, "0")}:00+07:00`));
    expect(list).toHaveLength(MAX_ENTRIES);
    expect(list.map((e) => e.score)).toEqual([...list.map((e) => e.score)].sort((a, b) => b - a));
    const tied = list.filter((e) => e.score === list[0].score);
    expect(tied.map((e) => e.achieved_at)).toEqual([...tied.map((e) => e.achieved_at)].sort());
    expect(addEntry([entry("AAA", 10, "2026-01-01T00:00:00+07:00")], entry("BBB", 10, "2026-01-02T00:00:00+07:00")).map((e) => e.name)).toEqual(["AAA", "BBB"]);
  });

  it("achieved_at is ISO 8601 with a timezone offset; entries are validated", () => {
    expect(isoWithOffset(new Date(2026, 10, 20, 17, 5, 9))).toMatch(/^2026-11-20T17:05:09[+-]\d\d:\d\d$/);
    expect(toEntry({ name: "Bob", score: 5, nights_won: 3, seed: 7 })).toMatchObject({ name: "Bob", score: 5, nights_won: 3, seed: 7 });
    for (const bad of [{ name: "Bob", score: -1, nights_won: 1, seed: 1 }, { name: "Bob", score: 1, nights_won: 4, seed: 1 }, { name: "x", score: 1, nights_won: 1, seed: 1 }, null, "x"])
      expect(toEntry(bad)).toBeNull();
  });
});

describe("export-leaderboard (run_cmd)", () => {
  it("writes {entries} in leaderboard order from the on-disk file", () => {
    const dir = mkdtempSync(join(tmpdir(), "ddl-lb-"));
    const entries = [entry("Low", 50, "2026-11-20T10:00:00+07:00"), entry("High", 500, "2026-11-20T11:00:00+07:00"), entry("Mid", 500, "2026-11-20T09:00:00+07:00")];
    writeFileSync(join(dir, "leaderboard.json"), JSON.stringify({ entries }));
    const out = join(dir, "out.json");
    const r = spawnSync(process.execPath, ["dist/serve.cjs", "--export-leaderboard", out], { encoding: "utf8", env: { ...process.env, DDL_DATA_DIR: dir } });
    expect(r.status).toBe(0);
    expect(JSON.parse(readFileSync(out, "utf8")).entries.map((e: LeaderEntry) => e.name)).toEqual(["Mid", "High", "Low"]);
  });

  it("empty / missing file -> {entries: []}", () => {
    const dir = mkdtempSync(join(tmpdir(), "ddl-lb-"));
    const out = join(dir, "o.json");
    spawnSync(process.execPath, ["dist/serve.cjs", "--export-leaderboard", out], { env: { ...process.env, DDL_DATA_DIR: dir } });
    expect(JSON.parse(readFileSync(out, "utf8"))).toEqual({ entries: [] });
  });
});

describe("benchmark", () => {
  it("scene: Night 1, 200 wandering shades, 100 motes, L1-L3 lit with fuel 100, idle Mây at the origin", () => {
    const g = makeBenchGame(42);
    expect(g.night).toBe(1);
    expect(g.shades).toHaveLength(BENCH.shades);
    expect(g.shades.every((s) => s.state === "wander")).toBe(true);
    expect(g.shades.every((s) => Math.hypot(s.x, s.z) <= 40)).toBe(true);
    expect(g.motes).toHaveLength(BENCH.motes);
    expect(g.lanterns.map((l) => (l.lit ? l.fuelU / 60 : -1))).toEqual([100, 100, 100, -1, -1]);
    expect([g.player.x, g.player.y, g.player.z]).toEqual([0, 0, 0]);
  });

  it("scene is deterministic for a seed and differs for another", () => {
    const pos = (seed: number) => makeBenchGame(seed).shades.map((s) => [s.x, s.z].join(",")).join(";");
    expect(pos(42)).toBe(pos(42));
    expect(pos(42)).not.toBe(pos(43));
  });

  it("bench mode: no spawn, no damage, no pickup, no fuel burn, no end; shades still wander", () => {
    const g = makeBenchGame(42);
    const before = g.shades.map((s) => [s.x, s.z]);
    const motes = g.motes.length;
    for (let i = 0; i < 60 * 40; i++) g.step({ move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false });
    expect(g.state).toBe("playing");
    expect(g.shades).toHaveLength(BENCH.shades);
    expect(g.motes).toHaveLength(motes);
    expect(g.player.flames).toBe(3);
    expect(g.lanterns[0].fuelU).toBe(g.fuelMaxU);
    expect(g.shades.some((s, i) => Math.hypot(s.x - before[i][0], s.z - before[i][1]) > 1)).toBe(true);
  });

  it("camera orbit: starts at (30,15,0), counter-clockwise (+X toward +Z), one turn per 15 s", () => {
    expect(benchCamera(0)).toEqual([30, 15, 0]);
    const q = benchCamera(3.75); // quarter turn
    expect(q[0]).toBeCloseTo(0, 6); expect(q[1]).toBe(15); expect(q[2]).toBeCloseTo(30, 6);
    const full = benchCamera(15);
    expect(full[0]).toBeCloseTo(30, 6); expect(full[2]).toBeCloseTo(0, 6);
  });

  it("statistics follow the ticket definitions", () => {
    // 100 frames: 99 x 10 ms and one 110 ms
    const dts = [...Array(99).fill(10), 110];
    const s = benchStats(dts);
    expect(s.frames).toBe(100);
    expect(s.avg_fps).toBeCloseTo((1000 * 100) / 1100, 1); // 1000 N / sum(dt)
    expect(s.p1_low_fps).toBeCloseTo(1000 / 110, 1); // k = ceil(0.01 x 100) = 1 -> the single worst frame
    expect(s.frame_ms_p95).toBe(10);
    // k = ceil(0.01 x 250) = 3 worst frames averaged
    const s2 = benchStats([...Array(247).fill(5), 20, 30, 40]);
    expect(s2.p1_low_fps).toBeCloseTo(1000 / 30, 1);
    expect(benchStats([8]).p1_low_fps).toBeCloseTo(125, 1); // k >= 1
  });
});

describe("soak", () => {
  it("10 nights in one process: no crash, results for every night, memory growth <= 20%", () => {
    const r = soak(7, 10);
    expect(r.nights).toBe(10);
    expect(r.crashes).toBe(0);
    expect(r.results).toHaveLength(10);
    expect(r.results.every((x) => x === "won" || x === "lost")).toBe(true);
    expect(r.mem_end_mb).toBeLessThanOrEqual(1.2 * r.mem_start_mb);
  });

  it("is deterministic (same seed -> same results)", () => {
    expect(soak(7, 4).results).toEqual(soak(7, 4).results);
  });
});

describe("screen recorder helpers", () => {
  it("prefers mp4 (the ticket asks for .mp4), falls back to webm, null when nothing is supported", () => {
    expect(pickMime(() => true)).toMatch(/^video\/mp4/);
    expect(pickMime((m) => m.startsWith("video/webm"))).toBe("video/webm;codecs=vp9,opus");
    expect(pickMime(() => false)).toBeNull();
  });

  it("file name is timestamped with the right extension; clock formats mm:ss", () => {
    const d = new Date(2026, 10, 20, 7, 5, 9);
    expect(recordingName(d, "video/mp4;codecs=avc1")).toBe("dao-den-long-demo-20261120-070509.mp4");
    expect(recordingName(d, "video/webm")).toBe("dao-den-long-demo-20261120-070509.webm");
    expect([clock(0), clock(83.9), clock(295), clock(-5)]).toEqual(["00:00", "01:23", "04:55", "00:00"]);
  });

  it("auto-stop limit keeps the demo video under 5 minutes", () => {
    expect(MAX_SECONDS).toBeLessThan(300);
  });
});

describe("accessibility + contract v1.3", () => {
  it("default key bindings have no conflicts; a duplicate is detected", () => {
    expect(conflicts(DEFAULT_BINDINGS)).toEqual([]);
    expect(conflicts({ ...DEFAULT_BINDINGS, dash: "KeyE" })).toEqual([["dash", "interact"]]);
  });

  it("game.contract.json is v1.3 with bench_cmd and soak_cmd; all earlier tuning kept", () => {
    expect(contract.contract_version).toBe("1.3");
    expect(contract).toMatchObject({ bench_cmd: expect.stringContaining("bench"), soak_cmd: expect.stringContaining("soak") });
    expect(contract.tuning.fuel_max).toBe(100);
    expect(contract.tuning.night1_duration_s).toBe(240);
  });
});
