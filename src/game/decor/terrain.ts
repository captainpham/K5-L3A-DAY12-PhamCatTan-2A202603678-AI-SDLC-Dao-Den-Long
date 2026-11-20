// Terrain meshes built from the standard map of each night (src/sim/maps.ts). Render-only.
import * as THREE from "three";
import { RAMPS_DEG, type NightMap } from "../../sim/maps";
import { PALETTE, makePad } from "../models";

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...extra });

/** Round island: flat grass top at Y=0, sand rim (last 2 m), rocky cliff down into the cloud sea. */
function roundIsland(R: number, cx: number, cz: number, withTop = false): THREE.Mesh {
  // the top is drawn by Landscape (hills, lake, river); the lathe keeps only the rim band and the cliffs
  const profile = [
    ...(withTop ? [new THREE.Vector2(0.01, 0)] : []), new THREE.Vector2(R - 2, 0), new THREE.Vector2(R, 0),
    new THREE.Vector2(R + 0.6, -1.5), new THREE.Vector2(R * 0.85, -9), new THREE.Vector2(R * 0.4, -18),
  ];
  const geo = new THREE.LatheGeometry(profile, 96);
  const colors: number[] = [];
  const grass = new THREE.Color(PALETTE.grass), sand = new THREE.Color(PALETTE.sand), rock = new THREE.Color(0x3d3a48);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i)), y = pos.getY(i);
    colors.push(...(y < -0.5 ? rock : r > R - 2.05 ? sand : grass).toArray());
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, emissive: 0x0b1f19 }));
  m.position.set(cx, 0, cz);
  m.receiveShadow = true;
  return m;
}

/** Extruded horizontal shape between angles a0..a1 (deg, measured +X toward +Z), radii r0..r1, from y0 to y1. */
function sector(r0: number, r1: number, a0: number, a1: number, y0: number, y1: number, color: number): THREE.Mesh {
  const shape = new THREE.Shape();
  const N = 48;
  // shape is drawn in (x, -z) because the extrusion is rotated by -90° around X
  for (let i = 0; i <= N; i++) {
    const a = ((a0 + ((a1 - a0) * i) / N) * Math.PI) / 180;
    const p = [r1 * Math.cos(a), -r1 * Math.sin(a)];
    if (i === 0) shape.moveTo(p[0], p[1]); else shape.lineTo(p[0], p[1]);
  }
  for (let i = N; i >= 0; i--) {
    const a = ((a0 + ((a1 - a0) * i) / N) * Math.PI) / 180;
    shape.lineTo(r0 * Math.cos(a), -r0 * Math.sin(a));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: N });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Irregular island (explore maps): sand rim band + rocky cliff that follows the coastline coast(a). */
function irregularIsland(cx: number, cz: number, coast: (a: number) => number): THREE.Mesh {
  const N = 256, rings: [number, number][] = [[-2, 0], [0, 0], [0.6, -1.5], [-0.15, -9], [-0.6, -18]]; // (radius offset or factor, y)
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const sand = new THREE.Color(PALETTE.sand), rock = new THREE.Color(0x3d3a48);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2, R = coast(a);
    rings.forEach(([o, y], k) => {
      const r = k <= 2 ? R + o : R * (1 + o);
      pos.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
      col.push(...(k <= 1 ? sand : rock).toArray());
    });
  }
  const K = rings.length;
  for (let i = 0; i < N; i++) for (let k = 0; k + 1 < K; k++) {
    const a = i * K + k, b = (i + 1) * K + k;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, flatShading: true }));
  m.receiveShadow = true;
  return m;
}

/** withTop: draw the flat grass top too (benchmark scene, where the creative Landscape is off) */
export function buildTerrain(map: NightMap, withTop = false): THREE.Group {
  const g = new THREE.Group();
  const S = map.scale ?? 1; // explore maps are scaled x2
  if (map.isles) for (const is of map.isles) g.add(irregularIsland(is.cx, is.cz, is.coast));
  else if (map.night === 1) g.add(roundIsland(40, 0, 0, withTop));
  else if (map.night === 2) g.add(roundIsland(28, 0, 0, withTop), roundIsland(28, 70, 0, withTop));
  else g.add(roundIsland(45, 0, 0, withTop));
  if (map.night === 2) {
    // bamboo bridge x in [26, 44], z in [-2, 2] (x S), no railing
    const bridge = new THREE.Group();
    for (let x = 26 * S + 0.25; x < 44 * S; x += 0.5) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 4 * S), mat(PALETTE.wood));
      plank.position.set(x, -0.06, 0);
      plank.receiveShadow = true;
      bridge.add(plank);
    }
    for (const z of [-2 * S, 2 * S]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 18 * S, 6).rotateZ(Math.PI / 2), mat(0x8a9a4a));
      pole.position.set(35 * S, -0.15, z);
      bridge.add(pole);
    }
    g.add(bridge);
  }
  if (map.night === 3) {
    g.add(sector(12 * S, 24 * S, 0, 180, 0, 3, PALETTE.grass)); // tier 1: half ring z > 0
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8 * S, 8 * S, 6, 64), mat(PALETTE.grass));
    tier2.position.y = 3; tier2.castShadow = tier2.receiveShadow = true;
    g.add(tier2);
    for (const d of RAMPS_DEG) { // 3 m wide ramp from r=30 (Y=0) to r=24 (Y=3), x S horizontally
      const len = Math.hypot(6 * S, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3 * S), mat(PALETTE.sand));
      const a = (d * Math.PI) / 180;
      ramp.position.set(27 * S * Math.cos(a), 1.5 - 0.15, 27 * S * Math.sin(a));
      ramp.rotation.y = -a;
      ramp.rotateZ(-Math.atan2(3, 6 * S)); // local +X points outward, so the inner end is raised
      ramp.receiveShadow = true;
      g.add(ramp);
    }
    // bell tower (r = 2 x S, 8 m) on tier 2
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2 * S, 2.2 * S, 8, 16), mat(0x8a7f74));
    tower.position.y = 10; tower.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8 * S, 2.2 * S, 16), mat(0x7a2e22));
    roof.position.y = 14 + 1.1 * S;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9 * S, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.6), mat(PALETTE.gold, { metalness: 0.6, roughness: 0.4 }));
    bell.position.y = 13.4;
    g.add(tower, roof, bell);
  }
  for (const pad of map.pads) {
    const p = makePad(pad.r);
    p.position.set(pad.x, pad.y, pad.z);
    g.add(p);
  }
  return g;
}
