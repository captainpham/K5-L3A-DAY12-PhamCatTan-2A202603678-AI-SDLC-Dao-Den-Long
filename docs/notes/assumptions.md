# Giả định và tiêu chí nghiệm thu

## Phase 1 (PRD-0 + Test Contract v1.0)

### Tiêu chí nghiệm thu (mỗi yêu cầu một câu kiểm tra được)

| ID | Yêu cầu PRD-0 | Tiêu chí nghiệm thu |
|---|---|---|
| R1 | Đi lại, nhảy, camera 3D | `move [0,1]` 60 tick -> đi đúng `player_speed` m theo +Z; yaw 90° -> đi theo +X; nhảy -> Y > 0 rồi về 0 |
| R2 | 1 màn Đêm 1, đảo tròn, 5 Đèn Lồng Lớn | Snapshot tick 0 có `L1..L5`; đảo bán kính 40 m |
| R3 | Đom đóm rải rác, nhặt được | Đom đóm ở khoảng cách ≤ `pickup_radius` bị nhặt, có event `mote_picked`, +`per_mote` điểm |
| R4 | Nạp ánh sáng thắp đèn | `interact` gần đèn (≤ `interact_radius`) -> `deposit`; đủ `lantern_cost` -> `lantern_lit`, +`per_lantern` |
| R5 | Bóng Mực xuất hiện và đuổi | Sinh ngẫu nhiên có `shade_spawned`; tiến về người chơi `shade_speed` m/s; chạm (≤ `shade_hit_radius`) -> `player_hit` |
| R6 | Tỏa sáng xua Bóng Mực, tốn ánh sáng | `pulse` -> Bóng Mực trong `pulse_radius` bị `stunned` `pulse_stun_s` giây, bị đẩy `pulse_push_m`; trừ `pulse_cost` đom đóm |
| R7 | Thắng/thua/điểm/HUD/chơi lại | Thắp đủ 5 -> `won/all_lit`; hết lửa -> `lost/no_flames`; hết giờ -> `lost/dawn`; HUD hiện lửa, đom đóm, đèn, giờ, điểm; R/nút để chơi lại |
| C1 | Test Contract | CLI đúng tham số; JSONL snapshot/event/end; mã thoát 0/2; tất định |

### Giả định cho chỗ PRD-0 mơ hồ

| Chỗ mơ hồ | Giả định của tôi | Lý do |
|---|---|---|
| "Máu" | Là `flames` (ngọn lửa), bắt đầu 3; mỗi lần bị chạm mất 1 | Contract gọi máu là `flames` |
| "Tỏa sáng tốn ánh sáng" | Trừ `pulse_cost` = 1 đom đóm đang mang; mang ít hơn thì không tỏa sáng được (không có event) | Ánh sáng = đom đóm đang mang |
| Pulse trúng Bóng Mực đang choáng | Vẫn tính, làm mới thời gian choáng, vẫn cộng `per_stun` | Đơn giản; cooldown 2 s hạn chế lạm dụng |
| Bóng Mực "sợ đèn" | Chỉ **đèn đã thắp** có vùng an toàn `safe_radius` = 6 m; Bóng Mực bị đẩy ra ngoài, cách tâm `safe_radius + 0.01` (vì "trong bán kính" là ≤ r) | Đèn chưa thắp chưa có ánh sáng |
| Nhặt đom đóm | Tự động khi đi qua, không cần nút | `interact` dành cho nạp đèn |
| Chọn đèn khi nạp | Đèn chưa thắp gần nhất trong `interact_radius`; hoà thì theo thứ tự id | Tránh mơ hồ |
| Nạp bao nhiêu | Nạp tối đa đến `lantern_cost`, phần dư giữ lại | Không lãng phí |
| Rơi đom đóm khi bị chạm | `floor(carried × 0.5)` đom đóm tan vào sương (không rơi xuống đất) | Rơi xuống đất sẽ bị tự nhặt lại ngay |
| Rơi khỏi đảo | Không có: mép đảo là tường (`fall_enabled: false`), không có event `fall` | Giảm phạm vi Phase 1 |
| Điểm thưởng cuối | Chỉ khi **thắng**: `floor(time_left_s) × per_second_left + flames × per_flame_left` | Thua thì không thưởng |
| Thứ tự kiểm tra kết thúc | Cùng 1 tick: `won` > `no_flames` > `dawn` | Thắng là thắng |
| Thứ tự trong 1 tick | timers -> di chuyển/nhảy -> nhặt -> nạp -> pulse -> Bóng Mực di chuyển -> va chạm -> sinh mới -> đồng hồ -> kết thúc | Cố định để tất định |
| Bóng Mực ở snapshot | `pos[1] = 1.0` (lơ lửng, tâm); trạng thái `chase` hoặc `stunned` | Contract: tâm Bóng Mực |
| `move` ngoài [-1,1] | Kẹp về [-1,1] rồi chuẩn hoá; sai kiểu dữ liệu -> mã thoát 2 | Khoan dung với số, chặt với kiểu |
| Scenario id đèn lạ (vd `L9`) | Bỏ qua | Đêm 1 chỉ có L1..L5 |
| Scenario có `motes` nhưng không nói `random_motes` | Danh sách thay thế, vẫn sinh thêm ngẫu nhiên (mặc định `true`) | Đúng chữ "thay thế danh sách ban đầu" |

### Hằng số ngoài contract (`WORLD` trong `src/sim/tuning.ts`)

Đảo bán kính 40 m; đèn trên vòng 25 m (L1 ở +Z, cách nhau 72°); nhảy 7 m/s, trọng lực 20 m/s²;
25 đom đóm ban đầu, thêm 1 mỗi 3 s, tối đa 30; Bóng Mực đầu tiên ở 10 s, rồi mỗi 20 s, tối đa 4, sinh ở mép đảo (36 m) cách người chơi ≥ 15 m.

### Điều khiển -> input contract

Camera nhìn theo hướng `(sin yaw, cos yaw)`. Với công thức xoay của contract, `W` = `z +1`, `S` = `z -1`, `A` = `x +1`, `D` = `x -1` (bên phải màn hình là `x -1`).
