# Bằng chứng Phase 3 (Ticket-03, Test Contract v1.2)

Chạy lại: `npm ci && npm test && npm run proof -- phase-3` (ở tag `phase-3`).
`RESULTS.md` + `.jsonl` do `npm run proof` sinh ra, không sửa tay. Mỗi scenario chạy 2 lần, so byte-by-byte.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| 1. Nhiên liệu: 100 khi thắp, hao 1/s, tắt khi ≤ 0 (`lantern_out`, deposited 0, ever_lit) | `tests/fuel.test.ts` + `p3-01-fuel-out-relight` | RESULTS.md | ĐẠT |
| 1. Thắp lại 5 đom đóm, +40, `relight: true` | test + `p3-01` | RESULTS.md | ĐẠT |
| 1. Châm dầu, chọn đèn nhận được gần nhất / id nhỏ | test + `p3-02-refuel` | RESULTS.md | ĐẠT |
| 1. Dầu tính bằng số nguyên 1/60 | `src/sim/game.ts` (`fuelU`), ADR 0001 | code | ĐẠT |
| 2. fuel < 30 mất vùng an toàn; đúng 30 còn | test | test | ĐẠT |
| 2. Bóng Mực `drain`: chọn đèn, hút 5/s cộng dồn, `fuel_drain` mỗi 60 tick, chuyển trạng thái | test + `p3-03-shade-drain` | RESULTS.md | ĐẠT |
| 2. Châm lên ≥ 30 đẩy Bóng Mực ra ≤ 30 tick, không sát thương | test | test | ĐẠT |
| 3. Thắng lúc bình minh (3/5, 4/6, 5/7), không thắng sớm, no_flames ưu tiên | test + `p3-04-dawn-win`, `p3-05-dawn-lose` | RESULTS.md | ĐẠT |
| 3. Thời lượng 240/270/300 | test (rules, nights, cli) | test | ĐẠT |
| 4. Sức chứa 10 + 2 × lần thắp, tối đa 20 | test | test | ĐẠT |
| 5. Điểm mới | test (fuel, lanterns) + `p1-01`, `p3-*` | RESULTS.md | ĐẠT |
| 7. Contract v1.2 (tuning, snapshot, scenario, events) | `tests/cli.test.ts`, `tests/fuel.test.ts` | test | ĐẠT |
| Regression Phase 1–2 không bị thay | `p1-01, p1-03, p1-04, p2-*` + test cũ (đã sửa phần bị thay, có lý do) | RESULTS.md | ĐẠT |
| ADR, changelog, test cũ có lý do | `docs/adr/0001-…`, `CHANGELOG.md`, dòng `Ticket-03 [REPLACED]` trong test | file | ĐẠT |
| Hiển thị thanh dầu, nhấp nháy 1 Hz, HUD sức chứa | Chơi thử | ảnh chụp | CHƯA CÓ BẰNG CHỨNG |
| 6. Chế độ mù màu (được lưu) | Chơi thử, bật trong Cài đặt | ảnh chụp | CHƯA CÓ BẰNG CHỨNG |
