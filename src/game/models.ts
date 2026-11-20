// Low-poly models built from Three.js primitives (no external assets -> nothing to license).
// EXTENDING: add a new factory here (e.g. makeNpc, makeShadeVariant) and use it from view.ts.
// Models are render-only: they never change game rules or headless output.
import * as THREE from "three";

export const COLORS = {
  lantern: 0xffb347,
  core: 0xffe9b0,
  mote: 0xffe58a,
  shade: 0x2a1048,
  shadeGlow: 0x7a3cff,
  grass: 0x3d5a4a,
  rock: 0x4a4a5e,
  cloth: 0x4f7cac,
  hat: 0xd8c08a,
  skin: 0xf1c9a5,
};

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra });

/** Mây: little lantern keeper with a conical hat (nón lá) and a small lantern hanging from it. */
export function makeMay(): { root: THREE.Group; lamp: THREE.PointLight } {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.9, 8), std(COLORS.cloth));
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), std(COLORS.skin));
  head.position.y = 1.22;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 14), std(COLORS.hat));
  hat.position.y = 1.55;
  // small lantern hanging from the hat brim, in front of Mây
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35), std(0x222222));
  string.position.set(0, 1.25, 0.55);
  const lampMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 6),
    new THREE.MeshStandardMaterial({ color: COLORS.lantern, emissive: COLORS.lantern, emissiveIntensity: 2 }),
  );
  lampMesh.position.set(0, 1.03, 0.55);
  const lamp = new THREE.PointLight(COLORS.lantern, 6, 9, 1.6);
  lamp.position.copy(lampMesh.position);
  for (const m of [body, head, hat]) m.castShadow = true;
  root.add(body, head, hat, string, lampMesh, lamp);
  return { root, lamp };
}

/** Big Lantern: stone base, pole and a paper lamp that glows once lit. */
export function makeBigLantern(): { root: THREE.Group; lamp: THREE.Mesh; light: THREE.PointLight } {
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.4, 8), std(COLORS.rock));
  base.position.y = 0.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.2, 6), std(0x5b3a24));
  pole.position.y = 1.9;
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.45, 1.0, 8),
    new THREE.MeshStandardMaterial({ color: 0x553322, emissive: COLORS.lantern, emissiveIntensity: 0 }),
  );
  lamp.position.y = 3.8;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 8), std(0x3a2a20));
  cap.position.y = 4.5;
  const light = new THREE.PointLight(COLORS.lantern, 0, 22, 1.4);
  light.position.y = 3.8;
  for (const m of [base, pole, cap]) m.castShadow = true;
  root.add(base, pole, lamp, cap, light);
  return { root, lamp, light };
}

/** Bóng Mực: a wobbling blob of ink with violet eyes. */
export function makeShade(): { root: THREE.Group; body: THREE.Mesh } {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7, 1),
    new THREE.MeshStandardMaterial({ color: COLORS.shade, emissive: COLORS.shadeGlow, emissiveIntensity: 0.35, flatShading: true }),
  );
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc9a7ff });
  for (const sx of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), eyeMat);
    eye.position.set(sx, 0.15, 0.62);
    body.add(eye);
  }
  root.add(body);
  return { root, body };
}

export function makeMote(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({ color: COLORS.mote }),
  );
}
