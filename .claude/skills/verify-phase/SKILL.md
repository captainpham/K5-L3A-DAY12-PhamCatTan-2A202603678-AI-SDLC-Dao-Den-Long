---
name: verify-phase
description: Verify a phase of Đảo Đèn Lồng and save real evidence. Use after implementing a ticket requirement, before tagging phase-N, or when asked to "kiểm chứng" / "lưu bằng chứng".
---

# Verify a phase and save evidence

1. For each requirement of the current ticket, make sure there is a check:
   - pure rule -> a test in `tests/rules.test.ts`
   - behaviour over time -> a scenario file `tests/scenarios/NN-name.json`:
     `{ "requirement": "...", "seed": 1, "ticks": N, "snapshot_every": 10, "scenario": {...}, "inputs": {...},
        "expect": { "events": ["ordered", "subsequence"], "end": { "state": "won" } } }`
   Write the check from the ticket text, not from what the code currently does.
2. Run `npm run typecheck && npm test`. All green, or stop and report what is red.
3. Run `npm run proof -- phase-N`. It runs every scenario twice through `dist/headless.cjs`, checks determinism,
   writes `docs/proof/phase-N/*.jsonl` and `RESULTS.md`. Never edit those outputs by hand.
4. Update `docs/proof/phase-N/README.md`: table requirement -> check -> evidence file -> ĐẠT / CHƯA ĐẠT (+ reason).
5. Things only visible on screen (HUD, lights): run `npm run dev`, take a screenshot into `docs/proof/phase-N/`,
   say which requirement it shows.
6. Report: what passed, what is not done, token/cost estimate for the AI log.
