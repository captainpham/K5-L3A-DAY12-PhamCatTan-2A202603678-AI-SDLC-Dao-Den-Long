---
name: verify-phase
description: Verify a phase of Đảo Đèn Lồng and save real evidence. Use after implementing a ticket requirement, before tagging phase-N, or when asked to "kiểm chứng" / "lưu bằng chứng".
---

# Verify a phase and save evidence

1. For each requirement of the current ticket, make sure there is a check written FROM THE TICKET TEXT:
   - pure rule -> a test in `tests/rules.test.ts` (Night 1 rules) or `tests/nights.test.ts` (Night 2/3 maps, pads, drifters, charms, wind)
   - every new feature -> at least one scenario `tests/scenarios/pN-NN-name.json`:
     `{ "requirement": "...", "night": 1, "seed": 1, "ticks": N, "snapshot_every": 10, "scenario": {...}, "inputs": {...},
        "expect": { "events": ["ordered", "subsequence"], "end": { "state": "won" } } }`
     (`night_start` is always emitted at tick 0; `"events": []` means no other events)
   - colours -> `tests/palette.test.ts`
2. Regression: Phase 1 scenarios `p1-*` must still pass with the standard numbers.
3. Run `npm run typecheck && npm test`. All green, or stop and report what is red (and whether the test or the game is wrong).
4. Run `npm run proof -- phase-N`: every scenario runs twice through `dist/headless.cjs` (determinism),
   outputs go to `docs/proof/phase-N/*.jsonl` + `RESULTS.md`. Never edit those outputs by hand.
5. Update `docs/proof/phase-N/README.md`: requirement -> check -> evidence -> ĐẠT / CHƯA ĐẠT (+ reason).
6. Things only visible on screen (HUD, menus, sound, FPS at 1280x720): run `npm run dev`, ask the user for a screenshot,
   save it into `docs/proof/phase-N/` and say which requirement it shows.
7. Report: what passed, what is not done, token estimate for `docs/notes/ai-log.md`.
