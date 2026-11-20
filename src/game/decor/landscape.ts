// Creative landscape (render-only): sandy hills with rocks/trees/flowers ON the island, a lake (three.js Water addon,
// real reflections), a river that springs from a hill, fills the lake and leaves over the island edge as a waterfall.
//
// The simulation keeps the standard flat ground (Y = 0) so the Test Contract output never changes. This module only
// adds a VISUAL height h(x, z): everything drawn on the island (Mây, motes, shades, animals, plants) is lifted by h,
// so Mây visibly walks over the hills and wades through the lake. h is forced to 0 around every gameplay spot
// (lanterns, pads, charms, start, bridge, tiers, ramps, island edge) so those places look exactly like the rules.
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { makeRng } from "../../sim/rng";
import type { NightMap } from "../../sim/maps";
import { PALETTE } from "../models";
import { SEA_Y, waterNormals } from "./environment";
import type { Spot } from "./vegetation";

interface Hill { x: number; z: number; r: number; h: number; seed: number }
interface Lake { x: number; z: number; r: number; depth: number; level: number }

const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const flow = { value: 0 };

/** Flowing water shader for the river and the waterfall: two scrolling normal-map layers, fresnel sky reflection,
 *  moon glint and foam on the banks (no extra render pass, unlike a reflective Water, to keep >= 30 FPS). */
function flowingWater(vertical: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: flow, uNormals: { value: waterNormals() }, uMoon: { value: new THREE.Vector3(-0.45, 0.55, 0.7).normalize() } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vWorld;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uNormals; uniform vec3 uMoon;
      varying vec2 vUv; varying vec3 vWorld;
      void main(){
        ${vertical
          ? "vec2 a = vec2(vUv.x * 1.5, vUv.y * 3.0 + uTime * 2.2); vec2 b = vec2(vUv.x * 3.0 + 0.3, vUv.y * 5.0 + uTime * 3.1);"
          : "vec2 a = vec2(vUv.x * 18.0 - uTime * 0.9, vUv.y * 1.2); vec2 b = vec2(vUv.x * 30.0 - uTime * 1.4, vUv.y * 2.0 + 0.5);"}
        vec3 n = normalize((texture2D(uNormals, a).rgb + texture2D(uNormals, b).rgb) - 1.0);
        n = normalize(vec3(n.x * 0.6, 1.0, n.y * 0.6));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(v, n), 0.0), 3.0);
        float glint = pow(max(dot(reflect(-uMoon, n), v), 0.0), 60.0);
        vec3 deep = vec3(0.04, 0.16, 0.22), sky = vec3(0.16, 0.22, 0.42);
        float across = ${vertical ? "vUv.x" : "vUv.y"};
        float bank = 1.0 - smoothstep(0.0, 0.22, min(across, 1.0 - across));
        float streak = ${vertical ? "smoothstep(0.55, 1.0, texture2D(uNormals, vec2(vUv.x * 4.0, vUv.y * 2.0 + uTime * 2.6)).r)" : "0.0"};
        vec3 col = mix(deep, sky, fres) + glint * 0.8 + vec3(0.75, 0.85, 0.95) * (bank * 0.35 + streak * 0.6);
        float alpha = ${vertical ? "0.82" : "0.88"} * smoothstep(0.0, 0.08, min(across, 1.0 - across));
        gl_FragColor = vec4(col, alpha);
      }`,
  });
}

export class Landscape {
  readonly group = new THREE.Group();
  readonly hills: Hill[] = [];
  readonly lakes: Lake[] = [];
  /** river polylines (XZ) for the channel and to keep trees out */
  readonly rivers: [number, number][][] = [];
  private flatSpots: Spot[];
  private lakeWater: Water[] = [];

  constructor(private map: NightMap, gameplay: Spot[], quality: "high" | "low") {
    this.flatSpots = gameplay;
    const rng = makeRng(31 + map.night);
    const islands: [number, number, number][] = map.isles
      ? map.isles.map((is) => [is.cx, is.cz, Math.min(...Array.from({ length: 36 }, (_, i) => is.coast((i / 36) * Math.PI * 2)))])
      : map.night === 2 ? [[0, 0, 28], [70, 0, 28]] : map.night === 3 ? [[0, 0, 45]] : [[0, 0, 40]];

    // hills: sandy mounds on free ground, away from gameplay spots
    const want = map.night === 2 ? 2 : map.night === 3 ? 4 : 5;
    for (const [cx, cz, R] of islands) {
      for (let k = 0, tries = 0; k < want && tries < 400; tries++) {
        const a = rng() * Math.PI * 2, d = R * (0.2 + rng() * 0.6);
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const r = 5 + rng() * 4;
        if (this.freeRadius(x, z) < r + 1 || this.hills.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + r)) continue;
        this.hills.push({ x, z, r, h: 2.2 + rng() * 2.6, seed: rng() * 10 });
        k++;
      }
    }

    // one lake per night (on the first island), fed by a river from a hill, overflowing to a waterfall at the edge
    const [cx, cz, R] = islands[0];
    for (let tries = 0; tries < 400; tries++) {
      const a = rng() * Math.PI * 2, d = R * (0.25 + rng() * 0.45);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, r = 4 + rng() * 2;
      if (this.freeRadius(x, z) < r + 2 || this.hills.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + r + 1)) continue;
      // outflow: radial line from the lake to the island edge must stay clear of gameplay spots
      const ox = (x - cx) / (d || 1), oz = (z - cz) / (d || 1);
      const out: [number, number][] = [];
      let ok = true;
      for (let s = r * 0.6; ; s += 1) {
        const px = x + ox * s + Math.sin(s * 0.35) * oz * 1.2, pz = z + oz * s - Math.sin(s * 0.35) * ox * 1.2;
        const gp = map.ground(px, pz);
        if (gp === null) break;
        if (gp !== 0) { ok = false; break; } // never across a mountain or a tier
        if (this.flatSpots.some((f) => Math.hypot(f.x - px, f.z - pz) < f.r + 2)) { ok = false; break; }
        out.push([px, pz]);
        if (s > R * 2) { ok = false; break; }
      }
      if (!ok || out.length < 4) continue;
      this.lakes.push({ x, z, r, depth: 0.9, level: -0.35 });
      this.rivers.push(out);
      // inflow from the nearest hill
      const hill = [...this.hills].sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z))[0];
      if (hill) {
        const inflow: [number, number][] = [];
        const L = Math.hypot(hill.x - x, hill.z - z);
        for (let s = hill.r * 0.35; s <= L - r * 0.6; s += 0.8) {
          const t = s / L, px = hill.x + (x - hill.x) * t, pz = hill.z + (z - hill.z) * t;
          const wob = Math.sin(t * 9) * 0.9, nx = -(z - hill.z) / L, nz = (x - hill.x) / L;
          inflow.push([px + nx * wob, pz + nz * wob]);
        }
        if (inflow.length > 2 && inflow.every(([px, pz]) => !this.flatSpots.some((f) => Math.hypot(f.x - px, f.z - pz) < f.r + 1.5))) this.rivers.push(inflow);
      }
      break;
    }

    this.buildGround();
    this.buildWater(quality);
  }

  /** distance from (x,z) to the nearest place that must stay flat (gameplay spot, edge, tier, bridge) */
  private freeRadius(x: number, z: number): number {
    let best = 99;
    for (const f of this.flatSpots) best = Math.min(best, Math.hypot(f.x - x, f.z - z) - f.r);
    for (let r = 1; r <= 12; r += 1) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        if (this.map.ground(x + Math.cos(a) * r, z + Math.sin(a) * r) !== 0 || this.onBridge(x + Math.cos(a) * r, z + Math.sin(a) * r)) return Math.min(best, r - 1);
      }
    }
    return best;
  }

  private onBridge(x: number, z: number): boolean {
    const S = this.map.scale ?? 1;
    return this.map.night === 2 && x > 25 * S && x < 45 * S && Math.abs(z) < 3 * S;
  }

  /** 0..1: how much the visual height may deviate from Y=0 here (0 near edges, tiers, bridge and gameplay spots) */
  private mask(x: number, z: number): number {
    if (this.map.ground(x, z) !== 0 || this.onBridge(x, z)) return 0;
    let m = 1;
    for (const r of [1.5, 3, 4.5]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + r;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (this.map.ground(px, pz) !== 0 || this.onBridge(px, pz)) { m = Math.min(m, (r - 1.5) / 3); }
      }
    }
    for (const f of this.flatSpots) m = Math.min(m, smooth(f.r, f.r + 3, Math.hypot(f.x - x, f.z - z)));
    return Math.max(0, m);
  }

  private riverDist(x: number, z: number): number {
    let best = 99;
    for (const path of this.rivers) {
      for (let i = 0; i + 1 < path.length; i++) {
        const [ax, az] = path[i], [bx, bz] = path[i + 1];
        const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
        best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
      }
    }
    return best;
  }

  // ---- cached grid (built once in buildGround): height() and friends become cheap bilinear lookups
  private grid: { x0: number; z0: number; step: number; nx: number; nz: number; h: Float32Array; m: Float32Array; w: Uint8Array } | null = null;

  private lookup(arr: Float32Array, x: number, z: number): number {
    const g = this.grid!;
    const fx = (x - g.x0) / g.step, fz = (z - g.z0) / g.step;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i + 1 >= g.nx || j + 1 >= g.nz) return 0;
    const tx = fx - i, tz = fz - j, k = j * g.nx + i;
    return (arr[k] * (1 - tx) + arr[k + 1] * tx) * (1 - tz) + (arr[k + g.nx] * (1 - tx) + arr[k + g.nx + 1] * tx) * tz;
  }

  /** visual height added to everything drawn at (x, z) */
  height(x: number, z: number): number {
    return this.grid ? this.lookup(this.grid.h, x, z) : this.heightRaw(x, z);
  }

  private heightRaw(x: number, z: number, mask = this.mask(x, z)): number {
    const m = mask;
    if (m <= 0) return 0;
    let h = 0;
    for (const hl of this.hills) {
      const d = Math.hypot(x - hl.x, z - hl.z);
      if (d >= hl.r) continue;
      const bump = 0.5 + 0.5 * Math.cos((Math.PI * d) / hl.r);
      // wind-carved dune ripples on the sandy slopes
      const ripple = 0.12 * Math.sin(x * 1.3 + hl.seed) * Math.sin(z * 1.1 - hl.seed) * bump;
      h += hl.h * bump * bump * (3 - 2 * bump) + ripple * hl.h * 0.4;
    }
    for (const lk of this.lakes) {
      const d = Math.hypot(x - lk.x, z - lk.z);
      if (d < lk.r + 1.5) h -= lk.depth * smooth(lk.r + 1.5, lk.r * 0.4, d);
    }
    const rd = this.riverDist(x, z);
    if (rd < 1.4) h -= 0.45 * (1 - rd / 1.4) ** 2;
    return h * m;
  }

  /** true where water is drawn (no grass/trees there) */
  isWater(x: number, z: number): boolean {
    if (this.grid) {
      const g = this.grid, i = Math.round((x - g.x0) / g.step), j = Math.round((z - g.z0) / g.step);
      return i >= 0 && j >= 0 && i < g.nx && j < g.nz && g.w[j * g.nx + i] === 1;
    }
    return this.isWaterRaw(x, z);
  }

  private isWaterRaw(x: number, z: number): boolean {
    return this.lakes.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + 0.3) || this.riverDist(x, z) < 1.1;
  }

  /** sandy (hill tops / slopes) vs grassy ground, used by the vegetation for colour and placement */
  sandiness(x: number, z: number): number {
    const h = this.height(x, z);
    const e = this.grid ? this.grid.step : 0.4;
    const slope = Math.hypot(this.height(x + e, z) - this.height(x - e, z), this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
    return Math.min(1, Math.max(0, (h - 0.8) / 2.2) + slope * 0.6);
  }

  private buildGround(): void {
    const b = this.map.bounds, step = this.map.scale ? 1 : 0.5; // explore maps are 4x the area: coarser grid
    const nx = Math.ceil((b.maxX - b.minX) / step) + 1, nz = Math.ceil((b.maxZ - b.minZ) / step) + 1;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
    const valid = new Uint8Array(nx * nz);
    const grass = new THREE.Color(PALETTE.grass), sand = new THREE.Color(PALETTE.sand), mud = new THREE.Color(0x4a4232), c = new THREE.Color();
    const rock = new THREE.Color(0x5d5a66), snow = new THREE.Color(0xe8eef6);
    const structure = (x: number, z: number, g: number) => (this.map.structure ? this.map.structure(x, z) : g > 0);
    // pass 1: the expensive height / mask / water evaluation, once per grid vertex, cached for every later lookup
    const hArr = new Float32Array(nx * nz), mArr = new Float32Array(nx * nz), wArr = new Uint8Array(nx * nz);
    const gArr = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = b.minX + i * step, z = b.minZ + j * step, k = j * nx + i;
        const g = this.map.ground(x, z);
        gArr[k] = g ?? 0;
        valid[k] = g !== null && !structure(x, z, g) && !this.onBridge(x, z) ? 1 : 0;
        if (!valid[k]) continue;
        const m = this.mask(x, z);
        mArr[k] = m;
        hArr[k] = this.heightRaw(x, z, m);
        wArr[k] = this.isWaterRaw(x, z) ? 1 : 0;
      }
    }
    this.grid = { x0: b.minX, z0: b.minZ, step, nx, nz, h: hArr, m: mArr, w: wArr };
    // pass 2: geometry + colours from the cached grid
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = b.minX + i * step, z = b.minZ + j * step, k = j * nx + i;
        const g: number | null = valid[k] ? gArr[k] : null;
        const h = valid[k] ? gArr[k] + hArr[k] : 0; // real mountain ground + visual dunes
        pos.set([x, h, z], k * 3);
        const s = valid[k] ? this.sandiness(x, z) : 0;
        const edgeSand = valid[k] ? 1 - mArr[k] : 0; // sandy rim near the coast like before
        c.copy(grass).lerp(sand, Math.max(s, edgeSand * 0.8));
        if (valid[k] && (g as number) > 0.5) { // mountain: grass -> bare rock on steep / high ground -> snow cap
          const gg = g as number, e = 1;
          const slope = Math.hypot((this.map.ground(x + e, z) ?? gg) - (this.map.ground(x - e, z) ?? gg), (this.map.ground(x, z + e) ?? gg) - (this.map.ground(x, z - e) ?? gg)) / (2 * e);
          c.copy(grass).lerp(rock, Math.min(1, Math.max(0, (gg - 6) / 12) + Math.max(0, slope - 1) * 0.6));
          if (gg > 24) c.lerp(snow, Math.min(1, (gg - 24) / 6));
        }
        if (valid[k] && (hArr[k] < -0.15 || wArr[k])) c.copy(mud);
        col.set([c.r, c.g, c.b], k * 3);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j + 1 < nz; j++) {
      for (let i = 0; i + 1 < nx; i++) {
        const a = j * nx + i, bq = a + 1, cq = a + nx, d = cq + 1;
        if (valid[a] && valid[bq] && valid[cq] && valid[d]) idx.push(a, cq, bq, bq, cq, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0x0b1f19 }));
    mesh.position.y = 0.01; // just above the island lathe top (which stays as the base/cliff)
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildWater(quality: "high" | "low"): void {
    for (const lk of this.lakes) {
      // three.js Water addon: real-time reflection of the sky, moon, trees and lanterns
      const w = new Water(new THREE.CircleGeometry(lk.r + 0.6, 48), {
        textureWidth: quality === "high" ? 256 : 128, textureHeight: quality === "high" ? 256 : 128,
        waterNormals: waterNormals(), sunDirection: new THREE.Vector3(-0.45, 0.55, 0.7).normalize(),
        sunColor: 0xcfe0ff, waterColor: 0x0c3140, distortionScale: 0.8, fog: true,
      });
      w.rotation.x = -Math.PI / 2;
      w.position.set(lk.x, lk.level, lk.z);
      (w.material as THREE.ShaderMaterial).uniforms.size.value = 3;
      this.lakeWater.push(w);
      this.group.add(w);
    }
    this.rivers.forEach((path, ri) => {
      const pts = path.map(([x, z]) => new THREE.Vector3(x, 0, z));
      const curve = new THREE.CatmullRomCurve3(pts);
      const N = Math.max(20, path.length * 4), W = ri === 0 ? 1.8 : 1.3;
      const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, p = curve.getPoint(t), tg = curve.getTangent(t);
        const sx = -tg.z, sz = tg.x;
        for (const side of [0.5, -0.5]) {
          const x = p.x + sx * W * side, z = p.z + sz * W * side;
          pos.push(x, Math.max(this.height(p.x, p.z), -0.3) + 0.12, z);
        }
        uv.push(t, 0, t, 1);
        if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      this.group.add(new THREE.Mesh(geo, flowingWater(false)));

      if (ri === 0) { // the outflow ends at the island edge: waterfall into the cloud sea
        const end = curve.getPoint(1), before = curve.getPoint(0.95);
        const out = new THREE.Vector3(end.x - before.x, 0, end.z - before.z).normalize();
        const H = -SEA_Y;
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.1, H, 1, 24), flowingWater(true));
        // bend the curtain outward as it falls (parabola)
        const fp = fall.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < fp.count; i++) { const tt = (H / 2 - fp.getY(i)) / H; fp.setZ(i, tt * tt * 2.5); }
        fall.geometry.computeVertexNormals();
        const top = end.clone().addScaledVector(out, 0.8);
        fall.position.set(top.x, -H / 2 + 0.1, top.z);
        fall.lookAt(top.x + out.x, -H / 2 + 0.1, top.z + out.z);
        this.group.add(fall);
        // foam + mist where it hits the cloud sea
        const base = top.clone().addScaledVector(out, 2.5);
        for (let k = 0; k < 6; k++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(1.2 + k * 0.35, 12, 8),
            new THREE.MeshBasicMaterial({ color: 0xdbe8ff, transparent: true, opacity: 0.22 - k * 0.025, depthWrite: false }));
          puff.position.set(base.x + Math.sin(k * 2.1) * 1.2, SEA_Y + 0.3 + k * 0.5, base.z + Math.cos(k * 2.1) * 1.2);
          puff.userData.mist = k;
          this.group.add(puff);
        }
      }
    });
  }

  /** trees should keep off the water and the river banks */
  waterSpots(): Spot[] {
    const s: Spot[] = this.lakes.map((l) => ({ x: l.x, z: l.z, r: l.r + 1 }));
    for (const path of this.rivers) for (let i = 0; i < path.length; i += 2) s.push({ x: path[i][0], z: path[i][1], r: 1.6 });
    return s;
  }

  update(time: number): void {
    flow.value = time;
    for (const w of this.lakeWater) (w.material as THREE.ShaderMaterial).uniforms.time.value = time * 0.4;
    this.group.children.forEach((o) => {
      if (o.userData.mist !== undefined) o.scale.setScalar(1 + Math.sin(time * 1.5 + o.userData.mist) * 0.12);
    });
  }
}
