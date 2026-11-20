// npm run proof -> runs every scenario through the built CLI and saves real outputs as evidence.
// Output: docs/proof/<phase>/<scenario>.jsonl + docs/proof/<phase>/RESULTS.md (generated, never hand-edited).
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listScenarios, runScenario } from "./scenarios.mjs";

const phase = process.argv[2] ?? "phase-1";
const dir = join("docs", "proof", phase);
mkdirSync(dir, { recursive: true });

let commit = "unknown";
try { commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch {}
const dirty = (() => { try { return execSync("git status --porcelain", { encoding: "utf8" }).trim() !== ""; } catch { return false; } })();

const rows = [];
let failed = 0;
for (const file of listScenarios()) {
  const r = runScenario(file, join(dir, `${file.split(/[\\/]/).pop().replace(".json", "")}.jsonl`));
  if (!r.ok) failed++;
  const over = r.lines.find((l) => l.name === "game_over");
  rows.push(`| ${r.name} | ${r.requirement} | ${r.end.state} @ tick ${r.end.ticks}, score ${r.end.score}${over ? ` (${over.data.reason})` : ""} | ${r.ok ? "ĐẠT" : "CHƯA ĐẠT: " + r.problems.join("; ")} |`);
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : "  " + r.problems.join("; ")}`);
}

const md = `# Kết quả scenario headless (${phase})

> File này do \`npm run proof\` sinh ra, không sửa tay. Mỗi scenario chạy **2 lần** bằng CLI đã build và so sánh byte-by-byte (tính tất định).

- Commit: \`${commit}\`${dirty ? " (working tree có thay đổi chưa commit)" : ""}
- Node: ${process.version} · ${process.platform}/${process.arch}
- Thời điểm: ${new Date().toISOString()}

| Scenario | Yêu cầu kiểm chứng | Kết quả cuối | Đánh giá |
|---|---|---|---|
${rows.join("\n")}

Đầu vào: \`tests/scenarios/<tên>.json\` · Đầu ra thật: \`docs/proof/${phase}/<tên>.jsonl\`
`;
writeFileSync(join(dir, "RESULTS.md"), md);
console.log(`\n${rows.length - failed}/${rows.length} scenarios passed -> ${join(dir, "RESULTS.md")}`);
process.exit(failed ? 1 : 0);
