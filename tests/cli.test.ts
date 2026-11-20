// Black-box tests of the built headless command (dist/headless.cjs), exactly as the grader calls it.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import contract from "../game.contract.json";

const dir = mkdtempSync(join(tmpdir(), "ddl-"));
const CLI = "dist/headless.cjs";

function cli(args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

describe("game.contract.json", () => {
  it("declares contract v1.1 with the Ticket-02 standard numbers", () => {
    expect(contract.contract_version).toBe("1.1");
    expect(contract.tuning).toEqual({
      player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
      pulse_cost: 3, pulse_radius: 5, night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360, flames: 3,
      invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6,
      shade_speed: 4, shade_hit_radius: 1, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
      score: { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 },
    });
  });
});

describe("headless CLI", () => {
  it("writes JSONL ending with an end line, exit 0", () => {
    const out = join(dir, "a.jsonl");
    const r = cli(["--seed", "7", "--night", "1", "--ticks", "120", "--out", out]);
    expect(r.status).toBe(0);
    const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines[0]).toMatchObject({ type: "snapshot", tick: 0, night: 1 });
    expect(lines.filter((l) => l.type === "snapshot").map((l) => l.tick)).toEqual(Array.from({ length: 13 }, (_, i) => i * 10));
    expect(lines.at(-1)).toMatchObject({ type: "end", ticks: 120, state: "playing" });
  });

  it("is deterministic: same seed -> byte-identical output (with random spawns)", () => {
    const a = join(dir, "d1.jsonl"), b = join(dir, "d2.jsonl"), c = join(dir, "d3.jsonl");
    for (const [o, seed] of [[a, "42"], [b, "42"], [c, "43"]]) cli(["--seed", seed, "--night", "1", "--ticks", "3000", "--out", o]);
    expect(readFileSync(a, "utf8")).toBe(readFileSync(b, "utf8"));
    expect(readFileSync(a, "utf8")).not.toBe(readFileSync(c, "utf8"));
  });

  it("malformed inputs / scenario -> exit 2 with stderr message", () => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{ not json");
    const r1 = cli(["--seed", "1", "--night", "1", "--inputs", bad, "--ticks", "5", "--out", join(dir, "x.jsonl")]);
    expect(r1.status).toBe(2);
    expect(r1.stderr).toMatch(/error/);
    const dec = join(dir, "dec.json");
    writeFileSync(dec, JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }));
    expect(cli(["--seed", "1", "--night", "1", "--inputs", dec, "--ticks", "5", "--out", join(dir, "x.jsonl")]).status).toBe(2);
    const sc = join(dir, "sc.json");
    writeFileSync(sc, JSON.stringify({ motes: "nope" }));
    expect(cli(["--seed", "1", "--night", "1", "--scenario", sc, "--ticks", "5", "--out", join(dir, "x.jsonl")]).status).toBe(2);
  });

  it("accepts --night 1, 2, 3 and rejects 4", () => {
    for (const n of ["1", "2", "3"]) expect(cli(["--seed", "1", "--night", n, "--ticks", "5", "--out", join(dir, `n${n}.jsonl`)]).status).toBe(0);
    expect(readFileSync(join(dir, "n3.jsonl"), "utf8")).toMatch(/"night":3/);
    expect(cli(["--seed", "1", "--night", "4", "--ticks", "5", "--out", join(dir, "n4.jsonl")]).status).not.toBe(0);
  });

  it("missing required args -> non-zero exit", () => {
    const r = cli(["--seed", "1", "--night", "1"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/--ticks/);
  });

  it("headless bundle contains no rendering code (decor/animals cannot change headless output)", () => {
    const bundle = readFileSync(CLI, "utf8");
    expect(bundle).not.toMatch(/WebGLRenderer|InstancedMesh|makeRabbit/);
  });

  it("rounds coordinates to 3 decimals", () => {
    const out = join(dir, "r.jsonl");
    cli(["--seed", "3", "--night", "1", "--ticks", "100", "--out", out]);
    const text = readFileSync(out, "utf8");
    expect(text).not.toMatch(/\d\.\d{4,}/);
  });
});
