# ADR 0001: Đèn có nhiên liệu và luật thắng "giữ đảo sáng tới bình minh"

- Trạng thái: Chấp nhận (Phase 3, Ticket-03, Test Contract v1.2)
- Thay thế: luật "đèn đã sáng không nhận thêm đom đóm", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi tất cả đèn sáng", công thức điểm Ticket-02.

## Bối cảnh

Playtest: người chơi giỏi thắp hết đèn trong 2 phút và Đêm kết thúc sớm. Ticket-03 muốn căng thẳng tới cuối Đêm:
đèn có thể tắt lại, mục tiêu là còn đủ đèn sáng lúc bình minh.

## Quyết định

**1. Mô hình trạng thái đèn.** Trước: `unlit -> lit` (một chiều, `lit` là trạng thái cuối). Nay là một vòng:

```text
          10 đom đóm (lần đầu)            fuel <= 0 (hao 1/s + Bóng Mực hút 5/s mỗi con)
 unlit ─────────────────────────► lit ─────────────────────────────────────────► unlit (ever_lit = true)
   ▲                               │  ▲                                                │
   │                               │  └── châm dầu: +10 fuel / đom đóm, tối đa 100 ◄───┘ (lit)
   └───────────────────────────────┴── thắp lại: chỉ 5 đom đóm (relight, relit_count++)
```

- Dữ liệu đèn: `lit`, `deposited`, `fuelU`, `everLit`, `relitCount`.
- **Nhiên liệu lưu bằng số nguyên đơn vị 1/60** (`fuelU`, tối đa 6000), làm đúng theo khuyến nghị của ticket. Hao 1/s đúng bằng 1 đơn vị/tick, hút 5/s bằng 5 đơn vị/tick. Không có sai số số thực. Chỉ làm tròn 1 chữ số thập phân khi ghi snapshot (`fuel1()`).
- Hao dầu và hút dầu nằm trong bước 2 (timers). Đèn hết dầu tắt ngay sau bước 2 (`lantern_out`), trước khi Mây di chuyển và tương tác, đúng thứ tự ticket.
- **Vùng an toàn** là hàm `hasSafeZone(l) = lit && fuelU >= 30*60`. Nhờ vậy, đúng 30 vẫn còn vùng an toàn.
- Tương tác chọn trong các đèn "nhận được" (chưa sáng, hoặc sáng nhưng chưa đầy): gần nhất, bằng nhau thì id nhỏ hơn. Đèn sáng thì châm dầu (`refuel`), đèn tắt thì thắp hoặc thắp lại (`deposit` + `lantern_lit {relight}`).

**2. Bóng Mực có thêm trạng thái `drain`.**
- `wander` có mục tiêu theo thứ tự: đèn sáng yếu (< 30) gần nhất, nếu không có thì đèn tắt gần nhất. Bóng đi tới đó với tốc độ của Bóng Mực.
- Cách đèn yếu ≤ 2 m thì chuyển sang `drain`: đứng yên, hút 5/s, phát `fuel_drain` mỗi 60 tick.
- Rời `drain`:
  - sang `chase` khi Mây ở trong 6 m;
  - sang `stunned` khi trúng Tỏa Sáng (+15 điểm thay vì +5);
  - sang `wander` khi đèn tắt, khi được châm lên ≥ 30, hoặc khi cách đèn > 2 m.
- Châm dầu lên ≥ 30 thì dùng lại cơ chế "đẩy ra mép 30 tick, không sát thương" đã có khi đèn vừa thắp.

**3. Luật thắng.**
- Bỏ "thắng ngay khi tất cả đèn sáng".
- Ở bước 11, sau mọi cập nhật của tick: hết lửa thì luôn thua `no_flames`. Nếu không, khi hết giờ thì xét số đèn đang sáng ≥ `ceil(0.6 × tổng)` (3/5, 4/6, 5/7): đạt thì `won/dawn_survived`, không thì `lost/dawn`.
- Điểm bình minh: mỗi đèn đang sáng +50 + floor(fuel), mỗi lửa +50. Bỏ thưởng thời gian (`per_second_left: 0`).

**4. Sức chứa** là getter `capacity = min(20, 10 + 2 × successfulLights)`. Biến `successfulLights` đặt lại mỗi Đêm vì mỗi Đêm là một `Game` mới. Đèn đặt sẵn bằng scenario không tính.

## Hệ quả

- Contract v1.2 thêm trường mới:
  - Snapshot: `fuel`, `ever_lit`, `relit_count`, `player.capacity`.
  - Sự kiện: `refuel`, `lantern_out`, `fuel_drain`.
  - Lý do kết thúc: `dawn_survived`.
- Test cũ bị thay, đã sửa hoặc xoá có ghi lý do trong test và trong `CHANGELOG.md`:
  - "thắng khi thắp hết đèn" thành "thắp hết đèn không kết thúc Đêm";
  - điểm +10 thành +5;
  - thời lượng các Đêm;
  - contract v1.1 thành v1.2;
  - scenario `p1-02-win-all-lit` bị xoá.
- Rủi ro đã chấp nhận: hành vi `wander` khi không có đèn yếu là "đi về đèn tắt gần nhất", vì ticket ghi "như trước". Ticket-02 không định nghĩa rõ điều này, nên tôi ghi lại như một giả định trong `docs/notes/assumptions.md`.
