# Nhật ký dùng AI

Công cụ: Claude Code (VS Code extension), model Claude Opus 5.5. Harness: `CLAUDE.md`, Stop hook `.claude/hooks/stop-if-tests-red.mjs`, skill `.claude/skills/verify-phase`, CI GitHub Actions.

## Phase 1

| Bước | Lời nhắc chính / việc AI làm | Kết quả, lỗi AI và cách phát hiện |
|---|---|---|
| Đọc đề | "đọc tất cả thông tin để dựng source từ đầu và tóm tắt" -> AI đọc 6 file đề + lab board | Lần đầu AI chỉ đọc bản tóm tắt của lab board; tôi hỏi lại, AI đọc HTML gốc để đối chiếu nguyên văn Test Contract |
| Thiết kế | AI đề xuất TypeScript: `src/sim` thuần (headless Node) + Three.js web | Tôi duyệt hướng này |
| Xây dựng | AI viết sim, CLI, view, test, scenario | Test bắt được lỗi off-by-one: Bóng Mực chỉ bị choáng 179 tick thay vì 180 (đếm ngược ngay trong tick bị pulse). Sửa: đếm ngược ở đầu tick |
| Xây dựng | | Test của AI sai: kỳ vọng sinh 2 Bóng Mực trong 75 s nhưng người chơi đứng yên chết trước. Sửa test (cho 99 lửa), không sửa game |
| Xây dựng | | Rủi ro 2 file test build cùng 1 file song song -> chuyển sang `globalSetup` |
| Xây dựng | | Bấm Space để bắt đầu làm Mây nhảy ngay -> thêm `controls.reset()` |
| Kiểm chứng | `npm test` (40 test) + `npm run proof` (7 scenario × 2 lần) | Tất cả đạt. Đồ hoạ chưa được AI kiểm tra bằng mắt (máy không có trình duyệt headless) -> tôi tự chơi thử |

Token Phase 1 (cộng từ transcript của phiên Claude Code, `~/.claude/projects/<repo>/<session>.jsonl`, trường `usage`, 35 lượt trả lời của model):

| Loại | Token |
|---|---:|
| Output (model viết) | ~85 k |
| Input mới (không cache) | ~0,1 k |
| Ghi cache (ngữ cảnh mới) | ~147 k |
| Đọc cache (ngữ cảnh lặp lại mỗi lượt) | ~4,27 M |

Dùng gói thuê bao Claude, không tính tiền theo token. Phần lớn là đọc cache: ngữ cảnh (đề bài + code) được gửi lại mỗi lượt, rẻ hơn nhiều so với input mới.
Lệnh `/cost` không có trong bản VS Code; số liệu lấy bằng script cộng `usage` trong transcript.
Cách tiết kiệm: đọc đề 1 lần rồi tóm tắt; lõi logic viết 1 lần dùng chung cho game và headless; dùng test để AI tự phát hiện lỗi thay vì chạy agent nhiều vòng.

## Đánh giá nhanh Phase 1

- Đạt: R1–R7 (logic), Test Contract v1.0, tất định.
- Chơi thật đến khi thắng (5/5 đèn, 1256 điểm): `docs/proof/phase-1/play-win-hud.png`.
- Nhận xét khi chơi: cảnh vẫn khá tối dù đã thắp đủ 5 đèn -> có thể tăng ánh sáng đèn (chỉ ảnh hưởng hiển thị, không đổi headless).
- Harness cần chỉnh: (điền khi agent sai lặp lại)

## Phase 2 (Ticket-02, contract v1.1)

| Bước | Việc AI làm | Lỗi AI và cách phát hiện |
|---|---|---|
| Trước ticket | Tôi yêu cầu thêm cây cỏ, động vật, biển, đảo to hơn | AI làm đảo 52 m trước khi có ticket. Ticket-02 chốt bản đồ chuẩn 40 m -> phải bỏ. Bài học: không đổi luật/bản đồ khi chưa có yêu cầu |
| Đọc ticket | AI không đọc được ticket từ lab board (nội dung tải lúc chạy) và từ chối đọc thẳng database vì có thể là ticket chưa phát hành -> tôi dán ticket | — |
| Thiết kế | Viết lại `src/sim/game.ts` theo đúng thứ tự 12 bước của ticket; bản đồ chuẩn tách ra `maps.ts`; số chuẩn ở `STD` | — |
| Kiểm chứng | 91 test + 17 scenario. Test bắt được 2 lỗi game thật: (1) vận tốc snapshot sai ở tick bục nhảy bắn, (2) Bóng Mực chỉ lùi 59/60 bước | Phần lớn test đỏ lần đầu là **test sai** (AI quên thứ tự nhặt-trước-nạp, quên bùa nằm trên cầu, nhầm dấu trục X, quên `snapshotEvery`). Đã ghi quy tắc vào CLAUDE.md: "test đỏ thì đọc lại dòng ticket để quyết định test hay game sai" |
| Harness | CLAUDE.md và skill `verify-phase` cập nhật cho 3 Đêm, contract v1.1, bảng màu | — |

Chưa kiểm chứng bằng mắt (AI không có trình duyệt): menu, HUD, âm thanh, FPS -> tôi chơi thử và chụp ảnh.
Token Phase 2: cộng từ transcript khi gắn tag (xem cách tính ở Phase 1).
