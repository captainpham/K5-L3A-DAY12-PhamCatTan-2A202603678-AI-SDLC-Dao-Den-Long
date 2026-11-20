# Đảo Đèn Lồng — agent guide

3D third-person game (TypeScript). Lab brief: `docs/lab/`. Current phase: **Phase 2 / Ticket-02 / Test Contract v1.1**
(3 nights). Spec + assumptions + acceptance criteria: `docs/notes/assumptions.md`.

## Commands
- Install/build: `npm ci && npm run build` (headless -> `dist/headless.cjs`, web -> `dist/web/`)
- Play: `npm start` (http://localhost:4173) · dev: `npm run dev` · low quality: add `?quality=low` to the URL
- Test (rules, nights, CLI, palette, scenarios): `npm test` · typecheck: `npm run typecheck`
- Evidence: `npm run proof -- phase-N` (writes `docs/proof/phase-N/`, never edit those files by hand)
- Headless: `node dist/headless.cjs --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f.json] [--inputs f.json]`

## Architecture (do not break)
- `src/sim/` = pure deterministic logic, NO DOM/Three.js/Math.random/Date. Shared by game and headless.
  - `game.ts` follows the Ticket-02 tick order (12 steps, comment at the top). Keep that order.
  - `maps.ts` = standard maps (angles from +X toward +Z). `tuning.ts` = contract tuning + `STD` constants.
- Contract numbers come ONLY from `game.contract.json`; other standard numbers ONLY from `STD`. Never hardcode.
- `src/headless/cli.ts` + `src/sim/contract-io.ts` = Test Contract v1.1 I/O.
- `src/game/` = Three.js view, HUD, menus, audio (render only). Colours only from `PALETTE` in `models.ts`.

## Rules
- Contract output format is exact: snapshot/event/end fields as in Ticket-02 Part 4; shade states spawning/wander/chase/recoil/stunned.
- Creative extras must be render-only (`src/game/decor/`) or off in headless; headless output must not change.
- Every rule gets a test in `tests/*.test.ts` and every new feature a scenario in `tests/scenarios/` BEFORE it is called done.
- When a ticket replaces a rule: update/remove the old test with a one-line reason in `docs/notes/assumptions.md`. Never skip tests silently.
- When a test fails, first decide whether the test or the game is wrong (read the ticket line), then fix that one.
- Small commits, one change each. Never commit `.env`, keys, `dist/`, `node_modules/`.
