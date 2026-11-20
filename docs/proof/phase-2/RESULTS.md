# Kết quả scenario headless (phase-2)

> File này do `npm run proof` sinh ra, không sửa tay. Mỗi scenario chạy **2 lần** bằng CLI đã build và so sánh byte-by-byte (tính tất định).

- Commit: `56a07d5`
- Node: v22.22.3 · win32/x64
- Thời điểm: 2026-11-20T09:42:27.369Z

| Scenario | Yêu cầu kiểm chứng | Kết quả cuối | Đánh giá |
|---|---|---|---|
| p1-01-collect-deposit | P1 regression (standard numbers): walk, pick 10 motes, deposit -> L1 lit, +10 per deposited mote, +100 | playing @ tick 300, score 200 | ĐẠT |
| p1-02-win-all-lit | P1 regression: lighting the last lantern wins (all_lit) with time + flame bonus | won @ tick 1, score 548 (all_lit) | ĐẠT |
| p1-03-shade-hits-lost | P1 regression: shade chases at 4 m/s, hits cost flames (90 invuln ticks), no_flames loses | lost @ tick 286, score 0 (no_flames) | ĐẠT |
| p1-04-dawn | P1 regression: dawn when the night timer reaches 0 | lost @ tick 300, score 0 (dawn) | ĐẠT |
| p2-01-dash | Dash: 14 m/s x 0.2 s, cooldown 1.5 s from start (press at tick 60 ignored, tick 90 works) | playing @ tick 120, score 0 | ĐẠT |
| p2-02-pulse-stun-push | Pulse: cost 3, 3D radius 5, stun 120 ticks, push 4 m in 15 ticks, +5 per shade | playing @ tick 200, score 5 | ĐẠT |
| p2-03-safe-zone-expel | Safe zone: lighting a lantern pushes a shade inside out to 6 m within 30 ticks, no damage | playing @ tick 60, score 200 | ĐẠT |
| p2-04-fall-respawn | Fall off the island (Y < -10): -1 flame, all motes lost, respawn at start after 60 ticks | playing @ tick 240, score 0 | ĐẠT |
| p2-05-pause | Pause: tick advances, sim_tick/time/motion frozen, snapshot state paused; resume continues | playing @ tick 60, score 0 | ĐẠT |
| p2-06-night2-jump-pad | Night 2 jump pad (20,0,18): 14 m/s up + 24 m/s toward island B, lands on B after ~1.4 s | playing @ tick 120, score 0 | ĐẠT |
| p2-07-night2-drifter-steal | Gió Lạc: chase when carrying >= 5 within 15 m, steal min(3, carried), flee 240 ticks then vanish | playing @ tick 400, score 0 | ĐẠT |
| p2-08-night2-drifter-drop | Gió Lạc: pulse on a fleeing drifter with loot drops it (drifter_drop) as dropped motes | playing @ tick 150, score 0 | ĐẠT |
| p2-09-night2-charm | Bùa Gió: charm_picked (600 ticks), speed 7.2 m/s, dash without cooldown | playing @ tick 60, score 0 | ĐẠT |
| p2-10-night3-jump-pad | Night 3: jump pad (0,3,13) lands Mây on tier 2 (Y=6) | playing @ tick 120, score 0 | ĐẠT |
| p2-11-night3-wind | Night 3 wind: gust at 30 s lasting 5 s pushes Mây at 2 m/s | playing @ tick 2160, score 0 | ĐẠT |
| p2-12-night1-full-random | Default Night 1 (random motes/shades), idle player, seed 42: deterministic full night | lost @ tick 11675, score 0 (no_flames) | ĐẠT |
| p2-13-night3-full-random | Default Night 3 (7 lanterns, wind, drifters) full run <= 21600 ticks, deterministic | lost @ tick 3831, score 0 (no_flames) | ĐẠT |

Đầu vào: `tests/scenarios/<tên>.json` · Đầu ra thật: `docs/proof/phase-2/<tên>.jsonl`
