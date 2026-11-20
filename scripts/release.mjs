// npm run release -> builds and packs release/dao-den-long-v1.0.0.tar.gz (static web build + local server + headless).
// Run:  tar -xzf dao-den-long-v1.0.0.tar.gz && cd dao-den-long-v1.0.0 && node serve.cjs      (needs Node >= 18 only)
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const name = `dao-den-long-v${version}`;
const dir = `release/${name}`;

execSync("npm run build", { stdio: "inherit" });
rmSync("release", { recursive: true, force: true });
mkdirSync(`${dir}/web`, { recursive: true });
cpSync("dist/web", `${dir}/web`, { recursive: true });
cpSync("dist/serve.cjs", `${dir}/serve.cjs`);
cpSync("dist/headless.cjs", `${dir}/headless.cjs`);
for (const f of ["game.contract.json", "LICENSE", "CREDITS.md"]) cpSync(f, `${dir}/${f}`);
writeFileSync(`${dir}/RUN.md`, `# Đảo Đèn Lồng v${version}: chạy bản phát hành

Cần Node >= 18 (không cần cài thêm gì).

    node serve.cjs                 # mở http://localhost:4173 (bảng xếp hạng lưu ở ~/.dao-den-long/)
    node serve.cjs --port 8080     # đổi cổng
    node serve.cjs --export-leaderboard out.json
    node headless.cjs --seed 1 --night 1 --ticks 600 --out out.jsonl   # chế độ headless theo Test Contract

Thư mục \`web/\` cũng là một trang web tĩnh: có thể mở bằng bất kỳ web server tĩnh nào (bảng xếp hạng khi đó lưu trong trình duyệt).
`);
execSync(`tar -czf ${name}.tar.gz ${name}`, { cwd: "release", stdio: "inherit" });
console.log(`\nrelease/${name}.tar.gz ready`);
