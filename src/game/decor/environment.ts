// Sea of clouds (three.js Water addon, standard colour #12384A), starry sky and moon. Render-only.
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { PALETTE } from "../models";

/** Below the fall threshold (Y < -10), so a falling Mây disappears into the cloud sea. */
export const SEA_Y = -14;

/** Tileable normal map generated in code (sum of integer-frequency waves), so no texture file is needed. */
function makeWaterNormals(size = 256): THREE.DataTexture {
  const waves: [number, number, number, number][] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14; i++) {
    const kx = Math.round((rnd() - 0.5) * 16), ky = Math.round((rnd() - 0.5) * 16);
    if (kx === 0 && ky === 0) continue;
    waves.push([kx, ky, 1 / Math.hypot(kx, ky), rnd() * Math.PI * 2]);
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      for (const [kx, ky, a, p] of waves) {
        const c = Math.cos(((kx * x + ky * y) / size) * Math.PI * 2 + p) * a;
        dx += c * kx; dy += c * ky;
      }
      const n = new THREE.Vector3(-dx * 0.08, -dy * 0.08, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export class Environment {
  readonly water: Water;
  readonly moonDir = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();

  constructor(scene: THREE.Scene, quality: "high" | "low") {
    this.water = new Water(new THREE.PlaneGeometry(1600, 1600), {
      textureWidth: quality === "high" ? 512 : 256,
      textureHeight: quality === "high" ? 512 : 256,
      waterNormals: makeWaterNormals(),
      sunDirection: this.moonDir.clone(),
      sunColor: 0xbfd0ff,
      waterColor: PALETTE.cloudSea,
      distortionScale: 2.2,
      fog: true,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = SEA_Y;
    (this.water.material as THREE.ShaderMaterial).uniforms.size.value = 6;
    scene.add(this.water);

    const starGeo = new THREE.BufferGeometry();
    const sp: number[] = [];
    let s = 3;
    const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    for (let i = 0; i < 1500; i++) {
      const u = rnd() * 2 * Math.PI, v = Math.acos(rnd() * 0.95);
      sp.push(420 * Math.sin(v) * Math.cos(u), 420 * Math.cos(v), 420 * Math.sin(v) * Math.sin(u));
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.3, sizeAttenuation: false, fog: false })));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(12, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf3ecd2, fog: false }));
    moon.position.copy(this.moonDir).multiplyScalar(400);
    scene.add(moon);
  }

  update(time: number): void {
    (this.water.material as THREE.ShaderMaterial).uniforms.time.value = time * 0.6;
  }
}
