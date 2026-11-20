// Three.js view of a Game. Reads simulation state every frame; never writes to it.
import * as THREE from "three";
import type { Game } from "../sim/game";
import { WORLD } from "../sim/tuning";
import { COLORS, makeBigLantern, makeMay, makeMote, makeShade } from "./models";

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  private hemi: THREE.HemisphereLight;
  private may = makeMay();
  private lanterns: ReturnType<typeof makeBigLantern>[] = [];
  private shades = new Map<string, ReturnType<typeof makeShade>>();
  private motes = new Map<string, THREE.Mesh>();
  private pulseRing: THREE.Mesh;
  private pulseT = 1;
  private fogDark = new THREE.Color(0x1a1238);
  private fogWarm = new THREE.Color(0x3a3060);

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);
    addEventListener("resize", () => this.resize());
    this.resize();

    this.scene.background = new THREE.Color(0x0a1030);
    this.scene.fog = new THREE.FogExp2(this.fogDark.getHex(), 0.022);
    this.hemi = new THREE.HemisphereLight(0x6070c0, 0x201030, 0.35);
    this.scene.add(this.hemi);
    const moon = new THREE.DirectionalLight(0x9fb0ff, 0.35);
    moon.position.set(-30, 50, 20);
    moon.castShadow = true;
    this.scene.add(moon);

    // island + sea of clouds
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD.islandRadius, WORLD.islandRadius * 0.55, 8, 40),
      new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1, flatShading: true }),
    );
    island.position.y = -4;
    island.receiveShadow = true;
    this.scene.add(island);
    const clouds = new THREE.Mesh(
      new THREE.CircleGeometry(300, 32),
      new THREE.MeshStandardMaterial({ color: 0x2a2f5a, roughness: 1 }),
    );
    clouds.rotation.x = -Math.PI / 2;
    clouds.position.y = -9;
    this.scene.add(clouds);

    this.scene.add(this.may.root);
    this.pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 48),
      new THREE.MeshBasicMaterial({ color: COLORS.core, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.pulseRing.position.y = 0.05;
    this.scene.add(this.pulseRing);
  }

  resize(): void {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /** Rebuilds per-run objects (lanterns) after a restart. */
  bind(game: Game): void {
    for (const l of this.lanterns) this.scene.remove(l.root);
    this.lanterns = game.lanterns.map(() => makeBigLantern());
    for (const l of this.lanterns) this.scene.add(l.root);
    for (const s of this.shades.values()) this.scene.remove(s.root);
    this.shades.clear();
    for (const m of this.motes.values()) this.scene.remove(m);
    this.motes.clear();
  }

  pulse(): void {
    this.pulseT = 0;
  }

  render(game: Game, camYawDeg: number, time: number, dt: number): void {
    const p = game.player;
    // player
    this.may.root.position.set(p.x, p.y, p.z);
    this.may.root.rotation.y = Math.atan2(p.faceX, p.faceZ);
    this.may.root.visible = !(p.invulnTicks > 0 && Math.floor(time * 12) % 2 === 0);
    this.may.lamp.intensity = 2 + p.carried * 0.8;

    // lanterns: the island warms up as lanterns are lit
    let lit = 0;
    game.lanterns.forEach((l, i) => {
      const v = this.lanterns[i];
      v.root.position.set(l.x, 0, l.z);
      const fill = l.lit ? 1 : l.deposited / game.t.lantern_cost;
      (v.lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = l.lit ? 2.2 + Math.sin(time * 3 + i) * 0.2 : fill * 0.6;
      v.light.intensity = l.lit ? 40 : fill * 6;
      if (l.lit) lit++;
    });
    const k = lit / game.lanterns.length;
    this.hemi.intensity = 0.35 + k * 0.9;
    (this.scene.fog as THREE.FogExp2).color.copy(this.fogDark).lerp(this.fogWarm, k);
    (this.scene.fog as THREE.FogExp2).density = 0.022 - k * 0.012;

    // shades
    const seen = new Set<string>();
    for (const s of game.shades) {
      seen.add(s.id);
      let v = this.shades.get(s.id);
      if (!v) { v = makeShade(); this.shades.set(s.id, v); this.scene.add(v.root); }
      const stunned = s.stunTicks > 0;
      v.root.position.set(s.x, WORLD.shadeHoverY + Math.sin(time * 4 + s.x) * 0.12, s.z);
      v.root.lookAt(p.x, WORLD.shadeHoverY, p.z);
      v.body.scale.setScalar(1 + Math.sin(time * 6 + s.z) * 0.06);
      (v.body.material as THREE.MeshStandardMaterial).emissiveIntensity = stunned ? 0.05 : 0.35;
      (v.body.material as THREE.MeshStandardMaterial).color.setHex(stunned ? 0x555577 : COLORS.shade);
    }
    for (const [id, v] of this.shades) if (!seen.has(id)) { this.scene.remove(v.root); this.shades.delete(id); }

    // motes (hover height is display only)
    const seenM = new Set<string>();
    for (const m of game.motes) {
      seenM.add(m.id);
      let v = this.motes.get(m.id);
      if (!v) { v = makeMote(); this.motes.set(m.id, v); this.scene.add(v); }
      v.position.set(m.x, 0.8 + Math.sin(time * 2.5 + m.x * 3) * 0.2, m.z);
    }
    for (const [id, v] of this.motes) if (!seenM.has(id)) { this.scene.remove(v); this.motes.delete(id); }

    // pulse ring
    this.pulseT = Math.min(1, this.pulseT + dt * 2.5);
    const ringMat = this.pulseRing.material as THREE.MeshBasicMaterial;
    ringMat.opacity = (1 - this.pulseT) * 0.8;
    this.pulseRing.scale.setScalar(0.5 + this.pulseT * game.t.pulse_radius);
    this.pulseRing.position.set(p.x, 0.05, p.z);

    // third-person camera behind Mây, looking along (sin yaw, cos yaw)
    const th = (camYawDeg * Math.PI) / 180;
    const fx = Math.sin(th), fz = Math.cos(th);
    const want = new THREE.Vector3(p.x - fx * 9, p.y + 5.5, p.z - fz * 9);
    this.camera.position.lerp(want, 1 - Math.exp(-dt * 8));
    this.camera.lookAt(p.x + fx * 2, p.y + 1.2, p.z + fz * 2);

    this.renderer.render(this.scene, this.camera);
  }
}
