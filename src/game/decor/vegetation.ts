// Grass, flowers, trees and rocks with InstancedMesh (one draw call per kind). Wind is computed in the vertex shader.
// Render-only: placement uses its own seeded RNG over the night's standard map and never touches the simulation.
import * as THREE from "three";
import { makeRng } from "../../sim/rng";
import type { NightMap } from "../../sim/maps";
import { PALETTE } from "../models";

export interface Spot { x: number; z: number; r: number }

const windUniform = { value: 0 };

function addWind(mat: THREE.Material, strength: number, heightAttr: "uv" | "y"): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float h = ${heightAttr === "uv" ? "uv.y * uv.y" : "max(position.y, 0.0) * 0.15"};
        vec3 ip = vec3(instanceMatrix[3].x, 0.0, instanceMatrix[3].z);
        float w = sin(uWind * 1.7 + ip.x * 0.35 + ip.z * 0.2) + 0.5 * sin(uWind * 3.1 + ip.z * 0.7);
        transformed.x += w * h * ${strength.toFixed(3)};
        transformed.z += cos(uWind * 1.3 + ip.x * 0.5) * h * ${(strength * 0.5).toFixed(3)};`,
      );
  };
}

export interface VegetationOptions {
  map: NightMap;
  /** places where nothing big should grow (lanterns, pads, charms, start, ramps) */
  avoid: Spot[];
  quality: "high" | "low";
}

export class Vegetation {
  readonly trees: Spot[] = [];
  readonly group = new THREE.Group();

  constructor(opts: VegetationOptions) {
    const { map, avoid } = opts;
    const rng = makeRng(2024 + map.night);
    const b = map.bounds;
    const area = (b.maxX - b.minX) * (b.maxZ - b.minZ);
    const onLand = (x: number, z: number, edge = 0.5) => {
      const g = map.ground(x, z);
      if (g === null || map.solid(x, z, g)) return null;
      // keep off cliff edges and ramps: neighbours must be the same height
      for (const [dx, dz] of [[edge, 0], [-edge, 0], [0, edge], [0, -edge]]) if (map.ground(x + dx, z + dz) !== g) return null;
      if (map.night === 2 && x > 26 && x < 44 && Math.abs(z) <= 2.5) return null; // bridge
      return g;
    };
    const sample = (edge = 0.5): [number, number, number] | null => {
      for (let i = 0; i < 30; i++) {
        const x = b.minX + rng() * (b.maxX - b.minX), z = b.minZ + rng() * (b.maxZ - b.minZ);
        const g = onLand(x, z, edge);
        if (g !== null) return [x, g, z];
      }
      return null;
    };
    const near = (x: number, z: number, d: number) => avoid.some((a) => Math.hypot(a.x - x, a.z - z) < d + a.r);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const k = opts.quality === "high" ? 1 : 0.5;

    // ---- grass: tapered blades, density ~2.2 per m² of bounds (high quality)
    const blade = new THREE.PlaneGeometry(0.09, 0.6, 1, 4);
    blade.translate(0, 0.3, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) * (1 - bp.getY(i) / 0.6));
    // a little green self-glow keeps the blades green at night instead of turning brown under the warm lantern light
    const grassMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: PALETTE.grass, emissiveIntensity: 0.45 });
    addWind(grassMat, 0.18, "uv");
    const GRASS = Math.round(area * 2.2 * k);
    const grass = new THREE.InstancedMesh(blade, grassMat, GRASS);
    const base = new THREE.Color(PALETTE.grass);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    let n = 0;
    for (let i = 0; i < GRASS; i++) {
      const pt = sample(0.2);
      if (!pt) continue;
      q.setFromAxisAngle(up, rng() * Math.PI);
      m.compose(p.set(pt[0], pt[1], pt[2]), q, s.set(1, 0.6 + rng() * 0.9, 1));
      grass.setMatrixAt(n, m);
      grass.setColorAt(n++, col.setHSL(hsl.h + (rng() - 0.5) * 0.04, hsl.s, hsl.l * (0.75 + rng() * 0.5)));
    }
    grass.count = n;
    this.group.add(grass);

    // ---- flowers in small patches, softly glowing
    const FLOWERS = Math.round(area * 0.07 * k);
    const stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 3).translate(0, 0.225, 0), new THREE.MeshLambertMaterial({ color: 0x2f5a35 }), FLOWERS);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25, flatShading: true });
    addWind(headMat, 0.05, "y");
    const head = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0).translate(0, 0.48, 0), headMat, FLOWERS);
    const palette = [0xfff4e0, 0xffb7d5, 0xffe27a, 0xc9b2ff, 0xffa36b];
    n = 0;
    for (let i = 0; i < FLOWERS; i++) {
      const pt = sample();
      if (!pt) continue;
      for (let j = 0; j < 3 && n < FLOWERS; j++, i++) {
        const x = pt[0] + (rng() - 0.5) * 1.5, z = pt[2] + (rng() - 0.5) * 1.5;
        if (onLand(x, z, 0.2) !== pt[1]) continue;
        m.compose(p.set(x, pt[1], z), q.identity(), s.set(1, 0.7 + rng() * 0.6, 1));
        stem.setMatrixAt(n, m); head.setMatrixAt(n, m);
        head.setColorAt(n++, col.setHex(palette[Math.floor(rng() * palette.length)]));
      }
    }
    stem.count = head.count = n;
    this.group.add(stem, head);

    // ---- trees (pines + round), away from gameplay spots
    const TREES = Math.round(area * 0.012);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 2, 6).translate(0, 1, 0), new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true }), TREES);
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x23472f, flatShading: true });
    addWind(pineMat, 0.06, "y");
    const roundMat = new THREE.MeshStandardMaterial({ color: 0x2f5e3a, flatShading: true });
    addWind(roundMat, 0.06, "y");
    const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 2.4, 7).translate(0, 2.6, 0), pineMat, TREES);
    const pines2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.0, 1.9, 7).translate(0, 3.7, 0), pineMat, TREES);
    const rounds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.5, 1).translate(0, 3.1, 0), roundMat, TREES);
    let nP = 0, nR = 0, nT = 0;
    for (let tries = 0; nT < TREES && tries < TREES * 40; tries++) {
      const pt = sample(1.6);
      if (!pt) continue;
      const [x, y, z] = pt;
      if (near(x, z, 5) || this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
      const sc = 0.8 + rng() * 0.6;
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      m.compose(p.set(x, y, z), q, s.set(sc, sc, sc));
      trunks.setMatrixAt(nT++, m);
      if (rng() < 0.55) { pines.setMatrixAt(nP, m); pines2.setMatrixAt(nP++, m); }
      else { rounds.setMatrixAt(nR, m); rounds.setColorAt(nR++, col.setHSL(0.3 + rng() * 0.06, 0.4, 0.2 + rng() * 0.08)); }
      this.trees.push({ x, z, r: 0.3 * sc });
    }
    trunks.count = nT; pines.count = pines2.count = nP; rounds.count = nR;
    for (const t of [trunks, pines, pines2, rounds]) { t.castShadow = true; this.group.add(t); }

    // ---- rocks
    const ROCKS = Math.round(area * 0.006);
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: 0x55546a, flatShading: true }), ROCKS);
    n = 0;
    for (let i = 0; i < ROCKS; i++) {
      const pt = sample(1);
      if (!pt || near(pt[0], pt[2], 2)) continue;
      q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
      const sc = 0.5 + rng() * 1.2;
      m.compose(p.set(pt[0], pt[1] + 0.1, pt[2]), q, s.set(sc, sc * 0.7, sc));
      rocks.setMatrixAt(n++, m);
    }
    rocks.count = n;
    rocks.castShadow = true;
    this.group.add(rocks);
  }

  update(time: number): void {
    windUniform.value = time;
  }
}
