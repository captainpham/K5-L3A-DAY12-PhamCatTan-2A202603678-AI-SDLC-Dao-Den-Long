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

## Phase 2

Ticket-02 "Ba hòn đảo", Test Contract **v1.1**. Mọi số liệu tự chọn ở Phase 1 bị **thay** bằng số chuẩn của ticket
(`game.contract.json` + `STD` trong `src/sim/tuning.ts`), bản đồ chuẩn nằm trong `src/sim/maps.ts`.

### Đổi hướng so với Phase 1 (ghi lý do)

| Luật Phase 1 (tôi tự chọn) | Phase 2 (chuẩn) | Test cũ xử lý thế nào |
|---|---|---|
| Điểm `per_mote` khi **nhặt** | +10 cho mỗi đom đóm **nạp** vào đèn | Sửa test: nhặt không cộng điểm, nạp mới cộng |
| `lantern_cost` 5, `pickup_radius` 1.5, `interact_radius` 3, `pulse_cost` 1, `pulse_radius` 6 (XZ) | 10 / 1.0 (+ chênh cao ≤ 1.5) / 2.0 / 3 / 5 (khoảng cách **3D** từ chân+0.8 m) | Test dùng số từ contract, chỉ sửa test bán kính pulse thành 3D |
| Bóng Mực 3.5 m/s, luôn đuổi, trạng thái `chase/stunned` | 4.0 m/s (Đêm 3: 4.5), phát hiện 12 m / bỏ 18 m, trạng thái `spawning/wander/chase/recoil/stunned` | Sửa test tốc độ, thêm test phát hiện |
| Vùng an toàn: đẩy ra `r + 0.01` | Chặn ở mép 6 m; bóng ở trong khi đèn vừa thắp bị đẩy ra trong ≤ 30 tick, không gây sát thương | Test đổi từ `> 6` thành `≥ 6`, thêm test đẩy ra |
| Đom đóm rơi khi bị đánh tan biến | Rơi ra vành 1.5–2.5 m, tồn tại 480 tick, nhặt lại được từ tick sau | Test mới |
| Không rơi khỏi đảo (`fall_enabled: false`) | Rơi khi Y < −10, mất 1 lửa + toàn bộ đom đóm, chờ 60 tick rồi hồi sinh | Test + scenario mới |
| Thắng ưu tiên trước thua cùng tick | **Hết lửa luôn thua**, rồi mới xét thắng, rồi dawn | Sửa thứ tự |
| Đảo 52 m (sáng tạo tạm thời trước khi có ticket) | **Bản đồ chuẩn: Đêm 1 bán kính 40 m** | Bỏ thay đổi 52 m; cây cỏ, động vật đặt theo bản đồ chuẩn |
| Scenario 01–07 (số Phase 1) | Viết lại thành `p1-01..04` (hồi quy bằng số chuẩn) + `p2-01..13` | `git rm` các file cũ, lý do: số liệu đổi theo ticket |

### Giả định cho chỗ Ticket-02 chưa nói rõ

| Chỗ chưa rõ | Giả định |
|---|---|
| Tăng tốc ≤ 0.1 s | Tức thời (0 s, thoả "≤ 0.1 s"): 60 tick đi đúng 6.0 m |
| Thời gian trạng thái `spawning` | 60 tick (không di chuyển, không gây sát thương) |
| Bóng Mực `wander` | 1.5 m/s, đổi hướng ngẫu nhiên (theo seed) mỗi 120 tick; không đi ra ngoài đảo, không leo vách > 0.35 m |
| Chạm Bóng Mực | So `player.pos` (chân) với `shade.pos` (tâm, cao hơn mặt đất 1 m): XZ ≤ 1.0 và \|Δy\| ≤ 1.5 |
| Tương tác đèn | XZ ≤ 2.0 và \|Δy\| ≤ 1.5 (cùng luật độ cao với nhặt) |
| Trần 30 đom đóm | Tính mọi đom đóm đang có (cả loại rơi); "điểm trống" = điểm sinh không có đom đóm `random` |
| Điểm xuất phát Đêm 2 / Đêm 3 | Đêm 2: (0,0,0) đảo A. Đêm 3: **(0,0,−30)** tầng 0, quay mặt +Z (tâm đảo là tháp chuông) |
| Góc trong bản đồ | Đo từ +X về phía +Z: `(r cos θ, r sin θ)`; khớp với dốc 30°/150° nối lên tầng 1 ở nửa z > 0 |
| Gió Đêm 3 | Bắt đầu ở sim tick 1800, 3600, …, kéo dài 300 tick, hướng ngẫu nhiên theo seed (`dir_deg` 0–359 đo từ +X về +Z) |
| Lướt trên không | `vy = 0` trong lúc lướt và sau khi lướt rơi tiếp từ `vy = 0` |
| Gió Lạc chạm khi `idle` | Cũng cướp nếu Mây đang mang > 0 (ticket ghi "Chạm" không giới hạn trạng thái) |
| Gió Lạc sinh | Tại sim tick 1200, 2400, … ở một điểm sinh Bóng Mực ngẫu nhiên ("điểm sương"), không có event riêng |
| Gió Lạc `removed` | Xoá khỏi mảng `drifters` ngay khi hết thời gian |
| Pulse trúng Gió Lạc `idle` | Không có tác dụng |
| `night_start` | Ghi ở tick 0, **sau** snapshot tick 0 (để dòng đầu vẫn là snapshot như v1.0) |
| `invuln` trong snapshot | boolean (các trường thời gian khác có hậu tố `_s`) |
| Thứ tự `drifter_drop` / `pulse` | `drifter_drop` ghi trước `pulse` trong cùng tick |
| Điểm headless | Điểm của Đêm đang chạy; tổng nhiều Đêm chỉ ở bản chơi (tổng các Đêm đã thắng) |

### Acceptance criteria — Phần 3 (tính năng mới)

| Tính năng | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| Gió Lạc | Mang ≥ 5 và cách ≤ 15 m -> `chase` 7 m/s; mất điều kiện -> `idle`; chạm XZ ≤ 1.2 -> `drifter_steal` min(3, mang), `flee` 240 tick rồi biến mất; không mất lửa; pulse lúc `chase` -> `flee` không cướp; pulse lúc `flee` có đồ -> `drifter_drop`, đom đóm rơi, biến mất sau 120 tick; sinh tick 1200 (D1), tối đa 2 | `tests/nights.test.ts`, scenario p2-07, p2-08 |
| Bùa Gió | Nhặt như đom đóm -> `charm_picked` 600 tick; tốc độ 7.2 m/s; lướt không hồi chiêu (nhấn trong lúc lướt bị bỏ qua); bùa sinh lại sau 2700 tick; vị trí chuẩn | `tests/nights.test.ts`, scenario p2-09 |
| Lướt | 14 m/s × 12 tick, hồi 90 tick từ lúc bắt đầu, hướng di chuyển hoặc hướng mặt, giữ độ cao trên không, event `dash` | `tests/rules.test.ts`, scenario p2-01 |
| Rơi / hồi sinh | Y < −10 -> `player_hit {by: fall, lost}` 1 lần, chờ 60 tick, hồi sinh ở điểm xuất phát, bất tử 90 tick | test + scenario p2-04 |
| Bục nhảy, cầu, tầng, dốc, tháp | Đêm 2 bay ~1.4 s đáp đảo kia; cầu đi được, bước ra mép cầu thì rơi; Đêm 3 dốc lên Y=3, vách chặn, bục lên Y=6, tháp chặn | `tests/nights.test.ts`, scenario p2-06, p2-10 |
| Gió mạnh | Mỗi 30 s một cơn 5 s đẩy 2 m/s; snapshot `wind.active`; báo trước 2 s bằng lá bay + âm thanh | test + scenario p2-11; báo trước: chơi thử / video |
| Chuỗi 3 Đêm | Menu -> giới thiệu (tên đảo, lời Ông Đăng) -> chơi -> kết quả -> Đêm kế; thắng Đêm 3 -> Bình Minh + tổng điểm; thua -> chơi lại Đêm đó | Chơi thử, ảnh chụp / video |
| Tạm dừng | Esc/P: logic dừng hẳn (headless: `paused`/`resumed`, sim_tick đứng yên); menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | test + scenario p2-05; menu: chơi thử |
| Cài đặt | Âm lượng + độ nhạy chuột, lưu `localStorage` giữa các lần mở | Chơi thử: đổi, tải lại trang, giá trị còn |
| Âm thanh | Nhạc nền đêm + hiệu ứng: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s | Chơi thử / video (WebAudio tổng hợp, `src/game/audio.ts`) |
| HUD | Lửa trên trái; đồng hồ trên giữa, đỏ + nhấp nháy ≤ 30 s; đèn k/n + điểm trên phải; 10 ô đom đóm dưới giữa; hồi chiêu Lướt/Tỏa Sáng dưới phải; "E — Nạp ánh sáng (x/10)"; mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | Ảnh chụp |
| Bảng màu | Các thành phần được liệt kê lệch ≤ 10% mỗi kênh RGB | `tests/palette.test.ts` |
| Ánh sáng môi trường | cường độ = 0.15 + 0.55 × đèn sáng / tổng đèn | `src/game/view.ts` (HemisphereLight) |
| Hiệu năng | Headless 1 Đêm đầy đủ ≤ 30 s; bản thường ≥ 30 FPS trung bình ở 1280×720 | test (đo được ~0.2 s/đêm); FPS: bộ đếm góc dưới trái, ảnh chụp |

### Sáng tạo (giữ từ trước, theo bản đồ chuẩn)

Cỏ, hoa, cây, đá, động vật (thỏ, sóc, hươu bỏ chạy khi Mây/Bóng Mực tới gần), biển mây phản chiếu, trời sao.
Chỉ hiển thị, không nằm trong bundle headless (có test).
Cây **chặn Mây ở bản chơi** qua `Game.extraSolids` (thân cây + 0.35 m). Headless không bao giờ đặt danh sách này nên output contract không đổi (có test).
Cây được đặt cách xa đèn, bục, bùa, điểm xuất phát và mọi điểm sinh đom đóm/Bóng Mực để không chặn luật chơi. Bóng Mực là sương mực nên bay xuyên cây.

## Phase 3

Ticket-03 "Đèn cạn dầu", Test Contract **v1.2**. Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Breaking changes: [CHANGELOG.md](../../CHANGELOG.md).

### Acceptance criteria

| Mục | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| Nhiên liệu | Thắp (lần đầu/lại) -> fuel 100; hao 1/s; fuel ≤ 0 -> `lantern_out`, deposited 0, ever_lit giữ true | `tests/fuel.test.ts`, p3-01 |
| Thắp lại | Đèn ever_lit cần 5, +40, `relight: true`, relit_count++ | test, p3-01 |
| Châm dầu | used = min(mang, ceil((100−fuel)/10)), fuel += 10×used ≤ 100, +5/đom đóm, `refuel`; mang 0 -> không gì | test, p3-02 |
| Vùng an toàn | fuel < 30 mất vùng; đúng 30 còn vùng; châm lên ≥ 30 đẩy Bóng Mực ra trong ≤ 30 tick, không sát thương | test |
| Hút dầu | wander -> đèn yếu gần nhất (id nhỏ hơn khi bằng nhau), ≤ 2 m -> `drain`, 5/s cộng dồn, `fuel_drain` mỗi 60 tick; drain -> chase (Mây ≤ 6 m), stunned (pulse, +15), wander (đèn tắt / fuel ≥ 30 / > 2 m) | test, p3-03 |
| Thắng | Hết giờ, còn sống, đèn sáng ≥ ceil(0.6n) -> `dawn_survived` (+50+floor(fuel)/đèn, +50/lửa); thiếu -> `dawn`; hết lửa luôn `no_flames`; không thắng sớm | test, p3-04, p3-05 |
| Sức chứa | 10 + 2 × successful_lights ≤ 20, đặt lại mỗi Đêm, đèn đặt sẵn không tính | test |
| Hiển thị | Thanh dầu, nhấp nháy 1 Hz khi < 30; HUD mang/sức chứa; chế độ mù màu (#00B3FF, cảnh báo trắng + ⚠, đèn tắt xẹp 20% + vết rách) | Chơi thử, ảnh chụp |

### Giả định Phase 3

| Chỗ chưa rõ | Giả định |
|---|---|
| "đi về đèn tắt gần nhất như trước" | Ticket-02 không định nghĩa; nay `wander` đi tới đèn tắt gần nhất (tốc độ Bóng Mực) và lượn chờ trong 2 m; không có đèn nào thì đi lang thang như Phase 2 |
| Tốc độ khi `wander` tới đèn | Bằng tốc độ Bóng Mực (4.0 / Đêm 3: 4.5 m/s) |
| `fuel_drain.fuel` | Fuel ngay sau phần hút của con đó trong tick, làm tròn 1 chữ số |
| Đèn đặt `lit: true` bằng scenario | `ever_lit` mặc định true; không tính vào successful_lights |
| Đèn "đầy" | fuel = 100 đúng; vì hao ở bước 2 trước tương tác nên trên thực tế đèn chỉ đầy trong tick vừa thắp/châm |
| Drain bị chặn bởi vùng an toàn đèn khác | Vẫn áp dụng: đèn có fuel ≥ 30 vẫn chặn ở mép 6 m |

### Sáng tạo sau Phase 3: đồi, hồ, sông, thác trên đảo

Bản đồ chuẩn bắt buộc mặt đảo phẳng (Y = 0) và luật nhặt/chạm/rơi dùng Y đó, nên đồi **không** đưa vào logic.
`src/game/decor/landscape.ts` thêm một **độ cao hiển thị** h(x, z) chỉ dùng khi vẽ: Mây, đom đóm, Bóng Mực, động vật, cây được nâng theo h.
h = 0 trong bán kính 3–6 m quanh đèn, bục, bùa, điểm xuất phát và ở mép đảo, cầu, tầng, dốc (kiểm tra bằng script: |h| = 0.000 tại mọi điểm đó, cả 3 Đêm).
Headless không import phần này (test `headless bundle contains no rendering code`). Dãy núi xa ngoài biển (Phase 3) đã bỏ theo yêu cầu.

### Sáng tạo: chế độ "Đảo lớn (khám phá)"

Người chơi muốn đảo rộng hơn, map to gấp đôi, núi cao gấp 10, đảo không tròn. Ticket-02 chốt bản đồ chuẩn và test ẩn dựa vào đó, nên làm thành **chế độ chọn thêm** ở menu:
`exploreMap(n)` (src/sim/explore.ts) = bản đồ chuẩn x2, bờ chỉ phình ra (hệ số 1..1+amp, nên mọi đèn/điểm sinh vẫn trên đất), Đêm 2 phình ít để hai đảo không dính nhau,
núi 25–45 m là `ground()` thật (đặt cách đèn, bục, bùa, điểm xuất phát; điểm sinh đom đóm/Bóng Mực có thể nằm trên sườn núi, Y = mặt núi).
Bục nhảy `vh` x2 để quãng bay x2. Headless không import file này (test). Cột đèn (r 1 m), đá lớn, cây chặn Mây qua `extraSolids` (chỉ bản chơi).

### Điều khiển -> input contract

Camera nhìn theo hướng `(sin yaw, cos yaw)`. Với công thức xoay của contract, `W` = `z +1`, `S` = `z -1`, `A` = `x +1`, `D` = `x -1` (bên phải màn hình là `x -1`).
