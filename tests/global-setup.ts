// Build the headless CLI once before any test file runs (test files run in parallel).
import { execFileSync } from "node:child_process";

export default function setup(): void {
  execFileSync(process.execPath, [
    "node_modules/esbuild/bin/esbuild", "src/headless/cli.ts", "--bundle", "--platform=node",
    "--format=cjs", "--target=node18", "--outfile=dist/headless.cjs", "--log-level=error",
  ]);
}
