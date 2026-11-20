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
  it("declares every tuning key of contract v1.0", () => {
    expect(contract.contract_version).toBe("1.0");
    expect(Object.keys(contract.tuning).sort()).toEqual([
      "carry_capacity", "fall_enabled", "flames", "hit_drop_ratio", "interact_radius", "invuln_s",
      "lantern_cost", "lantern_count_night1", "night1_duration_s", "pickup_radius", "player_speed",
      "pulse_cooldown_s", "pulse_cost", "pulse_push_m", "pulse_radius", "pulse_stun_s", "safe_radius",
      "score", "shade_hit_radius", "shade_speed",
    ]);
    expect(Object.keys(contract.tuning.score).sort()).toEqual(["per_flame_left", "per_lantern", "per_mote", "per_second_left", "per_stun"]);
    expect(contract.tuning.lantern_count_night1).toBe(5);
  });
});

describe("headless CLI", () => {
  it("writes JSONL ending with an end line, exit 0", () => {
    const out = join(dir, "a.jsonl");
    const r = cli(["--seed", "7", "--night", "1", "--ticks", "120", "--out", out]);
    expect(r.status).toBe(0);
    const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines[0]).toMatchObject({ type: "snapshot", tick: 0 });
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

  it("missing required args -> non-zero exit", () => {
    const r = cli(["--seed", "1", "--night", "1"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/--ticks/);
  });

  it("rounds coordinates to 3 decimals", () => {
    const out = join(dir, "r.jsonl");
    cli(["--seed", "3", "--night", "1", "--ticks", "100", "--out", out]);
    const text = readFileSync(out, "utf8");
    expect(text).not.toMatch(/\d\.\d{4,}/);
  });
});
