// Headless entry point (Test Contract v1.0).
// <headless_cmd> --seed <int> --night 1 [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int>]
import { readFileSync, writeFileSync } from "node:fs";
import { ContractFormatError, runHeadless } from "../sim/contract-io";

class UsageError extends Error {}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new UsageError(`unexpected argument: ${a}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new UsageError(`missing value for ${a}`);
    args[a.slice(2)] = v;
    i++;
  }
  return args;
}

function int(args: Record<string, string>, key: string, required: boolean, min = 0): number | undefined {
  const v = args[key];
  if (v === undefined) {
    if (required) throw new UsageError(`--${key} is required`);
    return undefined;
  }
  if (!/^-?\d+$/.test(v) || Number(v) < min) throw new UsageError(`--${key} must be an integer >= ${min}`);
  return Number(v);
}

function readJson(path: string, what: string): unknown {
  let text: string;
  try { text = readFileSync(path, "utf8"); }
  catch (e) { throw new UsageError(`cannot read ${what} file ${path}: ${(e as Error).message}`); }
  try { return JSON.parse(text); }
  catch (e) { throw new ContractFormatError(`${what} file ${path} is not valid JSON: ${(e as Error).message}`); }
}

function main(): number {
  try {
    const args = parseArgs(process.argv.slice(2));
    const seed = int(args, "seed", true, -2147483648)!;
    const night = int(args, "night", true, 1)!;
    if (night !== 1 && night !== 2 && night !== 3) throw new UsageError(`--night must be 1, 2 or 3`);
    const ticks = int(args, "ticks", true, 0)!;
    const every = int(args, "snapshot-every", false, 1) ?? 10;
    const outPath = args.out;
    if (!outPath) throw new UsageError("--out is required");
    const scenario = args.scenario !== undefined ? readJson(args.scenario, "scenario") : undefined;
    const inputs = args.inputs !== undefined ? readJson(args.inputs, "inputs") : undefined;

    const lines = runHeadless({ seed, ticks, night: night as 1 | 2 | 3, snapshotEvery: every, scenario, inputs });
    writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
    return 0;
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    return e instanceof ContractFormatError ? 2 : 1;
  }
}

process.exit(main());
