// Build the headless CLI and the run_cmd server once before any test file runs (test files run in parallel).
import { execFileSync } from "node:child_process";

const esbuild = (entry: string, out: string) =>
  execFileSync(process.execPath, [
    "node_modules/esbuild/bin/esbuild", entry, "--bundle", "--platform=node",
    "--format=cjs", "--target=node18", `--outfile=${out}`, "--log-level=error",
  ]);

export default function setup(): void {
  esbuild("src/headless/cli.ts", "dist/headless.cjs");
  esbuild("src/tools/serve-cli.ts", "dist/serve.cjs");
}
