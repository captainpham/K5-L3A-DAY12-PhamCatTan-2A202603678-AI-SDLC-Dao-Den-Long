# Retro: Đảo Đèn Lồng, 4 phase với Claude Code

Công cụ: Claude Code (VS Code), Opus 5.5 cho phần lớn dự án, Sonnet 5.5 ở cuối Phase 4. Số liệu bên dưới cộng từ transcript của phiên (trường `usage`).

## Evaluation từng phase

| Phase | Đạt | Hỏng phase trước? | Điều đã chỉnh |
|---|---|---|---|
| 1 PRD-0 | R1–R7, Test Contract v1.0, tất định, 40 test, 7 scenario | — | Tách `src/sim` thuần khỏi Three.js ngay từ đầu; viết bằng chứng bằng script `npm run proof`, không sửa tay |
| 2 Ticket-02 | Số liệu chuẩn, 3 Đêm, lướt, rơi, Gió Lạc, Bùa Gió, tạm dừng, HUD, âm thanh, bảng màu; 92 test | Số tự chọn của Phase 1 bị thay hết; đảo 52 m (làm trước khi có ticket) phải bỏ | Thứ tự 12 bước/tick viết thành comment đầu `game.ts`; `STD` giữ mọi số chuẩn |
| 3 Ticket-03 | Dầu đèn, thắp lại, hút dầu, thắng lúc bình minh, sức chứa; 114 test | 9 test cũ sai đúng chỗ luật bị [THAY THẾ]; sửa kèm lý do, xoá 1 scenario có lý do | ADR 0001, CHANGELOG, dầu tính bằng số nguyên 1/60 |
| 4 Ticket-04 | Bench, soak, bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động, chữ lớn, đóng gói; 141 test | Test `contract v1.2` thành v1.3; không hỏng luật nào | Bench tắt phần sáng tạo; soak đo bộ nhớ sau khởi động |

Số đo máy dev (tham khảo; máy chấm sẽ đo lại): bench 305 FPS trung bình, p1 low 150, p95 4,6 ms, load 1,2 s; soak 10 Đêm 0 sập, bộ nhớ 41 → 44 MB; headless một Đêm đầy đủ khoảng 0,2 giây.

## Điều gì hiệu quả

- **Viết kiểm chứng từ dòng ticket trước khi tin code.** Test bắt được lỗi game thật: Bóng Mực choáng 179 thay vì 180 tick, recoil lùi 59/60 bước, vận tốc snapshot sai ở tick bục nhảy bắn. Không lỗi nào thấy được bằng cách chơi.
- **Logic thuần + headless + `npm run proof`.** Cùng một class `Game` cho game, headless, bench và soak; bằng chứng sinh bằng máy, mỗi scenario chạy hai lần để kiểm tính tất định.
- **Một nguồn số liệu duy nhất** (`game.contract.json` và `STD`): khi ticket đổi số (Phase 2, 3), chỉ sửa một chỗ rồi test chỉ ra mọi nơi sai.
- **Stop hook chặn khi test đỏ** và skill `verify-phase` ép đúng quy trình; **subagent reviewer** (`.claude/agents/reviewer.md`) để người đánh giá khác người viết.
- **Tách sáng tạo khỏi luật:** mọi phần thêm (đồi, hồ, núi, động vật, "Đảo lớn") nằm ngoài `src/sim` hoặc là chế độ chọn thêm, có test chứng minh headless không đổi.

## Điều không hiệu quả

- **Đoán trước khi có ticket.** Tôi (và AI) làm đảo 52 m trước Ticket-02, rồi phải bỏ vì bản đồ chuẩn là 40 m.
- **Không có trình duyệt để AI tự nhìn** đến tận Phase 4: nhiều vòng "AI nói xong, người chơi mới thấy sai" (cỏ ra màu nâu, cây đi xuyên được, lớp phủ menu che cảnh bench). Khi thêm Puppeteer thì AI tự chụp màn hình và bắt lỗi ngay trong một vòng.
- **Đo sớm quá:** số đo bộ nhớ đầu của soak lấy trên tiến trình nguội, tỉ lệ nhảy 1,15–1,41 (vượt ngưỡng 1,2) dù không có rò rỉ; phải chạy 10/20/40 Đêm để chứng minh rồi đo lại sau khởi động.
- **Yêu cầu sáng tạo to đột xuất** ("núi cao gấp 10, map to gấp đôi") đụng bản đồ chuẩn; phải hỏi lại và làm thành chế độ chọn thêm.

## Những lần AI sai và cách phát hiện

| Sai | Phát hiện bằng | Sửa ở đâu |
|---|---|---|
| Bịa việc chưa có ticket (đảo 52 m) | Đọc ticket sau đó | Quy tắc "không đổi luật khi chưa có yêu cầu" trong ai-log |
| Test sai (quên thứ tự nhặt-trước-nạp, nhầm dấu trục X, đọc dòng event thay vì snapshot) | Test đỏ rồi đọc lại dòng ticket | CLAUDE.md: "test đỏ thì quyết định test hay game sai trước" |
| Thêm `Co-Authored-By: Claude` vào commit dù không muốn | Tôi nhắc | CLAUDE.md + memory; không viết lại lịch sử sau tag |
| Số liệu bench sai chuẩn (lớp phủ menu che cảnh) | Ảnh chụp `bench-scene.png` do chính lệnh bench sinh ra | Ẩn lớp phủ trong trang bench |
| Chỉ lệnh `/cost` không tồn tại, và giải thích token gây hiểu lầm | Tôi hỏi lại | Cộng `usage` từ transcript và giải thích cache |

## Token và chi phí

Cộng từ 203 lượt trả lời của model: **~505 nghìn token đầu ra**, **~1,82 triệu token ngữ cảnh ghi mới**, **~81,8 triệu token đọc cache** (ngữ cảnh gửi lại mỗi lượt, rẻ hơn nhiều, không phải token mới).
Tổng token "thật sự mới" khoảng **2,3 triệu**, cao hơn nhiều so với ví dụ ~185 nghìn trên slide vì dự án gồm cả 3D, địa hình, âm thanh, bench, đóng gói. Dùng gói thuê bao Claude nên không có hoá đơn theo token.

Cách đã tiết kiệm: logic viết một lần dùng cho cả game và headless; test thay cho việc chạy lại agent để thử; tài liệu đề đọc một lần rồi ghi vào `assumptions.md` và `CLAUDE.md` thay vì dán lại; sinh scenario bằng script nhỏ.
Cách đáng lẽ nên làm: không in cả khối CSS khi đọc lab board (thêm khoảng 15–20 nghìn token bị gửi lại ở mọi lượt sau); mở phiên mới ở mỗi phase thay vì một phiên rất dài (phiên dài khiến 81 triệu token cache bị đọc lại).

## Nếu làm lại

1. Cài Puppeteer và chụp màn hình tự động **từ Phase 1**, để AI tự thấy hình ảnh và HUD.
2. **Một phiên Claude Code mỗi phase**, `CLAUDE.md` làm trí nhớ; commit mỗi bước nhỏ thay vì dồn.
3. Đọc ticket xong mới sáng tạo; làm phần sáng tạo như **chế độ chọn thêm** ngay từ đầu.
4. Viết bench và soak sớm (cuối Phase 2), vì hiệu năng ảnh hưởng thiết kế (InstancedMesh cho 200 Bóng Mực).
5. Gắn tag đúng giờ từng phase thay vì để Phase 2 tag chậm sau khi code xong.
