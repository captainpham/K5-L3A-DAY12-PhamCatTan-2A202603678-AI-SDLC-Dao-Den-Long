# Bằng chứng Phase 1

Chạy lại toàn bộ: `npm ci && npm test && npm run proof` (ở tag `phase-1`).
`RESULTS.md` và các file `.jsonl` trong thư mục này do `npm run proof` sinh ra, không sửa tay.

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| R1 | Đi lại, nhảy, camera | Unit test `tick model & movement` (6 test) + scenario 01 | `tests/rules.test.ts`, `01-prd-sample.jsonl` | ĐẠT (logic). Camera: xem ảnh/video |
| R2 | Đêm 1, 5 đèn | Test `night 1 has 5 lanterns L1..L5` | `tests/rules.test.ts` | ĐẠT |
| R3 | Nhặt đom đóm | Test biên `pickup_radius` (≤ r nhặt, r+0.01 không), capacity; scenario 01 | `01-prd-sample.jsonl` (event `mote_picked` tick 35) | ĐẠT |
| R4 | Nạp, thắp đèn | Test deposit/lit/partial/out-of-range; scenario 02 | `02-win-all-lit.jsonl` | ĐẠT |
| R5 | Bóng Mực đuổi, chạm mất máu | Test chase speed, hit + invuln, safe_radius, spawn; scenario 03, 05, 07 | `03-...jsonl`, `05-...jsonl`, `07-...jsonl` | ĐẠT |
| R6 | Tỏa sáng | Test stun/push/cost/cooldown/radius; scenario 04 | `04-pulse-stun-push.jsonl` | ĐẠT |
| R7 | Thắng / thua / điểm | Scenario 02 (won), 03 (no_flames), 06 (dawn) | `RESULTS.md` | ĐẠT |
| R7 | HUD, chơi lại | Chơi thử bản web | ảnh chụp / video demo | CHƯA CÓ BẰNG CHỨNG (cần chụp ảnh khi chơi) |
| C1 | Contract: CLI, JSONL, mã thoát, tất định | `tests/cli.test.ts` (exit 0/2, làm tròn 3 số, 2 lần chạy giống hệt); mọi scenario chạy 2 lần | `RESULTS.md` | ĐẠT |

Tự động hoá: CI (`.github/workflows/ci.yml`) chạy build + typecheck + test + so sánh tất định trên Ubuntu và macOS mỗi lần push.
