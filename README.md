# Đảo Đèn Lồng

> **Video demo:** _(sẽ cập nhật ở Phase 4: Release `v1.0.0` / `docs/demo/demo.mp4`)_

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại 5 Đèn Lồng Lớn trên Đảo Bến và né Bóng Mực trong sương đen.
TypeScript + Three.js (bản web), logic game chạy headless bằng Node theo **Test Contract v1.0**.

Đề bài của lab: [docs/lab/](docs/lab/README.md) · Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md) · Bằng chứng: [docs/proof/](docs/proof/phase-1/README.md) · Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 18)

```bash
npm ci            # 1. cài thư viện
npm run build     # 2. build headless (dist/headless.cjs) + web (dist/web)
npm start         # 3. mở http://localhost:4173
```

Chơi khi đang phát triển (tự tải lại khi sửa code): `npm run dev`.

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / mũi tên lên xuống | Di chuyển (theo hướng camera) |
| Kéo chuột / `←` `→` | Xoay camera |
| `Space` | Nhảy |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất |
| `F` | Tỏa sáng: làm choáng và đẩy lùi Bóng Mực ở gần (tốn 1 đom đóm, hồi 2 giây) |
| `R` | Chơi lại |

## Luật và cách tính điểm

- Đêm 1 dài **300 giây**. Mây có **3 lửa** và mang tối đa **10 đom đóm**. Đi qua đom đóm là tự nhặt.
- Mỗi đèn cần **5 đom đóm**. Thắp đủ 5 đèn thì **thắng**. Hết lửa hoặc trời sáng (hết giờ) thì **thua**.
- Bóng Mực chạm vào: mất 1 lửa, rơi một nửa số đom đóm đang mang, được bất tử 1,5 giây.
  Bóng Mực không vào được vùng 6 m quanh **đèn đã thắp**.

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi tỏa sáng | +20 |
| Khi thắng: mỗi giây còn lại | +2 |
| Khi thắng: mỗi lửa còn lại | +50 |

Mọi con số nằm trong [game.contract.json](game.contract.json). Game đọc trực tiếp file này nên số khai báo luôn khớp với số game dùng.
`fall_enabled: false`: mép đảo là tường, không có rơi khỏi đảo nên không có event `player_hit` với `by: "fall"`.

## Test và chế độ headless

```bash
npm test            # 40 test: luật game, CLI (mã thoát, tất định), 7 scenario headless
npm run proof       # chạy các scenario, lưu output thật vào docs/proof/phase-1/
node dist/headless.cjs --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario tests/scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```

Headless chạy 60 tick/giây cố định, không cần cửa sổ hay GPU. Kết quả ghi ra JSONL gồm các dòng `snapshot`, `event` và `end`.
Cùng seed, scenario và inputs thì output giống hệt nhau. File inputs hoặc scenario sai định dạng thì thoát với mã 2.

## Cấu trúc

```text
src/sim/        logic thuần, tất định (dùng chung cho game và headless)
src/headless/   CLI theo Test Contract
src/game/       Three.js: models.ts (nhân vật), view.ts (cảnh), controls.ts, main.ts
tests/          unit test + tests/scenarios/*.json
docs/           lab/ (đề), notes/ (giả định, nhật ký AI), proof/ (bằng chứng)
CLAUDE.md, .claude/   harness AI: hướng dẫn agent, Stop hook, skill verify-phase
```

## Sáng tạo của tôi

_Chưa có. Phase 1 làm phần lõi trước._ Khi thêm, ghi mỗi ý một dòng kèm bằng chứng rằng `npm test` vẫn đạt (output headless không đổi).
