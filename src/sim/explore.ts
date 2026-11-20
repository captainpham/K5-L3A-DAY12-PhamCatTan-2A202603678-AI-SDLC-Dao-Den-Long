// "Đảo lớn" explore maps (creative, windowed game only): every standard map scaled x2, irregular coastlines that only
// bulge OUTWARD (so every lantern / spawn point stays on land), and real mountains 25-45 m high (walkable ground).
// The headless runner and the Test Contract never use these maps (contract-io only knows MAPS).
import { MAPS, type NightMap, type Vec3 } from "./maps";
import { makeRng } from "./rng";

export const EXPLORE_SCALE = 2;

interface Isle { cx: number; cz: number; R: number; amp: number; ph: number[] }
interface Mountain { x: number; z: number; r: number; h: number; seed: number }

const ISLES: Record<1 | 2 | 3, [number, number, number, number][]> = {
  // centre x, centre z, radius, max outward bulge (fraction of R)
  1: [[0, 0, 40, 0.45]],
  2: [[0, 0, 28, 0.2], [70, 0, 28, 0.2]], // small bulge so the two islands never merge (bridge/pads still matter)
  3: [[0, 0, 45, 0.4]],
};

export function exploreMap(night: 1 | 2 | 3): NightMap {
  const base = MAPS[night], S = EXPLORE_SCALE;
  const rng = makeRng(900 + night);
  const isles: Isle[] = ISLES[night].map(([cx, cz, R, amp]) => ({ cx: cx * S, cz: cz * S, R: R * S, amp, ph: [rng() * 6, rng() * 6, rng() * 6] }));
  /** coastline radius factor in [1, 1 + amp]: capes and bays, never smaller than the standard island */
  const coast = (is: Isle, a: number) =>
    1 + is.amp * (0.55 * (0.5 + 0.5 * Math.sin(3 * a + is.ph[0])) + 0.3 * (0.5 + 0.5 * Math.sin(5 * a + is.ph[1])) + 0.15 * (0.5 + 0.5 * Math.sin(9 * a + is.ph[2])));
  const sc = (p: Vec3): Vec3 => [p[0] * S, p[1], p[2] * S];

  const flat = (x: number, z: number): number | null => {
    const g = base.ground(x / S, z / S);
    if (g !== null) return g; // standard structures (tiers, ramps, bridge) scaled x2
    for (const is of isles) {
      const dx = x - is.cx, dz = z - is.cz;
      if (Math.hypot(dx, dz) <= is.R * coast(is, Math.atan2(dz, dx))) return 0;
    }
    return null;
  };

  // gameplay spots that must stay flat (firefly / shade spawn points may sit on mountain slopes: their Y follows the ground)
  const keep: [number, number, number][] = [
    ...base.lanterns.map((l) => [l.pos[0] * S, l.pos[2] * S, 8] as [number, number, number]),
    ...base.pads.map((p) => [p.x * S, p.z * S, 14] as [number, number, number]),
    ...base.charms.map((c) => [c.pos[0] * S, c.pos[2] * S, 8] as [number, number, number]),
    [base.start[0] * S, base.start[2] * S, 14],
  ];
  // night 2: keep the bridge corridor and the pad flight lines clear
  const corridor = (x: number, z: number) => night === 2 && x > 40 && x < 100 && Math.abs(z) < 50;
  const isStructure = (x: number, z: number) => { const g = base.ground(x / S, z / S); return g !== null && g > 0; };

  // mountains: real ground, on level-0 land, far from every gameplay spot
  const mountains: Mountain[] = [];
  const want = night === 2 ? 2 : 3;
  for (let tries = 0; mountains.length < want && tries < 3000; tries++) {
    const is = isles[Math.floor(rng() * isles.length)];
    const a = rng() * Math.PI * 2, d = is.R * (0.3 + rng() * 0.9);
    const x = is.cx + Math.cos(a) * d, z = is.cz + Math.sin(a) * d;
    const r = 18 + rng() * 10, h = 25 + rng() * 20;
    if (flat(x, z) !== 0 || corridor(x, z)) continue;
    // whole footprint on level-0 land, no structure, clear of gameplay spots and other mountains
    let ok = true;
    for (let k = 0; k < 16 && ok; k++) {
      const aa = (k / 16) * Math.PI * 2;
      for (const f of [0.5, 1]) {
        const px = x + Math.cos(aa) * r * f, pz = z + Math.sin(aa) * r * f;
        if (flat(px, pz) !== 0 || isStructure(px, pz) || corridor(px, pz)) ok = false;
      }
    }
    if (!ok || keep.some(([kx, kz, kr]) => Math.hypot(kx - x, kz - z) < r + kr) || mountains.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + r)) continue;
    mountains.push({ x, z, r, h, seed: rng() * 10 });
  }
  const mountainH = (x: number, z: number) => {
    let h = 0;
    for (const m of mountains) {
      const d = Math.hypot(x - m.x, z - m.z) / m.r;
      if (d >= 1) continue;
      const a = Math.atan2(z - m.z, x - m.x);
      // smooth peak with ridges
      const shape = (1 - d) ** 1.6 * (1 + 0.12 * Math.sin(5 * a + m.seed) * d);
      h = Math.max(h, m.h * shape);
    }
    return h;
  };

  const ground = (x: number, z: number): number | null => {
    const g = flat(x, z);
    if (g === null || g > 0) return g;
    return mountainH(x, z);
  };

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const is of isles) {
    const e = is.R * (1 + is.amp) + 2;
    minX = Math.min(minX, is.cx - e); maxX = Math.max(maxX, is.cx + e); minZ = Math.min(minZ, is.cz - e); maxZ = Math.max(maxZ, is.cz + e);
  }

  return {
    ...base,
    name: `${base.name} (đảo lớn)`,
    start: sc(base.start),
    lanterns: base.lanterns.map((l) => ({ id: l.id, pos: sc(l.pos) })),
    moteSpawns: base.moteSpawns.map(sc).map(([x, y, z]) => [x, ground(x, z) ?? y, z] as Vec3),
    shadeSpawns: base.shadeSpawns.map(sc).map(([x, y, z]) => [x, ground(x, z) ?? y, z] as Vec3),
    pads: base.pads.map((p) => ({ ...p, x: p.x * S, z: p.z * S, vh: p.vh * S })), // twice the distance -> twice the push
    charms: base.charms.map((c) => ({ id: c.id, pos: sc(c.pos) })),
    ground,
    solid: (x, z, y) => base.solid(x / S, z / S, y),
    bounds: { minX, maxX, minZ, maxZ },
    scale: S,
    mountains,
    isles: isles.map((is) => ({ cx: is.cx, cz: is.cz, coast: (a: number) => is.R * coast(is, a) })),
    structure: isStructure,
  };
}
