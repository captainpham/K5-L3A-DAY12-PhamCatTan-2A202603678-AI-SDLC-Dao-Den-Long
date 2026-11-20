# Đảo Đèn Lồng

> **Video demo:** _(sẽ cập nhật ở Phase 4: Release `v1.0.0` / `docs/demo/demo.mp4`)_

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại Đèn Lồng Lớn trên **ba hòn đảo**
(Đảo Bến, Đảo Cau, Đảo Chuông), né Bóng Mực và Gió Lạc trong sương đen.
TypeScript + Three.js (bản web), logic game chạy headless bằng Node theo **Test Contract v1.1**.

Đề bài: [docs/lab/](docs/lab/README.md) · Spec, giả định, acceptance criteria: [docs/notes/assumptions.md](docs/notes/assumptions.md) ·
Bằng chứng: [phase-1](docs/proof/phase-1/README.md), [phase-2](docs/proof/phase-2/README.md) · Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 18)

```bash
npm ci            # 1. cài thư viện
npm run build     # 2. build headless (dist/headless.cjs) + web (dist/web)
npm start         # 3. mở http://localhost:4173   (máy yếu: http://localhost:4173/?quality=low)
```

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / mũi tên lên xuống | Di chuyển (theo hướng camera) |
| Kéo chuột / `←` `→` | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy |
| `Shift` | Lướt |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất |
| `F` | Tỏa Sáng: làm choáng và đẩy lùi Bóng Mực, xua Gió Lạc (tốn 3 đom đóm) |
| `Esc` / `P` | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |
| `Enter` | Bấm nút đầu tiên trên màn hình menu |

## Luật và cách tính điểm (số chuẩn Ticket-02)

- Ba Đêm liên tiếp: 300 / 330 / 360 giây, có 5 / 6 / 7 đèn. Mây có **3 Ngọn Lửa** (hồi đầy mỗi Đêm), mang tối đa **10 đom đóm**, tự nhặt khi đi qua.
- Mỗi đèn cần **10 đom đóm**, nạp được nhiều lần. Đèn đã sáng tạo vùng an toàn 6 m, Bóng Mực không vào được.
- Bị Bóng Mực chạm: mất 1 lửa, rơi một nửa số đom đóm đang mang (nhặt lại được trong 8 giây), bất tử 1,5 giây.
  Rơi khỏi đảo: mất 1 lửa và toàn bộ đom đóm, hồi sinh ở điểm xuất phát.
- Gió Lạc (Đêm 2, 3) cướp 3 đom đóm khi bạn mang từ 5 con trở lên. Bùa Gió: chạy 7,2 m/s và lướt không hồi chiêu trong 10 giây.
- Thắp hết đèn thì thắng. Hết lửa hoặc trời sáng thì thua (được chơi lại Đêm đó).

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi con, mỗi lần) | +5 |
| Khi thắng Đêm: mỗi giây còn lại / mỗi lửa còn lại | +2 / +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng. Mọi con số nằm trong [game.contract.json](game.contract.json) và `STD` trong
[src/sim/tuning.ts](src/sim/tuning.ts); bản đồ chuẩn trong [src/sim/maps.ts](src/sim/maps.ts).

## Test và chế độ headless

```bash
npm test                  # 92 test: luật chuẩn, 3 Đêm, CLI, bảng màu, 17 scenario headless
npm run proof -- phase-2  # chạy các scenario 2 lần, lưu output thật vào docs/proof/phase-2/
node dist/headless.cjs --seed 1 --night 2 --ticks 600 --out out.jsonl \
  [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```

Headless chạy 60 tick/giây cố định, không cần cửa sổ hay GPU. Một Đêm đầy đủ chạy mất khoảng 0,2 giây.
Cùng seed, scenario và inputs thì output giống hệt nhau. File inputs hoặc scenario sai định dạng thì thoát với mã 2.

## Cấu trúc

```text
src/sim/        logic thuần, tất định: game.ts (thứ tự 12 bước/tick), maps.ts (3 bản đồ chuẩn), tuning.ts, contract-io.ts
src/headless/   CLI theo Test Contract v1.1
src/game/       Three.js: main.ts (menu, 3 Đêm, HUD), view.ts, models.ts (bảng màu chuẩn), audio.ts, controls.ts, decor/
tests/          rules, nights, cli, palette, scenarios (tests/scenarios/*.json)
docs/           lab/ (đề), notes/ (spec, giả định, nhật ký AI), proof/ (bằng chứng từng phase)
CLAUDE.md, .claude/   harness AI: hướng dẫn agent, Stop hook (chặn khi test đỏ), skill verify-phase
```

## Sáng tạo của tôi

Tất cả chỉ là phần hiển thị (`src/game/decor/`), không nằm trong bản headless. Test `headless bundle contains no rendering code`
kiểm tra điều đó, và toàn bộ test vẫn đạt.

- **Hệ sinh thái trên đảo:** cỏ đung đưa theo gió (InstancedMesh + vertex shader), hoa phát sáng nhẹ, cây thông và cây tán tròn, đá.
  Mọi thứ đặt theo bản đồ chuẩn (không mọc trên cầu, dốc, mép tầng). **Cây chặn đường Mây** ở bản chơi
  (tắt trong headless nên không đổi Test Contract), và không mọc gần đèn, bục, bùa hay điểm sinh đom đóm.
- **Động vật:** thỏ nhảy, sóc quanh gốc cây, hươu gặm cỏ. Chúng đi lang thang và **bỏ chạy khi Mây hoặc Bóng Mực tới gần**.
- **Biển mây phản chiếu** (addon `Water` của three.js, màu chuẩn #12384A), trời sao và trăng.
- **Âm thanh tổng hợp bằng WebAudio**, không dùng file âm thanh.
