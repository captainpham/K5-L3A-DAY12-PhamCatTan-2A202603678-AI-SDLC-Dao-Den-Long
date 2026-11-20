// Claude Code Stop hook: the agent may not finish its turn while tests are red.
// Exit 2 + stderr -> Claude Code blocks the stop and shows the failure to the agent.
import { spawnSync } from "node:child_process";

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let payload = {};
  try { payload = JSON.parse(input || "{}"); } catch {}
  if (payload.stop_hook_active) process.exit(0); // already blocked once: avoid an infinite loop

  const r = spawnSync("npm", ["test", "--silent"], { encoding: "utf8", shell: true });
  if (r.status === 0) process.exit(0);
  const tail = `${r.stdout}\n${r.stderr}`.split("\n").filter(Boolean).slice(-40).join("\n");
  process.stderr.write(`Tests are failing (npm test). Fix them or report them as failing before finishing.\n${tail}\n`);
  process.exit(2);
});
