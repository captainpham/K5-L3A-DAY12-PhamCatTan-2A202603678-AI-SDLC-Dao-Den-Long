# Đảo Đèn Lồng — agent guide

3D third-person game (TypeScript). Lab brief: `docs/lab/`. Current phase requirements: lab board (user pastes them).

## Commands
- Install/build: `npm ci && npm run build` (headless -> `dist/headless.cjs`, web -> `dist/web/`)
- Play: `npm start` (http://localhost:4173) · dev with hot reload: `npm run dev`
- Test (unit + CLI + scenarios): `npm test` · typecheck: `npm run typecheck`
- Evidence: `npm run proof` (writes `docs/proof/phase-N/`, never edit those files by hand)
- Headless: `node dist/headless.cjs --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f.json] [--inputs f.json]`

## Architecture (do not break)
- `src/sim/` = pure game logic, deterministic, NO DOM/Three.js/Math.random/Date. Shared by game and headless.
- `src/headless/cli.ts` = Test Contract v1.0 CLI. `src/game/` = Three.js view + controls (render only).
- Tuning numbers come ONLY from `game.contract.json` (`src/sim/tuning.ts` imports it). Never hardcode a contract number.
- Non-contract constants live in `WORLD` (`src/sim/tuning.ts`) and are listed in `docs/notes/assumptions.md`.

## Rules
- Contract output format is exact: follow docs/lab + `docs/notes/assumptions.md`; do not invent requirements.
- Creative extras must be render-only or disabled in headless; headless output must not change.
- Every new rule gets a test in `tests/rules.test.ts` or a scenario in `tests/scenarios/` BEFORE it is called done.
- If a new ticket replaces an old rule: update/remove the old test with a one-line reason in `docs/notes/assumptions.md`. Never skip tests silently.
- Small commits, one change each. Never commit `.env`, keys, `dist/`, `node_modules/`.
