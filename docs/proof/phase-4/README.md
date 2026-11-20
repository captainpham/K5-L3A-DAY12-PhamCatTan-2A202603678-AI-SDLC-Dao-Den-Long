# Bằng chứng Phase 4 (Ticket-04, Test Contract v1.3, Release v1.0.0)

Chạy lại: `npm ci && npm run build && npm test && npm run proof -- phase-4 && npm run soak && npm run bench` (ở tag `phase-4`).
`RESULTS.md`, `*.jsonl`, `bench.json`, `soak.json` do lệnh sinh ra, không sửa tay. Ảnh chụp do script Puppeteer lái giao diện thật chụp lại (`bench-scene.png` do chính lệnh bench chụp).
Máy đo: Windows 11, AMD Ryzen 9 5900HS + Radeon Graphics (iGPU), 15 GB RAM, Node 22, Chrome 131. Số trên máy chấm của giảng viên sẽ khác.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| 1. Bench: cảnh chuẩn (Đêm 1, 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng fuel 100, Mây đứng yên) | `tests/release.test.ts` (cảnh, tất định theo seed, không sinh/sát thương/nhặt/hao dầu/kết thúc, Bóng Mực vẫn di chuyển) | test + `bench-scene.png` | ĐẠT |
| 1. Camera bay vòng r 30 m, Y 15 m, bắt đầu (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng | test `camera orbit` | test | ĐẠT |
| 1. Công thức avg_fps, p1_low_fps (k = ceil(1%N)), p95 | test `statistics follow the ticket definitions` | test | ĐẠT |
| 1. Cửa sổ 1280×720, vsync tắt, 3 s khởi động, đo đúng `--duration`, thoát mã 0 | chạy `npm run bench` thật | `bench.json` (frames 9163, vsync_off true) | ĐẠT |
| 1. Ngưỡng: avg_fps ≥ 60, p1_low_fps ≥ 30, load_ms ≤ 10000 | số đo máy dev (tham khảo): avg 305.4, p1 low 150.5, p95 4.6 ms, load 1172 ms | `bench.json` | ĐẠT trên máy dev; **máy chấm chưa đo** |
| 1. `peak_mem_mb` | bản web không đo được RSS của trình duyệt | `null` + `peak_js_heap_mb` 15, giải thích trong README | ĐẠT (theo cho phép của ticket) |
| 2. Soak 10 Đêm, 1→2→3, seed 7+i, input ngẫu nhiên theo seed (30 tick đổi hướng; 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác) | `npm run soak` + test (tất định, 0 sập, bộ nhớ) | `soak.json` (crashes 0, 41.2 → 43.8 MB = ×1.06) | ĐẠT (≤ ×1.2). Lưu ý: chạy `node` không có `--expose-gc` từng đo ×1.18, sát ngưỡng |
| 3. Bảng xếp hạng: tên 3–12 `[A-Za-z0-9_]` (+ tiếng Việt), top 10, điểm giảm dần, bằng điểm ai trước đứng trên, ISO 8601 có múi giờ | `tests/release.test.ts` (leaderboard) | test | ĐẠT |
| 3. Lưu trên đĩa, còn sau khi tắt mở lại; có màn hình từ menu | khởi động lại server thật rồi đọc lại; UI chụp lại | `name-entry.png`, `leaderboard.png`, file `~/.dao-den-long/leaderboard.json` | ĐẠT |
| 3. `--export-leaderboard out.json` → `{"entries": [...]}` đúng thứ tự | test chạy `dist/serve.cjs` thật | test | ĐẠT |
| 4. Đổi phím: 9 hành động, báo trùng, khôi phục mặc định, được lưu | test (`conflicts`) + UI: gán Lướt = E → cảnh báo; tải lại trang vẫn còn; khôi phục về Shift trái | `keys-conflict.png`, `settings-accessibility.png` | ĐẠT |
| 4. Phụ đề + mũi tên: Bóng Mực xuất hiện, gió sắp thổi, 10 giây cuối, đèn dầu < 30 | UI: ép tick 300 → phụ đề + 2 mũi tên tím; các chỉ báo khác cùng cơ chế `caption()` | `captions.png` | ĐẠT (Bóng Mực chụp; gió, 10 giây cuối, dầu < 30 chưa có ảnh riêng) |
| 4. Giảm chuyển động (tắt rung camera, chớp màn hình) | code (`View.shake`, `flash`, `body.calm`) + tuỳ chọn trong Cài đặt | `settings-accessibility.png` | ĐẠT (logic); chưa có clip so sánh |
| 4. Chữ UI ≥ 18 px ở 1280×720; chữ lớn ×1.25 | CSS `1rem = 18px`, `html.large = 22.5px` | `night1-hud.png`, `settings-accessibility.png` | ĐẠT (đọc từ CSS, chưa có test đo pixel tự động) |
| 5. README: mô tả, ảnh, yêu cầu hệ thống, cài đặt ≤ 3 lệnh, điều khiển, test, headless, bench, soak | `README.md` | file | ĐẠT. **Chưa thử trên máy sạch khác** |
| 5. CHANGELOG 4 phase, CREDITS, LICENSE | `CHANGELOG.md`, `CREDITS.md`, `LICENSE` | file | ĐẠT |
| 5. GitHub Release v1.0.0 có bản chạy được | `npm run release` → `release/dao-den-long-v1.0.0.tar.gz` (web tĩnh + server + headless) | file local | **CHƯA ĐẠT**: Release phải tạo trên GitHub (máy chưa có `gh`) |
| 6. Contract v1.3: `contract_version`, `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên | `tests/cli.test.ts`, `tests/release.test.ts`; 21 scenario headless chạy 2 lần | `RESULTS.md` | ĐẠT |
| 7. Retro 1–2 trang | `docs/notes/retro.md` | file | ĐẠT |
| 7. Video demo `.mp4` < 5 phút | cần người quay | — | **CHƯA ĐẠT**: chưa quay |
| Regression Phase 1–3 | 141 test + `p1-*`, `p2-*`, `p3-*` | `RESULTS.md` | ĐẠT |
