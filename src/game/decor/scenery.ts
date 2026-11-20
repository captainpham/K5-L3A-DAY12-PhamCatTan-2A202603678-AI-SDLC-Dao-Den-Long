// Creative scenery (render-only): winding streams with a waterfall off the island edge, and distant mountains
// rising from the cloud sea. Streams are flat decals on the standard ground (Mây walks over them), so the map,
// the rules and the headless output are unchanged.
import * as THREE from "three";
import { makeRng } from "../../sim/rng";
import type { NightMap } from "../../sim/maps";
import { SEA_Y } from "./environment";
import type { Spot } from "./vegetation";

const flowUniform = { value: 0 };

function waterMaterial(vertical: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: flowUniform },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      void main(){
        float flow = vUv.${vertical ? "y" : "x"} * ${vertical ? "6.0" : "40.0"} - uTime * ${vertical ? "3.0" : "1.2"};
        float ripple = 0.5 + 0.5 * sin(flow * 6.2831 + sin(vUv.${vertical ? "x" : "y"} * 12.0 + uTime) * 1.5);
        float edge = smoothstep(0.0, 0.18, vUv.${vertical ? "x" : "y"}) * smoothstep(1.0, 0.82, vUv.${vertical ? "x" : "y"});
        vec3 deep = vec3(0.05, 0.22, 0.32), foam = vec3(0.55, 0.78, 0.9);
        gl_FragColor = vec4(mix(deep, foam, ripple * ${vertical ? "0.6" : "0.35"}), 0.85 * edge);
      }`,
  });
}

export class Scenery {
  readonly group = new THREE.Group();
  /** points along the streams (trees keep away from them) */
  readonly streamSpots: Spot[] = [];

  constructor(map: NightMap, avoid: Spot[]) {
    const rng = makeRng(77 + map.night);
    const centres: [number, number, number][] = map.night === 2 ? [[0, 0, 28], [70, 0, 28]] : map.night === 3 ? [[0, 0, 45]] : [[0, 0, 40]];
    for (const [cx, cz, R] of centres) this.addStream(map, avoid, rng, cx, cz, R);
    this.addMountains(map, rng);
  }

  /** a meandering stream from inland to the island edge, then a waterfall down into the cloud sea */
  private addStream(map: NightMap, avoid: Spot[], rng: () => number, cx: number, cz: number, R: number): void {
    for (let attempt = 0; attempt < 40; attempt++) {
      const a0 = rng() * Math.PI * 2, phase = rng() * 6, r0 = R * 0.35;
      const pts: THREE.Vector3[] = [];
      let ok = true;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, r = r0 + (R - 0.3 - r0) * t;
        const a = a0 + Math.sin(t * 7 + phase) * 0.18;
        const x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
        // only on ground level 0, away from lanterns / pads / spawn points
        if (map.ground(x, z) !== 0 || avoid.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 1.2)) { ok = false; break; }
        pts.push(new THREE.Vector3(x, 0.03, z));
      }
      if (!ok) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      const N = 120, W = 1.3;
      const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, p = curve.getPoint(t), tg = curve.getTangent(t);
        const nx = -tg.z, nz = tg.x, w = W * (0.6 + 0.4 * t);
        pos.push(p.x + nx * w / 2, 0.03, p.z + nz * w / 2, p.x - nx * w / 2, 0.03, p.z - nz * w / 2);
        uv.push(t, 0, t, 1);
        if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
        if (i % 6 === 0) this.streamSpots.push({ x: p.x, z: p.z, r: 1 });
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      this.group.add(new THREE.Mesh(geo, waterMaterial(false)));
      // waterfall at the edge
      const end = curve.getPoint(1), out = new THREE.Vector3(end.x - cx, 0, end.z - cz).normalize();
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(W, -SEA_Y), waterMaterial(true));
      fall.position.set(end.x + out.x * 0.7, SEA_Y / 2, end.z + out.z * 0.7);
      fall.lookAt(fall.position.x + out.x, SEA_Y / 2, fall.position.z + out.z);
      this.group.add(fall);
      const mist = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.18, depthWrite: false }));
      mist.position.set(fall.position.x, SEA_Y + 0.5, fall.position.z);
      this.group.add(mist);
      return;
    }
  }

  /** a ring of distant peaks (snow caps) rising out of the cloud sea */
  private addMountains(map: NightMap, rng: () => number): void {
    const b = map.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    // far silhouettes: no fog (the night fog would hide them completely), muted moonlit blues
    const rock = new THREE.MeshLambertMaterial({ color: 0x242a48, emissive: 0x141a34, flatShading: true, fog: false });
    const snow = new THREE.MeshLambertMaterial({ color: 0x8e9abc, emissive: 0x3a4466, flatShading: true, fog: false });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng() * 0.3, d = 120 + rng() * 110;
      const h = 35 + rng() * 55, r = h * (0.55 + rng() * 0.3);
      const peak = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 3), rock);
      body.position.y = h / 2;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.3, 7), snow);
      cap.position.y = h * 0.86;
      peak.add(body, cap);
      // a smaller shoulder peak
      const h2 = h * 0.6;
      const side = new THREE.Mesh(new THREE.ConeGeometry(h2 * 0.6, h2, 6), rock);
      side.position.set(r * 0.6, h2 / 2, r * 0.2);
      peak.add(side);
      peak.position.set(cx + Math.cos(a) * d, SEA_Y - 2, cz + Math.sin(a) * d);
      peak.rotation.y = rng() * Math.PI;
      this.group.add(peak);
    }
  }

  update(time: number): void {
    flowUniform.value = time;
  }
}
