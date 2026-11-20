# Changelog

## v1.0.0 / Phase 4 — Ticket-04 "Bình minh" (Test Contract v1.3)
- **Contract v1.3:** `game.contract.json` thêm `bench_cmd` và `soak_cmd`; mọi số liệu và định dạng v1.0–v1.2 giữ nguyên.
- **Benchmark:** `node dist/bench.cjs --seed 42 --duration 30 --out bench.json`, cảnh chuẩn 200 Bóng Mực + 100 đom đóm, cửa sổ Chrome 1280×720, vsync tắt (`src/tools/bench.ts`, `src/sim/bench.ts`). Bóng Mực và đom đóm vẽ bằng InstancedMesh.
- **Soak:** `node --expose-gc dist/soak.cjs --seed 7 --nights 10 --out soak.json` (`src/tools/soak.ts`).
- **Bảng xếp hạng cục bộ:** nhập tên sau Bình Minh hoặc khi thua, top 10, lưu trên đĩa, màn hình ở menu, `--export-leaderboard`.
- **Nút ← Quay lại** trong game (mở menu tạm dừng) và ở Cài đặt, Bảng xếp hạng, màn giới thiệu Đêm; Esc cũng quay lại.
- **Dễ tiếp cận:** đổi phím (báo trùng, khôi phục mặc định, được lưu), phụ đề + mũi tên chỉ hướng, giảm chuyển động, chữ ≥ 18 px và chữ lớn ×1.25.
- **Đóng gói:** `npm start` chạy server cục bộ (`dist/serve.cjs`); `npm run release` đóng gói `dao-den-long-v1.0.0.tar.gz` (web tĩnh + server + headless); GitHub Release v1.0.0.
- **Thay đổi nhỏ có thể thấy:** `run_cmd` đổi từ `npm start` (vite preview) sang `node dist/serve.cjs`; `puppeteer` là phụ thuộc tuỳ chọn (chỉ bench cần).
- **Sáng tạo (sau tag phase-3):** chế độ "Đảo lớn (khám phá)" (x2, bờ lồi lõm, núi 25–45 m), đồi cát, hồ, sông rộng, thác; không đi xuyên cây, đá lớn, cột đèn; thêm cỏ hoa cây. Không đổi bản đồ chuẩn, headless, Test Contract. Dãy núi xa ngoài biển (Phase 3) bị bỏ.
- **Test:** thêm `tests/release.test.ts` (bảng xếp hạng, thống kê và cảnh bench, soak, đổi phím) và `tests/explore.test.ts`; test `contract v1.2` sửa thành v1.3 (dòng `Ticket-04 [REPLACED]`).


## Phase 3 — Ticket-03 "Đèn cạn dầu" (Test Contract v1.2)

### ⚠ Breaking changes
- **Luật thắng:** không còn thắng ngay khi tất cả đèn sáng (`game_over.reason: "all_lit"` bị bỏ). Nay chỉ thắng lúc bình minh nếu Mây còn sống và số đèn đang sáng ≥ ceil(0.6 × tổng): `won / dawn_survived`. Hết giờ mà thiếu đèn thì `lost / dawn`.
- **Thời lượng Đêm:** 300/330/360 → **240/270/300** giây.
- **Điểm:** mỗi đom đóm nạp +10 → **+5** (gồm cả thắp lại và châm dầu). Bỏ thưởng thời gian (`per_second_left: 0`). Thêm: thắp lại +40, trúng Tỏa Sáng khi đang `drain` +15, bình minh +50 + floor(fuel) mỗi đèn sáng.
- **Đèn đã sáng** nhận đom đóm để châm dầu (sự kiện `refuel`). Trước đây đèn đã sáng không nhận thêm.
- **Vùng an toàn** chỉ còn khi đèn sáng và fuel ≥ 30.
- **Bóng Mực** có thêm trạng thái `drain`. `wander` đi tới đèn yếu hoặc đèn tắt.
- **Sức chứa** không còn cố định 10: = 10 + 2 × số lần thắp thành công, tối đa 20.
- **Contract v1.2:**
  - `tuning` thêm `fuel_max, fuel_decay_per_s, fuel_per_mote, relight_cost, win_ratio, drain_per_s, low_fuel_threshold, capacity_max`.
  - Snapshot đèn thêm `fuel`, `ever_lit`, `relit_count`; `player` thêm `capacity`.
  - Scenario thêm `lanterns[].fuel/ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`.
  - Sự kiện thêm `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.

### Added
- Thanh dầu trên đèn đang sáng, nhấp nháy 1 Hz khi fuel < 30. Đèn tắt bị xẹp 20% và giấy có vết rách.
- Cài đặt "Bảng màu dễ phân biệt" (được lưu): viền và mắt Bóng Mực #00B3FF, cảnh báo UI trắng kèm ⚠.
- HUD: đom đóm đang mang / sức chứa (10–20 ô), số đèn sáng so với số cần giữ, gợi ý "Châm dầu" / "Thắp lại".
- Sáng tạo: suối uốn lượn chảy ra mép đảo thành thác đổ xuống biển mây; dãy núi tuyết xa ngoài biển mây. Chỉ là hình ảnh.

### Tests
- Sửa (lý do ghi ngay trong test, dòng `Ticket-03 [REPLACED]`): thời lượng Đêm, điểm +5, contract v1.2, "thắp hết đèn không kết thúc Đêm", scenario `p1-01` (điểm 200 → 150).
- Xoá: scenario `p1-02-win-all-lit` (luật bị thay), thay bằng `p3-04-dawn-win` / `p3-05-dawn-lose`.
- Thêm: `tests/fuel.test.ts` (18 test) và scenario `p3-01` … `p3-05`.

## Phase 2 — Ticket-02 "Ba hòn đảo" (Test Contract v1.1)
- Số liệu chuẩn thay số tự chọn, 3 Đêm với bản đồ chuẩn, lướt, rơi khỏi đảo, Gió Lạc, Bùa Gió, gió mạnh, tạm dừng, menu, âm thanh, HUD, bảng màu chuẩn.

## Phase 1 — PRD-0 (Test Contract v1.0)
- Đêm 1 chơi được, chế độ headless, `game.contract.json`.
