// Standard maps of Ticket-02 (Part 2). Angles are measured from +X toward +Z on the XZ plane:
// point(r, deg) = (r cos θ, z = r sin θ)  (this makes Night 3 ramps at 30°/150° land on the z > 0 tier, as the ticket requires).
export type Vec3 = [number, number, number];

export interface Pad { x: number; y: number; z: number; r: number; vy: number; vh: number; dirX: number; dirZ: number }

export interface NightMap {
  night: 1 | 2 | 3;
  name: string;
  start: Vec3;
  lanterns: { id: string; pos: Vec3 }[];
  moteSpawns: Vec3[];
  shadeSpawns: Vec3[]; // ground points (shade center is 1 m above)
  shadeEveryTicks: number;
  shadeMax: number;
  shadeSpeed: number;
  pads: Pad[];
  charms: { id: string; pos: Vec3 }[];
  drifters: boolean;
  wind: boolean;
  /** ground height at (x, z), or null where there is no ground (sea of clouds -> fall). */
  ground(x: number, z: number): number | null;
  /** solid obstacles that are not ground (Night 3 bell tower). */
  solid(x: number, z: number, y: number): boolean;
  /** world bounds for rendering */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, deg: number, y = 0, cx = 0, cz = 0): Vec3 => {
  const x = cx + r * Math.cos(rad(deg)), z = cz + r * Math.sin(rad(deg));
  return [Math.round(x * 1e6) / 1e6, y, Math.round(z * 1e6) / 1e6];
};
const ring = (n: number, r: number, startDeg: number, stepDeg: number, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => pt(r, startDeg + i * stepDeg, y, cx, cz));
const lan = (list: Vec3[]) => list.map((pos, i) => ({ id: `L${i + 1}`, pos }));
const towardXZ = (fx: number, fz: number, tx: number, tz: number) => {
  const d = Math.hypot(tx - fx, tz - fz);
  return { dirX: (tx - fx) / d, dirZ: (tz - fz) / d };
};

// ---------------------------------------------------------------- Night 1 — Đảo Bến
const NIGHT1: NightMap = {
  night: 1,
  name: "Đảo Bến",
  start: [0, 0, 0],
  lanterns: lan([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
  moteSpawns: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
  shadeSpawns: ring(12, 37, 15, 30),
  shadeEveryTicks: 480,
  shadeMax: 6,
  shadeSpeed: 4.0,
  pads: [],
  charms: [],
  drifters: false,
  wind: false,
  ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  solid: () => false,
  bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 },
};

// ---------------------------------------------------------------- Night 2 — Đảo Cau
const NIGHT2: NightMap = {
  night: 2,
  name: "Đảo Cau",
  start: [0, 0, 0],
  lanterns: lan([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
  moteSpawns: [
    ...ring(4, 10, 0, 90), ...ring(8, 22, 0, 45),
    ...ring(4, 10, 0, 90, 0, 70), ...ring(8, 22, 0, 45, 0, 70),
  ],
  shadeSpawns: [...ring(8, 26, 22.5, 45), ...ring(8, 26, 22.5, 45, 0, 70)],
  shadeEveryTicks: 420,
  shadeMax: 8,
  shadeSpeed: 4.0,
  pads: [
    { x: 20, y: 0, z: 18, r: 1, vy: 14, vh: 24, ...towardXZ(20, 18, 70, 0) },
    { x: 50, y: 0, z: -18, r: 1, vy: 14, vh: 24, ...towardXZ(50, -18, 0, 0) },
  ],
  charms: [{ id: "C1", pos: [35, 0, 0] }],
  drifters: true,
  wind: false,
  ground: (x, z) => {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0; // bamboo bridge, no railing
    return null;
  },
  solid: () => false,
  bounds: { minX: -28, maxX: 98, minZ: -28, maxZ: 28 },
};

// ---------------------------------------------------------------- Night 3 — Đảo Chuông
const RAMP_DEGS = [30, 150];
function night3Ground(x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  if (r <= 8) return 6; // tier 2 disk
  let h = 0;
  if (z > 0 && r >= 12 && r <= 24) h = 3; // tier 1 half ring
  for (const d of RAMP_DEGS) {
    const c = Math.cos(rad(d)), s = Math.sin(rad(d));
    const along = x * c + z * s, across = -x * s + z * c;
    if (Math.abs(across) <= 1.5 && along >= 24 && along <= 30) h = Math.max(h, (3 * (30 - along)) / 6);
  }
  return h;
}

const NIGHT3: NightMap = {
  night: 3,
  name: "Đảo Chuông",
  start: [0, 0, -30], // ticket gives no start for Night 3; the centre is the bell tower (see docs/notes/assumptions.md)
  lanterns: lan([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
  moteSpawns: [...ring(18, 34, 0, 20, 0), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)],
  shadeSpawns: ring(16, 43, 0, 22.5),
  shadeEveryTicks: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  pads: [{ x: 0, y: 3, z: 13, r: 1, vy: 12, vh: 8, dirX: 0, dirZ: -1 }],
  charms: [{ id: "C1", pos: [30, 0, 25] }, { id: "C2", pos: [-30, 0, 25] }],
  drifters: true,
  wind: true,
  ground: night3Ground,
  solid: (x, z, y) => Math.hypot(x, z) < 2 && y < 14, // bell tower r = 2 m, 8 m tall on tier 2
  bounds: { minX: -45, maxX: 45, minZ: -45, maxZ: 45 },
};

export const MAPS: Record<1 | 2 | 3, NightMap> = { 1: NIGHT1, 2: NIGHT2, 3: NIGHT3 };
export const RAMPS_DEG = RAMP_DEGS;
