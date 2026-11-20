// Three.js view of a Game. Reads simulation state every frame; never writes to it (except game.extraSolids at load).
// Shades and fireflies are drawn with InstancedMesh (a few draw calls even for the 200-shade benchmark scene).
import * as THREE from "three";
import type { Game } from "../sim/game";
import { STD } from "../sim/tuning";
import { PALETTE, PALETTE_CB, makeBigLantern, makeCharm, makeDrifter, makeMay } from "./models";
import { Landscape } from "./decor/landscape";
import { Environment } from "./decor/environment";
import { Vegetation } from "./decor/vegetation";
import { Fauna } from "./decor/fauna";
import { buildTerrain } from "./decor/terrain";

export interface LoadOptions {
  /** creative decor (hills, lake, river, plants, animals). Off in the benchmark scene (Ticket-04). */
  decor: boolean;
}

/** Growable InstancedMesh holder */
class Pool {
  mesh: THREE.InstancedMesh;
  constructor(private geo: THREE.BufferGeometry, private mat: THREE.Material, private parent: THREE.Object3D, cap = 64) {
    this.mesh = this.make(cap);
  }
  private make(cap: number): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    this.parent.add(m);
    return m;
  }
  ensure(n: number): void {
    if (n <= this.mesh.instanceMatrix.count) return;
    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = this.make(Math.max(n, this.mesh.instanceMatrix.count * 2));
  }
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  readonly quality: "high" | "low";
  /** Ticket-03 colour-blind palette */
  colorblind = false;
  /** Ticket-04 accessibility: no camera shake, no screen flash */
  reduceMotion = false;
  private moon!: THREE.DirectionalLight;
  private fogBase = 0.012;
  private land: Landscape | null = null;
  /** visual height of the landscape at (x, z): 0 where the rules need flat ground */
  private h = (x: number, z: number) => (this.land ? this.land.height(x, z) : 0);
  private hemi: THREE.HemisphereLight;
  private env: Environment;
  private may = makeMay();
  private world = new THREE.Group();
  private vegetation: Vegetation | null = null;
  private fauna: Fauna | null = null;
  private lanterns: ReturnType<typeof makeBigLantern>[] = [];
  private charms: THREE.Group[] = [];
  private drifters = new Map<string, ReturnType<typeof makeDrifter>>();
  private pulseRing: THREE.Mesh;
  private pulseT = 1;
  private leaves: THREE.Points;
  private leafPos: Float32Array;
  private shakeT = 0;
  // instanced actors
  private shadeBody: Pool; private shadeRim: Pool; private shadeEyes: Pool;
  private moteCore: Pool; private moteHalo: Pool;
  private rimMat: THREE.MeshBasicMaterial; private eyeMat: THREE.MeshBasicMaterial;
  private tmp = new THREE.Object3D(); private tmpM = new THREE.Matrix4(); private col = new THREE.Color();

  constructor(container: HTMLElement) {
    this.quality = new URLSearchParams(location.search).get("quality") === "low" ? "low" : "high";
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality === "high" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality === "high" ? 1.5 : 1));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);
    addEventListener("resize", () => this.resize());
    this.resize();

    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.012);
    this.hemi = new THREE.HemisphereLight(0x8090e0, 0x302040, 0.15);
    this.scene.add(this.hemi);
    this.env = new Environment(this.scene, this.quality);
    const moon = (this.moon = new THREE.DirectionalLight(0xc8d4ff, 1.1)); // cool moonlight keeps greens green
    moon.position.copy(this.env.moonDir).multiplyScalar(90);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.far = 300; // follows Mây (see render)
    this.scene.add(moon, moon.target, this.world, this.may.root);

    // instanced shades: ink body (stunned tint per instance), violet rim, glowing eyes
    this.shadeBody = new Pool(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, flatShading: true }), this.scene);
    this.rimMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.85 });
    this.shadeRim = new Pool(new THREE.IcosahedronGeometry(0.78, 1), this.rimMat, this.scene);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xc9a7ff });
    this.shadeEyes = new Pool(new THREE.SphereGeometry(0.08, 6, 4), this.eyeMat, this.scene, 128);
    // instanced fireflies: bright core + soft halo
    this.moteCore = new Pool(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: PALETTE.moteCore }), this.scene);
    this.moteHalo = new Pool(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.35, depthWrite: false }), this.scene);

    this.pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.pulseRing);

    // wind leaves (shown 2 s before and during a gust)
    this.leafPos = new Float32Array(150 * 3);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(this.leafPos, 3));
    this.leaves = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0x9ccf6a, size: 0.25 }));
    this.leaves.visible = false;
    this.scene.add(this.leaves);
  }

  resize(): void {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /** WebGL renderer description for bench.json */
  rendererInfo(): string {
    const gl = this.renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `three.js r${THREE.REVISION} WebGL${this.renderer.capabilities.isWebGL2 ? "2" : "1"} (${gpu})`;
  }

  /** Build the night's world (terrain, plants, animals, lanterns, charms). */
  load(game: Game, opts: LoadOptions = { decor: true }): void {
    this.scene.remove(this.world);
    this.world.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.world = new THREE.Group();
    this.scene.add(this.world);
    for (const v of this.drifters.values()) this.scene.remove(v.root);
    this.drifters.clear();
    this.land = null; this.vegetation = null; this.fauna = null;

    const map = game.map;
    this.world.add(buildTerrain(map, !opts.decor));
    this.fogBase = map.scale ? 0.006 : 0.012;
    if (opts.decor) {
      // trees are solid in the windowed game, so keep them off every gameplay spot
      const avoid = [
        ...game.lanterns.map((l) => ({ x: l.x, z: l.z, r: 3 })),
        ...map.pads.map((p) => ({ x: p.x, z: p.z, r: 2 })),
        ...map.charms.map((c) => ({ x: c.pos[0], z: c.pos[2], r: 2 })),
        ...map.moteSpawns.map(([x, , z]) => ({ x, z, r: 0.5 })),
        ...map.shadeSpawns.map(([x, , z]) => ({ x, z, r: 0.5 })),
        { x: map.start[0], z: map.start[2], r: 4 },
      ];
      // creative: sandy hills, lake, river and waterfall ON the island (visual height only, see decor/landscape.ts)
      this.land = new Landscape(map, avoid.filter((a) => a.r >= 2), this.quality); // lanterns, pads, charms, start stay flat
      this.world.add(this.land.group);
      avoid.push(...this.land.waterSpots());
      this.vegetation = new Vegetation({ map, avoid, quality: this.quality, land: this.land });
      this.fauna = new Fauna(this.vegetation.trees, map, this.land);
      this.world.add(this.vegetation.group, this.fauna.group);
    }
    // creative extra (windowed game only, never in headless): Mây cannot walk through trees, big rocks and lantern poles
    // (stone base r ~1.1 m; the interact radius of 2 m is still reachable)
    game.extraSolids = [
      ...(this.vegetation?.trees ?? []).map((t) => ({ x: t.x, z: t.z, r: t.r + 0.35 })),
      ...(this.vegetation?.rocks ?? []).map((r) => ({ x: r.x, z: r.z, r: r.r + 0.3 })),
      ...game.lanterns.map((l) => ({ x: l.x, z: l.z, r: 1.0 })),
    ];
    if (game.bench) game.extraSolids = [];
    this.lanterns = game.lanterns.map((l) => {
      const v = makeBigLantern();
      v.root.position.set(l.x, l.y, l.z);
      this.world.add(v.root);
      return v;
    });
    this.charms = game.charms.map((c) => {
      const v = makeCharm();
      v.position.set(c.x, c.y + 1, c.z);
      this.world.add(v);
      return v;
    });
  }

  pulse(): void { this.pulseT = 0; }
  /** short camera shake when Mây is hit (skipped with reduced motion) */
  shake(): void { if (!this.reduceMotion) this.shakeT = 0.35; }

  /** screen position of a world point (for off-screen arrows) */
  project(x: number, y: number, z: number): { x: number; y: number; behind: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 };
  }

  /** camOverride: fixed camera position looking at (0,0,0) (benchmark orbit) */
  render(game: Game, camYawDeg: number, time: number, dt: number, camOverride?: [number, number, number]): void {
    const p = game.player;
    this.may.root.visible = game.playerActive && !(p.invulnTicks > 0 && Math.floor(time * 12) % 2 === 0);
    const hp = this.h(p.x, p.z); // Mây walks over the visual hills / wades in the lake
    this.may.root.position.set(p.x, p.y + hp, p.z);
    this.may.root.rotation.y = Math.atan2(p.faceX, p.faceZ);
    this.may.lamp.intensity = 2 + p.carried * 0.6;

    // lanterns + ambient light grows with progress: 0.15 + 0.55 x lit/total (Ticket-02)
    let lit = 0;
    game.lanterns.forEach((l, i) => {
      const v = this.lanterns[i];
      const cost = l.everLit ? game.t.relight_cost : game.t.lantern_cost;
      const fill = l.lit ? 1 : l.deposited / cost;
      const fuel = l.fuelU / 60;
      const low = l.lit && l.fuelU < game.lowFuelU; // fuel < 30: lamp and fuel bar blink slowly (1 Hz)
      const blinkOff = low && Math.floor(time * 2) % 2 === 1;
      const mat = v.lamp.material as THREE.MeshStandardMaterial;
      mat.color.setHex(l.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
      mat.emissiveIntensity = l.lit ? (blinkOff ? 0.3 : 1.6 + Math.sin(time * 3 + i) * 0.15) : fill * 0.8;
      v.core.visible = l.lit && !blinkOff;
      v.light.intensity = l.lit ? (blinkOff ? 40 : 140) * (0.4 + 0.6 * Math.min(1, fuel / 50)) : fill * 20;
      v.lamp.scale.y = l.lit ? 1 : 0.8; // out: squashed 20% + torn paper (no colour needed)
      v.tear.visible = !l.lit;
      v.fuelBg.visible = l.lit && !blinkOff;
      v.fuelBar.scale.x = Math.max(0.001, fuel / game.t.fuel_max);
      (v.fuelBar.material as THREE.MeshBasicMaterial).color.setHex(low ? (this.colorblind ? 0xffffff : PALETTE.danger) : PALETTE.lanternLit);
      v.fuelBg.quaternion.copy(this.camera.quaternion);
      if (l.lit) lit++;
    });
    const k = lit / game.lanterns.length;
    this.hemi.intensity = 0.15 + 0.55 * k;
    (this.scene.fog as THREE.FogExp2).density = this.fogBase * (1 - k * 0.4);
    const focus = camOverride ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(p.x, p.y, p.z);
    this.moon.target.position.copy(focus); // shadows follow the action
    this.moon.position.copy(this.env.moonDir).multiplyScalar(90).add(focus);

    game.charms.forEach((c, i) => {
      const v = this.charms[i];
      v.visible = c.available;
      v.rotation.y = time * 2;
      v.position.y = c.y + 1 + Math.sin(time * 2 + i) * 0.15;
    });

    // ---- shades (instanced)
    const n = game.shades.length;
    this.shadeBody.ensure(n); this.shadeRim.ensure(n); this.shadeEyes.ensure(n * 2);
    this.rimMat.color.setHex(this.colorblind ? PALETTE_CB.shadeRim : PALETTE.shadeRim);
    this.eyeMat.color.setHex(this.colorblind ? PALETTE_CB.shadeRim : 0xc9a7ff);
    let rims = 0;
    const o = this.tmp;
    game.shades.forEach((s, i) => {
      const stunned = s.state === "stunned";
      const grow = s.state === "spawning" ? 1 - s.stateTicks / STD.shadeSpawningTicks : 1;
      o.position.set(s.x, s.y + Math.max(0, this.h(s.x, s.z)) + Math.sin(time * 4 + s.x) * 0.12, s.z);
      o.rotation.set(s.state === "drain" ? Math.sin(time * 10) * 0.1 : 0, Math.atan2(p.x - s.x, p.z - s.z), 0);
      o.scale.setScalar(Math.max(0.05, grow) * (1 + Math.sin(time * 6 + s.z) * 0.06));
      o.updateMatrix();
      this.shadeBody.mesh.setMatrixAt(i, o.matrix);
      this.shadeBody.mesh.setColorAt(i, this.col.setHex(stunned ? PALETTE.shadeStunned : PALETTE.shadeBody));
      if (!stunned) this.shadeRim.mesh.setMatrixAt(rims++, o.matrix);
      for (const [j, sx] of [[0, -0.22], [1, 0.22]] as const) {
        this.tmpM.makeTranslation(sx, 0.15, 0.62).premultiply(o.matrix);
        this.shadeEyes.mesh.setMatrixAt(i * 2 + j, this.tmpM);
      }
    });
    this.shadeBody.mesh.count = n; this.shadeRim.mesh.count = rims; this.shadeEyes.mesh.count = n * 2;
    for (const pool of [this.shadeBody, this.shadeRim, this.shadeEyes]) pool.mesh.instanceMatrix.needsUpdate = true;
    if (this.shadeBody.mesh.instanceColor) this.shadeBody.mesh.instanceColor.needsUpdate = true;

    // ---- fireflies (instanced; dropped ones blink before they expire)
    let m = 0;
    this.moteCore.ensure(game.motes.length); this.moteHalo.ensure(game.motes.length);
    for (const mt of game.motes) {
      if (mt.ttl !== null && mt.ttl < 120 && Math.floor(time * 8) % 2 === 0) continue;
      o.position.set(mt.x, mt.y + Math.max(0, this.h(mt.x, mt.z)) + 0.8 + Math.sin(time * 2.5 + mt.x * 3) * 0.2, mt.z);
      o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix();
      this.moteCore.mesh.setMatrixAt(m, o.matrix); this.moteHalo.mesh.setMatrixAt(m, o.matrix);
      m++;
    }
    this.moteCore.mesh.count = this.moteHalo.mesh.count = m;
    this.moteCore.mesh.instanceMatrix.needsUpdate = this.moteHalo.mesh.instanceMatrix.needsUpdate = true;

    // ---- drifters: rippling ribbons (at most 2)
    const seenD = new Set<string>();
    for (const d of game.drifters) {
      seenD.add(d.id);
      let v = this.drifters.get(d.id);
      if (!v) { v = makeDrifter(); this.drifters.set(d.id, v); this.scene.add(v.root); }
      v.root.position.set(d.x, d.y + Math.max(0, this.h(d.x, d.z)), d.z);
      v.root.rotation.y = d.state === "flee" ? Math.atan2(d.x - p.x, d.z - p.z) : Math.atan2(p.x - d.x, p.z - d.z);
      const pos = v.ribbon.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const z = v.base[i * 3 + 2];
        pos.setY(i, v.base[i * 3 + 1] + Math.sin(time * 8 + z * 2.5) * 0.25);
        pos.setX(i, v.base[i * 3] + Math.cos(time * 6 + z * 2) * 0.15);
      }
      pos.needsUpdate = true;
    }
    for (const [id, v] of this.drifters) if (!seenD.has(id)) { this.scene.remove(v.root); this.drifters.delete(id); }

    // pulse ring (centre = feet + 0.8 m)
    this.pulseT = Math.min(1, this.pulseT + dt * 2.5);
    (this.pulseRing.material as THREE.MeshBasicMaterial).opacity = (1 - this.pulseT) * 0.8;
    this.pulseRing.scale.setScalar(0.5 + this.pulseT * game.t.pulse_radius);
    this.pulseRing.position.set(p.x, p.y + hp + 0.8, p.z);

    // wind leaves
    const windy = game.windActiveTicks > 0 || game.windWarning;
    this.leaves.visible = windy;
    if (windy) {
      const a = (game.windDirDeg * Math.PI) / 180, wx = Math.cos(a), wz = Math.sin(a);
      for (let i = 0; i < 150; i++) {
        const ph = (time * 0.4 + i * 0.137) % 1;
        const off = (i * 7.31) % 1, h = (i * 3.17) % 1;
        this.leafPos[i * 3] = p.x + (ph - 0.5) * 30 * wx + (off - 0.5) * 20 * wz;
        this.leafPos[i * 3 + 1] = p.y + hp + 0.5 + h * 4 + Math.sin(time * 5 + i) * 0.3;
        this.leafPos[i * 3 + 2] = p.z + (ph - 0.5) * 30 * wz - (off - 0.5) * 20 * wx;
      }
      (this.leaves.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    this.env.update(time);
    this.land?.update(time);
    this.vegetation?.update(time);
    this.fauna?.update(dt, time, [{ x: p.x, z: p.z, w: 1 }, ...game.shades.map((s) => ({ x: s.x, z: s.z, w: 1.5 }))]);

    if (camOverride) {
      this.camera.position.set(...camOverride);
      this.camera.lookAt(0, 0, 0);
    } else {
      // third-person camera behind Mây, looking along (sin yaw, cos yaw)
      const th = (camYawDeg * Math.PI) / 180;
      const fx = Math.sin(th), fz = Math.cos(th);
      const camY = Math.max(p.y + hp, -2);
      const target = new THREE.Vector3(p.x - fx * 9, camY + 5.5, p.z - fz * 9);
      this.camera.position.lerp(target, 1 - Math.exp(-dt * 8));
      this.camera.lookAt(p.x + fx * 2, camY + 1.2, p.z + fz * 2);
      if (this.shakeT > 0 && !this.reduceMotion) {
        this.shakeT = Math.max(0, this.shakeT - dt);
        const a = this.shakeT * 0.9;
        this.camera.position.x += (Math.random() - 0.5) * a;
        this.camera.position.y += (Math.random() - 0.5) * a;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
