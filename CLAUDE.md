# Đảo Đèn Lồng — agent guide

3D third-person game (TypeScript). Lab brief: `docs/lab/`. Current phase: **Phase 4 / Ticket-04 / Test Contract v1.3** (release v1.0.0). Contract v1.0-v1.3 all still apply.
Spec + assumptions + acceptance criteria: `docs/notes/assumptions.md` · ADR: `docs/adr/` · breaking changes: `CHANGELOG.md` · retro: `docs/notes/retro.md`.

## Commands
- Install/build: `npm ci && npm run build` (headless -> `dist/headless.cjs`, web -> `dist/web/`)
- Play: `npm start` (http://localhost:4173) · dev: `npm run dev` · low quality: add `?quality=low` to the URL
- Test (rules, nights, CLI, palette, scenarios): `npm test` · typecheck: `npm run typecheck`
- Evidence: `npm run proof -- phase-N` (writes `docs/proof/phase-N/`, never edit those files by hand)
- Bench/soak/export: `npm run bench` · `npm run soak` · `node dist/serve.cjs --export-leaderboard out.json` · package: `npm run release`
- Headless: `node dist/headless.cjs --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f.json] [--inputs f.json]`

## Architecture (do not break)
- `src/sim/` = pure deterministic logic, NO DOM/Three.js/Math.random/Date. Shared by game and headless.
  - `game.ts` follows the Ticket-02 tick order (12 steps, comment at the top). Keep that order.
  - `maps.ts` = standard maps (angles from +X toward +Z). `tuning.ts` = contract tuning + `STD` constants.
- Contract numbers come ONLY from `game.contract.json`; other standard numbers ONLY from `STD`. Never hardcode.
- `src/headless/cli.ts` + `src/sim/contract-io.ts` = Test Contract v1.2 I/O (v1.3 only adds bench_cmd/soak_cmd).
- `src/tools/` = run_cmd server + leaderboard API (`serve.ts`), `bench.ts` (real Chrome via optional puppeteer), `soak.ts`. `src/sim/bench.ts` + `leaderboard.ts` are pure and unit-tested.
- `src/game/` = Three.js view, HUD, menus, audio (render only). Colours only from `PALETTE` in `models.ts`.

## Rules
- Contract output format is exact (Ticket-02 Part 4 + Ticket-03 Part 7); shade states spawning/wander/chase/recoil/stunned/drain.
- Lantern fuel is integer 1/60 units (`fuelU`); only round when writing output.
- Creative extras must be render-only (`src/game/decor/`) or off in headless; headless output must not change.
- Every rule gets a test in `tests/*.test.ts` and every new feature a scenario in `tests/scenarios/` BEFORE it is called done.
- When a ticket replaces a rule: update/remove the old test with a one-line reason in `docs/notes/assumptions.md`. Never skip tests silently.
- When a test fails, first decide whether the test or the game is wrong (read the ticket line), then fix that one.
- Bench scene = standard scene: creative decor OFF (`view.load(game,{decor:false})`), `game.bench=true` (no spawn/damage/pickup/fuel burn/end). Do not add effects to it.
- UI text must stay >= 18 px at 1280x720 (rem units in index.html). Settings live in `loadSettings()` (audio.ts).
- Before tagging a phase run the `reviewer` subagent (independent of whoever wrote the code).
- Small commits, one change each. Never commit `.env`, keys, `dist/`, `node_modules/`.
- Commit messages: NO `Co-Authored-By` / Claude Code attribution lines (user rule). Never force-push after a tag.
