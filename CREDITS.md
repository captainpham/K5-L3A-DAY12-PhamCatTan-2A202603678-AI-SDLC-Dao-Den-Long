# Credits

Tác giả: Pham Cat Tan (MSSV 2A202603678, lớp K5-L3A).

- Nhân vật, bối cảnh, tên gọi (Mây, Đảo Đèn Lồng, Bóng Mực, Đèn Lồng Lớn): bản gốc của lab Day 12 AI SDLC.
- Mô hình 3D: tự dựng bằng hình khối cơ bản của Three.js trong code (`src/game/models.ts`, `src/game/decor/`): Mây, đèn, Bóng Mực, cây, hoa, đá, thỏ, sóc, hươu. Không dùng asset ngoài.
- Mặt biển mây và hồ: addon `Water` của three.js (`three/examples/jsm/objects/Water.js`, MIT); texture gợn sóng sinh bằng code. Sông, thác: shader tự viết (`src/game/decor/landscape.ts`).
- Âm thanh: tự tổng hợp bằng WebAudio trong code (`src/game/audio.ts`), không dùng file âm thanh.
- Lời thoại Ông Đăng, tên đảo, Gió Lạc, Bùa Gió: theo Ticket-02 của lab; câu thoại do tôi viết.
- Thư viện: [three.js](https://threejs.org) (MIT), Vite (MIT), Vitest (MIT), esbuild (MIT), TypeScript (Apache-2.0).
- Công cụ đo (tuỳ chọn): [Puppeteer](https://pptr.dev) (Apache-2.0) điều khiển Chrome cho lệnh bench; Chrome/Chromium theo giấy phép của Google.
- Công cụ AI tạo code: Claude Code (Anthropic), xem `docs/notes/ai-log.md`.
