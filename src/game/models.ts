// Low-poly models built from Three.js primitives (no external assets -> nothing to license).
// Colours follow the Ticket-02 standard palette (PALETTE). Models are render-only.
import * as THREE from "three";

/** Ticket-02 standard palette (each RGB channel must stay within 10%). */
export const PALETTE = {
  sky: 0x0e1430, fog: 0x1b2350,
  grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, cloudSea: 0x12384a,
  lanternLit: 0xffb347, lanternCore: 0xffe9b0, lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shadeBody: 0x120a1a, shadeRim: 0x7a3cff, shadeStunned: 0x3a3450,
  mayShirt: 0xe8e2d0, mayScarf: 0xc8102e, charm: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8,
  danger: 0xff5a5f, uiText: 0xf5f1e6,
};

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra });

/** Mây: little lantern keeper, light shirt, red scarf, conical hat (nón lá) with a small lantern. */
export function makeMay(): { root: THREE.Group; lamp: THREE.PointLight } {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.9, 8), std(PALETTE.mayShirt));
  body.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 6, 12), std(PALETTE.mayScarf));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.0;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.04), std(PALETTE.mayScarf));
  tail.position.set(0.12, 0.85, -0.27); tail.rotation.z = 0.3;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), std(0xf1c9a5));
  head.position.y = 1.25;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 14), std(0xd8c08a));
  hat.position.y = 1.58;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35), std(0x222222));
  string.position.set(0, 1.27, 0.55);
  const lampMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6),
    new THREE.MeshStandardMaterial({ color: PALETTE.lanternLit, emissive: PALETTE.lanternLit, emissiveIntensity: 2 }));
  lampMesh.position.set(0, 1.05, 0.55);
  const lamp = new THREE.PointLight(0xffe2b8, 6, 10, 1.6); // softer, whiter glow on the ground around Mây
  lamp.position.copy(lampMesh.position);
  for (const m of [body, head, hat]) m.castShadow = true;
  root.add(body, scarf, tail, head, hat, string, lampMesh, lamp);
  return { root, lamp };
}

/** Big Lantern: stone base, wooden pole and a paper lamp: grey when off, warm orange with a light core when lit. */
export function makeBigLantern(): { root: THREE.Group; lamp: THREE.Mesh; core: THREE.Mesh; light: THREE.PointLight } {
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.4, 8), std(0x4a4a5e));
  base.position.y = 0.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.2, 6), std(PALETTE.wood));
  pole.position.y = 1.9;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.0, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff, emissive: PALETTE.lanternLit, emissiveIntensity: 0, flatShading: true }));
  lamp.position.y = 3.8;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore }));
  core.position.y = 3.8;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 8), std(PALETTE.wood));
  cap.position.y = 4.5;
  const light = new THREE.PointLight(PALETTE.lanternLit, 0, 24, 1.4);
  light.position.y = 3.8;
  for (const m of [base, pole, cap]) m.castShadow = true;
  root.add(base, pole, lamp, core, cap, light);
  return { root, lamp, core, light };
}

/** Bóng Mực: a wobbling blob of ink with a violet rim and eyes. */
export function makeShade(): { root: THREE.Group; body: THREE.Mesh; rim: THREE.Mesh } {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1),
    new THREE.MeshStandardMaterial({ color: PALETTE.shadeBody, roughness: 0.6, flatShading: true }));
  const rim = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 1),
    new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.85 }));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc9a7ff });
  for (const sx of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), eyeMat);
    eye.position.set(sx, 0.15, 0.62);
    body.add(eye);
  }
  root.add(rim, body);
  return { root, body, rim };
}

/** Firefly: bright core + soft halo sprite. */
export function makeMote(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: PALETTE.moteCore })));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.35, depthWrite: false }));
  g.add(halo);
  return g;
}

/** Gió Lạc: a grey-blue silk ribbon (a twisted strip that ripples). */
export function makeDrifter(): { root: THREE.Group; ribbon: THREE.Mesh; base: Float32Array } {
  const geo = new THREE.PlaneGeometry(2.4, 0.35, 24, 1);
  geo.rotateY(Math.PI / 2);
  const ribbon = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: PALETTE.drifter, emissive: PALETTE.drifter, emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true, opacity: 0.9,
  }));
  const root = new THREE.Group();
  root.add(ribbon);
  return { root, ribbon, base: Float32Array.from(geo.attributes.position.array as Float32Array) };
}

/** Bùa Gió: red talisman with a gold border, floating and spinning. */
export function makeCharm(): THREE.Group {
  const g = new THREE.Group();
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.04), new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: PALETTE.gold, emissiveIntensity: 0.4 }));
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.67, 0.06), new THREE.MeshStandardMaterial({ color: PALETTE.charm, emissive: PALETTE.charm, emissiveIntensity: 0.35 }));
  g.add(border, paper);
  return g;
}

/** Jump pad: glowing wooden disc. */
export function makePad(r: number): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.15, 20), std(PALETTE.wood));
  disc.position.y = 0.07;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.75, 0.06, 6, 24), new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.16;
  g.add(disc, ring);
  return g;
}
