// Ambient animals (rabbits, squirrels, deer). Render-only: they READ the game state (player, shades) to flee,
// but never change it, so headless output is unaffected. Behaviour: wander -> graze -> wander; flee when threatened.
import * as THREE from "three";
import { makeRng } from "../../sim/rng";
import type { NightMap } from "../../sim/maps";
import type { Spot } from "./vegetation";

type Kind = "rabbit" | "squirrel" | "deer";

const mat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const ball = (r: number, m: THREE.Material) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);

interface Rig { root: THREE.Group; body: THREE.Object3D; head: THREE.Object3D; legs: THREE.Object3D[]; tail?: THREE.Object3D }

function makeRabbit(): Rig {
  const fur = mat(0xb9a58c), white = mat(0xf2ede4), pink = mat(0xd9a0a0);
  const root = new THREE.Group(), body = new THREE.Group();
  const torso = ball(0.22, fur); torso.scale.set(1, 0.85, 1.3); torso.position.y = 0.24;
  const head = new THREE.Group(); head.position.set(0, 0.42, 0.24);
  const skull = ball(0.13, fur);
  for (const sx of [-0.05, 0.05]) {
    const ear = box(0.05, 0.24, 0.025, fur); ear.position.set(sx, 0.17, -0.02); ear.rotation.z = sx * 2;
    const inner = box(0.025, 0.18, 0.01, pink); inner.position.z = 0.015; ear.add(inner);
    head.add(ear);
  }
  head.add(skull);
  const tail = ball(0.07, white); tail.position.set(0, 0.28, -0.3);
  const legs = [-1, 1].map((sx) => { const l = box(0.07, 0.1, 0.22, fur); l.position.set(sx * 0.13, 0.05, -0.08); return l; });
  body.add(torso, head, tail, ...legs);
  root.add(body);
  return { root, body, head, legs, tail };
}

function makeSquirrel(): Rig {
  const fur = mat(0xa0522d), belly = mat(0xe8c9a0);
  const root = new THREE.Group(), body = new THREE.Group();
  const torso = ball(0.13, fur); torso.scale.set(0.9, 1, 1.3); torso.position.y = 0.16;
  const chest = ball(0.08, belly); chest.position.set(0, 0.16, 0.1);
  const head = new THREE.Group(); head.position.set(0, 0.3, 0.14);
  head.add(ball(0.09, fur));
  for (const sx of [-0.04, 0.04]) { const ear = box(0.03, 0.07, 0.02, fur); ear.position.set(sx, 0.09, 0); head.add(ear); }
  // big bushy tail made of 4 growing balls curving up
  const tail = new THREE.Group(); tail.position.set(0, 0.16, -0.16);
  [[0, 0.02, -0.06, 0.07], [0, 0.14, -0.13, 0.09], [0, 0.3, -0.12, 0.1], [0, 0.42, -0.04, 0.09]].forEach(([x, y, z, r]) => {
    const b = ball(r, fur); b.position.set(x, y, z); tail.add(b);
  });
  const legs = [-1, 1].map((sx) => { const l = box(0.05, 0.08, 0.12, fur); l.position.set(sx * 0.08, 0.04, -0.02); return l; });
  body.add(torso, chest, head, tail, ...legs);
  root.add(body);
  return { root, body, head, legs, tail };
}

function makeDeer(): Rig {
  const fur = mat(0x9b6a43), light = mat(0xe3cfb0), horn = mat(0x6b5440);
  const root = new THREE.Group(), body = new THREE.Group();
  const torso = box(0.5, 0.45, 1.1, fur); torso.position.y = 1.0;
  const rump = box(0.32, 0.22, 0.05, light); rump.position.set(0, 1.05, -0.56);
  const head = new THREE.Group(); head.position.set(0, 1.25, 0.5); // pivot at neck base
  const neck = box(0.2, 0.55, 0.22, fur); neck.position.set(0, 0.25, 0.08); neck.rotation.x = 0.35;
  const skull = box(0.22, 0.22, 0.42, fur); skull.position.set(0, 0.52, 0.28);
  const snout = box(0.12, 0.1, 0.1, mat(0x2b211a)); snout.position.set(0, 0.48, 0.5);
  head.add(neck, skull, snout);
  for (const sx of [-1, 1]) {
    const a = box(0.04, 0.35, 0.04, horn); a.position.set(sx * 0.1, 0.78, 0.2); a.rotation.z = -sx * 0.4; head.add(a);
    const b = box(0.03, 0.18, 0.03, horn); b.position.set(sx * 0.16, 0.86, 0.3); b.rotation.x = 0.6; head.add(b);
  }
  const legs = [[-0.17, 0.42], [0.17, 0.42], [-0.17, -0.42], [0.17, -0.42]].map(([x, z]) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.8, z);
    const leg = box(0.09, 0.8, 0.09, fur); leg.position.y = -0.4; pivot.add(leg);
    return pivot;
  });
  body.add(torso, rump, head, ...legs);
  root.add(body);
  return { root, body, head, legs };
}

const SPECS: Record<Kind, { make: () => Rig; walk: number; run: number; fear: number; hop: boolean }> = {
  rabbit: { make: makeRabbit, walk: 0.8, run: 5.5, fear: 5, hop: true },
  squirrel: { make: makeSquirrel, walk: 1.2, run: 6.5, fear: 4, hop: true },
  deer: { make: makeDeer, walk: 1.0, run: 7, fear: 8, hop: false },
};

interface Animal { kind: Kind; rig: Rig; x: number; z: number; heading: number; tx: number; tz: number; state: "wander" | "graze" | "flee"; timer: number; phase: number }

export class Fauna {
  private animals: Animal[] = [];
  private rng = makeRng(99);
  readonly group = new THREE.Group();

  constructor(private trees: Spot[], private map: NightMap) {
    const scene = this.group;
    const counts: [Kind, number][] = [["rabbit", 7], ["squirrel", 5], ["deer", 3]];
    for (const [kind, n] of counts) {
      for (let i = 0; i < n; i++) {
        const rig = SPECS[kind].make();
        const [x, z] = this.pickTarget(kind);
        const a: Animal = { kind, rig, x, z, heading: this.rng() * 6.28, tx: x, tz: z, state: "graze", timer: this.rng() * 4, phase: this.rng() * 10 };
        rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
        scene.add(rig.root);
        this.animals.push(a);
      }
    }
  }

  private pickTarget(kind: Kind): [number, number] {
    if (kind === "squirrel" && this.trees.length) {
      const t = this.trees[Math.floor(this.rng() * this.trees.length)];
      const a = this.rng() * 6.28;
      return [t.x + Math.cos(a) * 1.2, t.z + Math.sin(a) * 1.2];
    }
    const b = this.map.bounds;
    for (let i = 0; i < 40; i++) { // a random point on ground level 0, away from cliff edges
      const x = b.minX + this.rng() * (b.maxX - b.minX), z = b.minZ + this.rng() * (b.maxZ - b.minZ);
      if (this.map.ground(x, z) === 0 && this.map.ground(x + 2, z) === 0 && this.map.ground(x - 2, z) === 0 && this.map.ground(x, z + 2) === 0 && this.map.ground(x, z - 2) === 0) return [x, z];
    }
    return [this.map.start[0], this.map.start[2] + 5];
  }

  /** animals stay on ground level 0 and never step over an edge */
  private walkable(x: number, z: number): boolean {
    return this.map.ground(x, z) === 0 && !this.map.solid(x, z, 0);
  }

  /** threats: positions of Mây and the ink shades (read from the simulation). */
  update(dt: number, time: number, threats: { x: number; z: number; w: number }[]): void {
    for (const a of this.animals) {
      const spec = SPECS[a.kind];
      // nearest threat (shades count double)
      let fx = 0, fz = 0, scared = false;
      for (const t of threats) {
        const d = Math.hypot(a.x - t.x, a.z - t.z);
        if (d < spec.fear * t.w && d > 1e-3) { fx += (a.x - t.x) / d; fz += (a.z - t.z) / d; scared = true; }
      }
      if (scared) {
        a.state = "flee"; a.timer = 1.5;
        a.tx = a.x + fx * 6; a.tz = a.z + fz * 6;
      } else if ((a.timer -= dt) <= 0) {
        if (a.state === "graze") { a.state = "wander"; [a.tx, a.tz] = this.pickTarget(a.kind); a.timer = 12; }
        else { a.state = "graze"; a.timer = 2 + this.rng() * 5; }
      }

      // move toward target
      let speed = 0;
      if (a.state !== "graze") {
        const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
        if (d < 0.3 && a.state === "wander") { a.state = "graze"; a.timer = 2 + this.rng() * 5; }
        else if (d > 1e-3) {
          speed = a.state === "flee" ? spec.run : spec.walk;
          const want = Math.atan2(dx, dz);
          let diff = want - a.heading; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          a.heading += diff * Math.min(1, dt * 6);
          const nx = a.x + Math.sin(a.heading) * speed * dt, nz = a.z + Math.cos(a.heading) * speed * dt;
          if (this.walkable(nx, nz) && this.walkable(nx + Math.sin(a.heading), nz + Math.cos(a.heading))) { a.x = nx; a.z = nz; }
          else { [a.tx, a.tz] = this.pickTarget(a.kind); if (a.state === "flee") a.state = "wander"; }
        }
      }

      // animate
      const rig = a.rig;
      rig.root.position.set(a.x, 0, a.z);
      rig.root.rotation.y = a.heading;
      const cyc = (a.phase += dt * (2 + speed * 2.2));
      if (spec.hop) {
        rig.body.position.y = speed > 0 ? Math.abs(Math.sin(cyc)) * (a.state === "flee" ? 0.35 : 0.15) : 0;
        rig.legs.forEach((l) => (l.rotation.x = speed > 0 ? Math.sin(cyc * 2) * 0.6 : 0));
      } else {
        // diagonal gait: front-left with back-right, front-right with back-left
        rig.legs.forEach((l, i) => (l.rotation.x = speed > 0 ? Math.sin(cyc + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 : 0));
        rig.body.position.y = speed > 0 ? Math.abs(Math.sin(cyc)) * 0.04 : 0;
      }
      // grazing: head bobs down to the grass; alert when fleeing
      const grazeTarget = a.state === "graze" ? (a.kind === "deer" ? 1.1 : 0.5) + Math.sin(time * 3 + a.phase) * 0.12 : a.state === "flee" ? -0.25 : 0;
      rig.head.rotation.x += (grazeTarget - rig.head.rotation.x) * Math.min(1, dt * 4);
      if (rig.tail) rig.tail.rotation.x = Math.sin(time * (a.kind === "squirrel" ? 6 : 10) + a.phase) * 0.15;
    }
  }
}
