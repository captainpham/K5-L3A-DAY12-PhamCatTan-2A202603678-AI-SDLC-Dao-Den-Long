# Changelog

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
