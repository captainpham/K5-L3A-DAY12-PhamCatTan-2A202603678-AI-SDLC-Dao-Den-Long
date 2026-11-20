# Kết quả scenario headless (phase-1)

> File này do `npm run proof` sinh ra, không sửa tay. Mỗi scenario chạy **2 lần** bằng CLI đã build và so sánh byte-by-byte (tính tất định).

- Commit: `9818fc1` (working tree có thay đổi chưa commit)
- Node: v22.22.3 · win32/x64
- Thời điểm: 2026-11-20T08:29:20.790Z

| Scenario | Yêu cầu kiểm chứng | Kết quả cuối | Đánh giá |
|---|---|---|---|
| 01-prd-sample | R1 movement + R3 pickup + R5 pulse (lab sample scenario/inputs from Test Contract v1.0) | playing @ tick 240, score 30 | ĐẠT |
| 02-win-all-lit | R4 deposit/light lanterns + R7 win (all_lit) + score bonus | won @ tick 17, score 998 (all_lit) | ĐẠT |
| 03-shade-hits-until-lost | R5 shades chase + hit costs flames + R7 lose (no_flames) | lost @ tick 300, score 0 (no_flames) | ĐẠT |
| 04-pulse-stun-push | R6 pulse stuns + pushes shades within pulse_radius, costs light, cooldown | playing @ tick 300, score 20 | ĐẠT |
| 05-safe-radius | Shades fear lit lanterns: never inside safe_radius of a lit lantern | playing @ tick 900, score 0 | ĐẠT |
| 06-dawn | R7 lose at dawn when the night timer reaches 0 | lost @ tick 300, score 0 (dawn) | ĐẠT |
| 07-full-night-random | Default Night 1 with random fireflies + shades, idle player, seed 42 (determinism over a long run) | lost @ tick 1381, score 0 (no_flames) | ĐẠT |

Đầu vào: `tests/scenarios/<tên>.json` · Đầu ra thật: `docs/proof/phase-1/<tên>.jsonl`
