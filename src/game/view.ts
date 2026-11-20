// Three.js view of a Game. Reads simulation state every frame; never writes to it.
import * as THREE from "three";
import type { Game } from "../sim/game";
import { STD } from "../sim/tuning";
import { PALETTE, PALETTE_CB, makeBigLantern, makeCharm, makeDrifter, makeMay, makeMote, makeShade } from "./models";
import { Scenery } from "./decor/scenery";
import { Environment } from "./decor/environment";
import { Vegetation } from "./decor/vegetation";
import { Fauna } from "./decor/fauna";
import { buildTerrain } from "./decor/terrain";

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  readonly quality: "high" | "low";
  /** Ticket-03 colour-blind palette setting */
  colorblind = false;
  private scenery: Scenery | null = null;
  private hemi: THREE.HemisphereLight;
  private env: Environment;
  private may = makeMay();
  private world = new THREE.Group();
  private vegetation: Vegetation | null = null;
  private fauna: Fauna | null = null;
  private lanterns: ReturnType<typeof makeBigLantern>[] = [];
  private charms: THREE.Group[] = [];
  private shades = new Map<string, ReturnType<typeof makeShade>>();
  private motes = new Map<string, THREE.Group>();
  private drifters = new Map<string, ReturnType<typeof makeDrifter>>();
  private pulseRing: THREE.Mesh;
  private pulseT = 1;
  private leaves: THREE.Points;
  private leafPos: Float32Array;

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
    const moon = new THREE.DirectionalLight(0xc8d4ff, 1.1); // cool moonlight keeps greens green
    moon.position.copy(this.env.moonDir).multiplyScalar(90);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = sc.bottom = -70; sc.right = sc.top = 70; sc.far = 300;
    this.scene.add(moon, moon.target, this.world, this.may.root);

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

  /** Build the night's world (terrain, plants, animals, lanterns, charms). */
  load(game: Game): void {
    this.scene.remove(this.world);
    this.world.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.world = new THREE.Group();
    this.scene.add(this.world);
    for (const v of this.shades.values()) this.scene.remove(v.root);
    for (const v of this.motes.values()) this.scene.remove(v);
    for (const v of this.drifters.values()) this.scene.remove(v.root);
    this.shades.clear(); this.motes.clear(); this.drifters.clear();

    const map = game.map;
    this.world.add(buildTerrain(map));
    // trees are solid in the windowed game, so keep them off every gameplay spot
    const avoid = [
      ...game.lanterns.map((l) => ({ x: l.x, z: l.z, r: 3 })),
      ...map.pads.map((p) => ({ x: p.x, z: p.z, r: 2 })),
      ...map.charms.map((c) => ({ x: c.pos[0], z: c.pos[2], r: 2 })),
      ...map.moteSpawns.map(([x, , z]) => ({ x, z, r: 0.5 })),
      ...map.shadeSpawns.map(([x, , z]) => ({ x, z, r: 0.5 })),
      { x: map.start[0], z: map.start[2], r: 4 },
    ];
    // creative: streams on the island + distant mountains in the cloud sea (render-only)
    this.scenery = new Scenery(map, avoid);
    this.world.add(this.scenery.group);
    avoid.push(...this.scenery.streamSpots);
    this.vegetation = new Vegetation({ map, avoid, quality: this.quality });
    // creative extra: Mây cannot walk through trunks (trunk + body radius); never set in headless
    game.extraSolids = this.vegetation.trees.map((t) => ({ x: t.x, z: t.z, r: t.r + 0.35 }));
    this.fauna = new Fauna(this.vegetation.trees, map);
    this.world.add(this.vegetation.group, this.fauna.group);
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

  /** screen position of a world point (for the off-screen lantern arrow) */
  project(x: number, y: number, z: number): { x: number; y: number; behind: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 };
  }

  render(game: Game, camYawDeg: number, time: number, dt: number): void {
    const p = game.player;
    const visible = game.playerActive;
    this.may.root.visible = visible && !(p.invulnTicks > 0 && Math.floor(time * 12) % 2 === 0);
    this.may.root.position.set(p.x, p.y, p.z);
    this.may.root.rotation.y = Math.atan2(p.faceX, p.faceZ);
    this.may.lamp.intensity = 2 + p.carried * 0.6;

    // lanterns + ambient light grows with progress: 0.15 + 0.55 x lit/total (Ticket-02)
    let lit = 0;
    game.lanterns.forEach((l, i) => {
      const v = this.lanterns[i];
      const cost = l.everLit ? game.t.relight_cost : game.t.lantern_cost;
      const fill = l.lit ? 1 : l.deposited / cost;
      const fuel = l.fuelU / 60;
      // fuel < 30: lamp and fuel bar blink slowly (1 Hz)
      const low = l.lit && l.fuelU < game.lowFuelU;
      const blinkOff = low && Math.floor(time * 2) % 2 === 1;
      const mat = v.lamp.material as THREE.MeshStandardMaterial;
      mat.color.setHex(l.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
      mat.emissiveIntensity = l.lit ? (blinkOff ? 0.3 : 1.6 + Math.sin(time * 3 + i) * 0.15) : fill * 0.8;
      v.core.visible = l.lit && !blinkOff;
      v.light.intensity = l.lit ? (blinkOff ? 40 : 140) * (0.4 + 0.6 * Math.min(1, fuel / 50)) : fill * 20;
      // out: squashed 20% + torn paper (distinguishable without colour)
      v.lamp.scale.y = l.lit ? 1 : 0.8;
      v.tear.visible = !l.lit;
      v.fuelBg.visible = l.lit && !blinkOff;
      v.fuelBar.scale.x = Math.max(0.001, fuel / game.t.fuel_max);
      (v.fuelBar.material as THREE.MeshBasicMaterial).color.setHex(low ? (this.colorblind ? 0xffffff : PALETTE.danger) : PALETTE.lanternLit);
      v.fuelBg.quaternion.copy(this.camera.quaternion);
      if (l.lit) lit++;
    });
    const k = lit / game.lanterns.length;
    this.hemi.intensity = 0.15 + 0.55 * k;
    (this.scene.fog as THREE.FogExp2).density = 0.012 - k * 0.005;

    game.charms.forEach((c, i) => {
      const v = this.charms[i];
      v.visible = c.available;
      v.rotation.y = time * 2;
      v.position.y = c.y + 1 + Math.sin(time * 2 + i) * 0.15;
    });

    // shades
    const seen = new Set<string>();
    for (const s of game.shades) {
      seen.add(s.id);
      let v = this.shades.get(s.id);
      if (!v) { v = makeShade(); this.shades.set(s.id, v); this.scene.add(v.root); }
      const stunned = s.state === "stunned";
      v.root.position.set(s.x, s.y + Math.sin(time * 4 + s.x) * 0.12, s.z);
      v.root.lookAt(p.x, s.y, p.z);
      const grow = s.state === "spawning" ? 1 - s.stateTicks / STD.shadeSpawningTicks : 1;
      v.root.scale.setScalar(Math.max(0.05, grow) * (1 + Math.sin(time * 6 + s.z) * 0.06));
      (v.body.material as THREE.MeshStandardMaterial).color.setHex(stunned ? PALETTE.shadeStunned : PALETTE.shadeBody);
      v.rim.visible = !stunned;
      const rimHex = this.colorblind ? PALETTE_CB.shadeRim : PALETTE.shadeRim;
      (v.rim.material as THREE.MeshBasicMaterial).color.setHex(rimHex);
      v.eyeMat.color.setHex(this.colorblind ? PALETTE_CB.shadeRim : 0xc9a7ff);
      if (s.state === "drain") v.root.rotation.x = Math.sin(time * 10) * 0.1; // sucking wobble
    }
    for (const [id, v] of this.shades) if (!seen.has(id)) { this.scene.remove(v.root); this.shades.delete(id); }

    // motes (random + dropped; dropped ones blink when about to expire)
    const seenM = new Set<string>();
    for (const m of game.motes) {
      seenM.add(m.id);
      let v = this.motes.get(m.id);
      if (!v) { v = makeMote(); this.motes.set(m.id, v); this.scene.add(v); }
      v.position.set(m.x, m.y + 0.8 + Math.sin(time * 2.5 + m.x * 3) * 0.2, m.z);
      v.visible = !(m.ttl !== null && m.ttl < 120 && Math.floor(time * 8) % 2 === 0);
    }
    for (const [id, v] of this.motes) if (!seenM.has(id)) { this.scene.remove(v); this.motes.delete(id); }

    // drifters: rippling ribbons
    const seenD = new Set<string>();
    for (const d of game.drifters) {
      seenD.add(d.id);
      let v = this.drifters.get(d.id);
      if (!v) { v = makeDrifter(); this.drifters.set(d.id, v); this.scene.add(v.root); }
      v.root.position.set(d.x, d.y, d.z);
      const dir = d.state === "flee" ? Math.atan2(d.x - p.x, d.z - p.z) : Math.atan2(p.x - d.x, p.z - d.z);
      v.root.rotation.y = dir;
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
    this.pulseRing.position.set(p.x, p.y + 0.8, p.z);

    // wind leaves
    const windy = game.windActiveTicks > 0 || game.windWarning;
    this.leaves.visible = windy;
    if (windy) {
      const a = (game.windDirDeg * Math.PI) / 180, wx = Math.cos(a), wz = Math.sin(a);
      for (let i = 0; i < 150; i++) {
        const ph = (time * 0.4 + i * 0.137) % 1;
        const off = (i * 7.31) % 1, h = (i * 3.17) % 1;
        this.leafPos[i * 3] = p.x + (ph - 0.5) * 30 * wx + (off - 0.5) * 20 * wz;
        this.leafPos[i * 3 + 1] = p.y + 0.5 + h * 4 + Math.sin(time * 5 + i) * 0.3;
        this.leafPos[i * 3 + 2] = p.z + (ph - 0.5) * 30 * wz - (off - 0.5) * 20 * wx;
      }
      (this.leaves.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    this.env.update(time);
    this.scenery?.update(time);
    this.vegetation?.update(time);
    this.fauna?.update(dt, time, [{ x: p.x, z: p.z, w: 1 }, ...game.shades.map((s) => ({ x: s.x, z: s.z, w: 1.5 }))]);

    // third-person camera behind Mây, looking along (sin yaw, cos yaw)
    const th = (camYawDeg * Math.PI) / 180;
    const fx = Math.sin(th), fz = Math.cos(th);
    const target = new THREE.Vector3(p.x - fx * 9, Math.max(p.y, -2) + 5.5, p.z - fz * 9);
    this.camera.position.lerp(target, 1 - Math.exp(-dt * 8));
    this.camera.lookAt(p.x + fx * 2, Math.max(p.y, -2) + 1.2, p.z + fz * 2);

    this.renderer.render(this.scene, this.camera);
  }
}
