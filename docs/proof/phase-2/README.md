# Bằng chứng Phase 2 (Ticket-02, Test Contract v1.1)

Chạy lại: `npm ci && npm test && npm run proof -- phase-2` (ở tag `phase-2`).
`RESULTS.md` + các file `.jsonl` do `npm run proof` sinh ra, không sửa tay. Mỗi scenario chạy 2 lần, so byte-by-byte.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Phần 1: số liệu chuẩn trong `game.contract.json` (v1.1, thêm khoá dash/night2/night3) | `tests/cli.test.ts` so toàn bộ `tuning` với số của ticket | test | ĐẠT |
| Di chuyển 6 m/s, nhảy 7 m/s / −20, chỉ nhảy khi chạm đất | `tests/rules.test.ts` (movement) | test | ĐẠT |
| Lướt 14 m/s × 0.2 s, hồi 1.5 s, giữ độ cao trên không | test + `p2-01-dash.jsonl` | RESULTS.md | ĐẠT |
| Đom đóm: 20 điểm chuẩn khác nhau, +1 mỗi 240 tick, trần 30, nhặt ≤ 1.0 m và \|Δy\| ≤ 1.5 | test (fireflies) | test | ĐẠT |
| Đèn: 10 đom đóm, nạp nhiều lần, ≤ 2.0 m, gần nhất / id nhỏ | test (lanterns) + `p1-01` | RESULTS.md | ĐẠT |
| Vùng an toàn 6 m, đẩy ra ≤ 30 tick không sát thương | test + `p2-03-safe-zone-expel.jsonl` | RESULTS.md | ĐẠT |
| Tỏa Sáng: 3 / 5 m (3D từ chân+0.8) / 3 s, choáng 120, đẩy 4 m trong 15 tick, +5 | test + `p2-02-pulse-stun-push.jsonl` | RESULTS.md | ĐẠT |
| Bóng Mực: 4.0 (Đêm 3: 4.5) m/s, phát hiện 12 / bỏ 18 m, chạm, recoil 2 m / 60 tick, lịch sinh 2@300 rồi mỗi khoảng, tên trạng thái chuẩn | test (ink shades) + `p1-03` | RESULTS.md | ĐẠT |
| Bị đánh: −1 lửa, rơi floor(n/2) ra vành 1.5–2.5 m (480 tick), bất tử 90 tick | test | test | ĐẠT |
| Rơi khỏi đảo, hồi sinh | test + `p2-04-fall-respawn.jsonl` | RESULTS.md | ĐẠT |
| Thắng/thua: hết lửa luôn thua; thắng kể cả đúng tick hết giờ; dawn | test + `p1-02`, `p1-04` | RESULTS.md | ĐẠT |
| Thứ tự xử lý 12 bước, tạm dừng (tick tăng, sim_tick đứng yên, state paused) | code `src/sim/game.ts` + test + `p2-05-pause.jsonl` | RESULTS.md | ĐẠT |
| Phần 2: bản đồ chuẩn 3 Đêm (đèn, điểm sinh, cầu, bục, tầng, dốc, tháp) | `tests/nights.test.ts` + `p2-06`, `p2-10` | RESULTS.md | ĐẠT |
| Phần 3: Gió Lạc | test + `p2-07`, `p2-08` | RESULTS.md | ĐẠT |
| Phần 3: Bùa Gió | test + `p2-09` | RESULTS.md | ĐẠT |
| Gió mạnh Đêm 3 (logic) | test + `p2-11-night3-wind.jsonl` | RESULTS.md | ĐẠT |
| Phần 4: snapshot/scenario/input/event v1.1, `--night 1/2/3` | test (contract, cli) | test | ĐẠT |
| Headless 1 Đêm đầy đủ ≤ 30 s | test `full night runs headless well under 30 s`; `p2-12`, `p2-13` | đo: ~0.1–0.25 s/đêm (Node 22, Windows 11) | ĐẠT |
| Bảng màu chuẩn (≤ 10%/kênh) | `tests/palette.test.ts` (21 màu) | test | ĐẠT |
| Regression Phase 1 với số chuẩn | `p1-01..04` + test cũ đã chuyển sang số chuẩn | RESULTS.md | ĐẠT |
| Chuỗi 3 Đêm, menu, giới thiệu (Ông Đăng), Bình Minh | Chơi thử | ảnh chụp | CHƯA CÓ BẰNG CHỨNG (cần chụp khi chơi) |
| Tạm dừng (menu), Cài đặt lưu giữa các lần mở | Chơi thử | ảnh chụp | CHƯA CÓ BẰNG CHỨNG |
| Âm thanh (nhạc nền + 10 hiệu ứng) | Chơi thử | video demo | CHƯA CÓ BẰNG CHỨNG |
| HUD đầy đủ + mũi tên chỉ đèn | Chơi thử | ảnh chụp | CHƯA CÓ BẰNG CHỨNG |
| ≥ 30 FPS trung bình ở 1280×720 | Bộ đếm FPS góc dưới trái (`?quality=low` nếu máy yếu) | ảnh chụp kèm cấu hình máy | CHƯA ĐO |
