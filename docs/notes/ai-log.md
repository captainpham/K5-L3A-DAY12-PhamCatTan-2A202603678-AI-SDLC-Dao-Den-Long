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

Token/chi phí ước tính Phase 1: _điền số từ `/cost` của Claude Code_ (ước tính ~ ? k token).
Cách tiết kiệm: đọc đề 1 lần rồi tóm tắt; lõi logic viết 1 lần dùng chung cho game và headless; dùng test để AI tự phát hiện lỗi thay vì chạy agent nhiều vòng.

## Đánh giá nhanh Phase 1

- Đạt: R1–R7 (logic), Test Contract v1.0, tất định.
- Chưa có bằng chứng: HUD/camera bằng ảnh chụp (cần chụp khi chơi).
- Harness cần chỉnh: (điền khi agent sai lặp lại)
