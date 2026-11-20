// Runs tests/scenarios/*.json through the BUILT headless command (black box), twice, and checks expectations.
// Used by tests/scenarios.test.ts and scripts/proof.mjs.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

export const SCENARIO_DIR = "tests/scenarios";
export const CLI = "dist/headless.cjs";

export function listScenarios() {
  return readdirSync(SCENARIO_DIR).filter((f) => f.endsWith(".json")).sort().map((f) => join(SCENARIO_DIR, f));
}

/** Subsequence check: expected event names must appear in this order (other events may be in between). */
function hasSubsequence(names, expected) {
  let i = 0;
  for (const n of names) if (i < expected.length && n === expected[i]) i++;
  return i === expected.length;
}

export function runScenario(file, outPath) {
  const spec = JSON.parse(readFileSync(file, "utf8"));
  const tmp = mkdtempSync(join(tmpdir(), "ddl-sc-"));
  const args = [CLI, "--seed", String(spec.seed), "--night", "1", "--ticks", String(spec.ticks),
    "--snapshot-every", String(spec.snapshot_every ?? 10)];
  if (spec.scenario) { const p = join(tmp, "scenario.json"); writeFileSync(p, JSON.stringify(spec.scenario)); args.push("--scenario", p); }
  if (spec.inputs) { const p = join(tmp, "inputs.json"); writeFileSync(p, JSON.stringify(spec.inputs)); args.push("--inputs", p); }

  const outs = [];
  const problems = [];
  for (const run of [1, 2]) {
    const out = run === 1 && outPath ? outPath : join(tmp, `out${run}.jsonl`);
    const r = spawnSync(process.execPath, [...args, "--out", out], { encoding: "utf8" });
    if (r.status !== 0) problems.push(`run ${run}: exit ${r.status} ${r.stderr}`);
    outs.push(readFileSync(out, "utf8"));
  }
  if (outs[0] !== outs[1]) problems.push("non-deterministic: two runs differ");

  const lines = outs[0].trim().split("\n").map((l) => JSON.parse(l));
  const end = lines.at(-1);
  const names = lines.filter((l) => l.type === "event").map((l) => l.name);
  if (end.type !== "end") problems.push("last line is not an end line");
  for (const [k, v] of Object.entries(spec.expect?.end ?? {})) {
    if (end[k] !== v) problems.push(`end.${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(end[k])}`);
  }
  const exp = spec.expect?.events ?? [];
  if (!hasSubsequence(names, exp)) problems.push(`events: expected subsequence ${exp.join(",")}, got ${names.join(",")}`);
  if (exp.length === 0 && spec.expect?.events && names.length > 0) problems.push(`events: expected none, got ${names.join(",")}`);

  return { name: basename(file, ".json"), requirement: spec.requirement, ok: problems.length === 0, problems, end, names, lines };
}
