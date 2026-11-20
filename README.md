# Đảo Đèn Lồng

> **Video demo:** _(sẽ cập nhật ở Phase 4: Release `v1.0.0` / `docs/demo/demo.mp4`)_

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại Đèn Lồng Lớn trên **ba hòn đảo**
(Đảo Bến, Đảo Cau, Đảo Chuông), né Bóng Mực và Gió Lạc trong sương đen.
TypeScript + Three.js (bản web), logic game chạy headless bằng Node theo **Test Contract v1.2**.

Đề bài: [docs/lab/](docs/lab/README.md) · Spec, giả định, acceptance criteria: [docs/notes/assumptions.md](docs/notes/assumptions.md) ·
Bằng chứng: [phase-1](docs/proof/phase-1/README.md), [phase-2](docs/proof/phase-2/README.md), [phase-3](docs/proof/phase-3/README.md) · Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)

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

## Luật và cách tính điểm (Ticket-02 + Ticket-03)

- Ba Đêm liên tiếp: 240 / 270 / 300 giây, có 5 / 6 / 7 đèn. Mây có **3 Ngọn Lửa** (hồi đầy mỗi Đêm), tự nhặt đom đóm khi đi qua.
  Sức chứa bắt đầu 10, **+2 sau mỗi lần thắp thành công**, tối đa 20.
- Đèn cần **10 đom đóm** để thắp lần đầu, **5** để thắp lại. Đèn sáng có **100 dầu**, cháy 1 dầu/giây. Bấm `E` ở đèn đang sáng để **châm dầu** (mỗi đom đóm +10).
- Đèn sáng có vùng an toàn 6 m. **Dầu dưới 30 thì mất vùng an toàn** và Bóng Mực sẽ tới **hút dầu** (5 dầu/giây). Hết dầu thì đèn tắt.
- **Thắng lúc bình minh**: còn sống và còn ít nhất 3/5, 4/6, 5/7 đèn đang sáng. Thắp đủ đèn sớm không kết thúc Đêm.
- Bị Bóng Mực chạm: mất 1 lửa, rơi một nửa đom đóm đang mang (nhặt lại được trong 8 giây). Rơi khỏi đảo: mất 1 lửa và toàn bộ đom đóm.
- Gió Lạc (Đêm 2, 3) cướp 3 đom đóm khi bạn mang từ 5 con. Bùa Gió: chạy 7,2 m/s và lướt không hồi chiêu trong 10 giây.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Bóng Mực trúng Tỏa Sáng (đang hút dầu) | +5 (+15) |
| Bình minh (khi thắng): mỗi đèn đang sáng / mỗi lửa còn lại | +50 + floor(dầu) / +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng. Số liệu: [game.contract.json](game.contract.json) (v1.2) và `STD` trong
[src/sim/tuning.ts](src/sim/tuning.ts). Quyết định thiết kế: [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md) · thay đổi phá vỡ: [CHANGELOG.md](CHANGELOG.md).

## Test và chế độ headless

```bash
npm test                  # 127 test: luật chuẩn, dầu đèn, 3 Đêm, CLI, bảng màu, 21 scenario headless
npm run proof -- phase-3  # chạy các scenario 2 lần, lưu output thật vào docs/proof/phase-3/
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
- **Chế độ "Đảo lớn (khám phá)"** (chọn ở menu; mặc định vẫn là Đảo chuẩn theo ticket): bản đồ **to gấp đôi**, đảo có **bờ lồi lõm** nhiều hình dạng (không còn tròn), **núi thật cao 25–45 m** mà Mây leo lên được (đá, cây, hoa trên sườn, tuyết trên đỉnh). Đèn, bục, bùa, điểm xuất phát giữ nguyên vị trí tương đối; bục nhảy đẩy mạnh gấp đôi để vẫn bay tới đảo kia. Headless và test ẩn luôn dùng bản đồ chuẩn (`src/sim/explore.ts`, có test riêng `tests/explore.test.ts`).
- **Không đi xuyên** cây, đá lớn và cột Đèn Lồng (chỉ ở bản chơi; vẫn nạp đèn được vì bán kính tương tác 2 m).
- **Đồi cát trên đảo:** 4–5 đồi cát gợn sóng cao tới ~4,5 m, có đá, cây và hoa mọc trên đó. Mây đi lên đồi được: đồi là **độ cao hiển thị** (logic vẫn ở Y = 0 theo bản đồ chuẩn, nên Test Contract không đổi), và mặt đất luôn phẳng quanh đèn, bục, bùa, điểm xuất phát, cầu, tầng, dốc và mép đảo.
- **Hồ, sông, thác:** hồ dùng addon `Water` của three.js (phản chiếu thật trời, trăng, cây, đèn), Mây lội qua được. Sông chảy từ đồi vào hồ rồi từ hồ ra mép đảo thành **thác** cong đổ xuống biển mây, có bọt và hơi nước. Sông và thác dùng shader dòng chảy (2 lớp normal map trượt, phản chiếu Fresnel, ánh trăng).
- **Âm thanh tổng hợp bằng WebAudio**, không dùng file âm thanh.
