// Partes que dão a cara de cada personagem: cabeça e extras (cauda, asas,
// chapéu, túnica...). O corpo base (pernas, tronco, braços, arco) é comum.
import * as THREE from 'three';
import type { BodyStyle, CharacterPalette } from '../data/characters';

export interface PartsContext {
  palette: CharacterPalette;
  head: THREE.Group;
  torso: THREE.Group;
  hips: THREE.Group;
  mats: {
    primary: THREE.Material;
    secondary: THREE.Material;
    skin: THREE.Material;
    accent: THREE.Material;
    eyes: THREE.Material;
    leather: THREE.Material;
  };
  mat: (color: number, extra?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial;
  place: (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => THREE.Mesh;
}

/** Partes animadas devolvidas para o CharacterView. */
export interface StyleParts {
  /** Asas (coruja): abrem no ar. */
  wings: THREE.Group[];
  /** Cauda: balança ao andar. */
  tail: THREE.Group | null;
}

const sphere = (r: number, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);

function neck(c: PartsContext): void {
  c.place(new THREE.CylinderGeometry(0.055, 0.065, 0.08, 10), c.mats.skin, 0, 0.02, 0, c.head);
}

function eyesPair(c: PartsContext, y: number, z: number, spread: number, r = 0.018): void {
  c.place(sphere(r, 8, 6), c.mats.eyes, -spread, y, z, c.head);
  c.place(sphere(r, 8, 6), c.mats.eyes, spread, y, z, c.head);
}

function humanFace(c: PartsContext): void {
  neck(c);
  const face = c.place(sphere(0.135, 20, 16), c.mats.skin, 0, 0.17, -0.01, c.head);
  face.scale.set(0.92, 1.08, 1);
  c.place(sphere(0.03, 8, 6), c.mats.skin, 0, 0.15, -0.14, c.head); // nariz
  eyesPair(c, 0.19, -0.122, 0.05);
}

/** Cauda feita de segmentos, presa ao quadril. */
function tail(c: PartsContext, segments: { r: number; len: number; m: THREE.Material }[], droop: number): THREE.Group {
  const root = new THREE.Group();
  root.position.set(0, 0.0, 0.14);
  root.rotation.x = droop;
  let parent: THREE.Object3D = root;
  for (const s of segments) {
    const seg = new THREE.Group();
    c.place(new THREE.CapsuleGeometry(s.r, s.len, 4, 10).rotateX(Math.PI / 2).translate(0, 0, s.len / 2 + s.r), s.m, 0, 0, 0, seg);
    parent.add(seg);
    seg.position.z = parent === root ? 0 : s.len * 0.9;
    seg.rotation.x = 0.15;
    parent = seg;
  }
  c.hips.add(root);
  return root;
}

export function buildStyle(style: BodyStyle, c: PartsContext): StyleParts {
  const parts: StyleParts = { wings: [], tail: null };
  const { mats, place, head } = c;

  switch (style) {
    case 'human': {
      humanFace(c);
      // Capuz: meia esfera maior por trás/acima, com a ponta caída nas costas.
      const hood = place(new THREE.SphereGeometry(0.17, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.primary, 0, 0.17, 0.025, head);
      hood.rotation.x = -0.55;
      const tip = place(new THREE.ConeGeometry(0.08, 0.22, 10), mats.primary, 0, 0.12, 0.17, head);
      tip.rotation.x = 2.3;
      break;
    }
    case 'elf': {
      humanFace(c);
      const hair = c.mat(0xe8d38a, { roughness: 0.6 });
      const cap = place(new THREE.SphereGeometry(0.145, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.19, 0.01, head);
      cap.rotation.x = -0.35;
      place(new THREE.CapsuleGeometry(0.1, 0.32, 4, 12), hair, 0, 0.0, 0.1, head); // cabelo longo nas costas
      for (const s of [-1, 1]) {
        const ear = place(new THREE.ConeGeometry(0.03, 0.16, 8), mats.skin, s * 0.13, 0.2, 0.02, head);
        ear.rotation.z = s * -1.1;
      }
      const circlet = place(new THREE.TorusGeometry(0.135, 0.012, 6, 24), mats.accent, 0, 0.24, -0.01, head);
      circlet.rotation.x = Math.PI / 2 - 0.25;
      break;
    }
    case 'mage': {
      humanFace(c);
      const beard = place(new THREE.ConeGeometry(0.07, 0.18, 10), c.mat(0xd8d4cc), 0, 0.06, -0.1, head);
      beard.rotation.x = Math.PI;
      place(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 24), mats.primary, 0, 0.26, 0, head); // aba do chapéu
      const hat = place(new THREE.ConeGeometry(0.15, 0.42, 16), mats.primary, 0, 0.47, 0.02, head);
      hat.rotation.x = -0.15;
      place(new THREE.TorusGeometry(0.145, 0.015, 6, 20).rotateX(Math.PI / 2), mats.accent, 0, 0.29, 0, head);
      // Túnica: saia em cone presa ao quadril.
      place(new THREE.CylinderGeometry(0.2, 0.34, 0.6, 18, 1, true), mats.primary, 0, -0.27, 0, c.hips);
      break;
    }
    case 'lizard': {
      neck(c);
      const skull = place(sphere(0.13), mats.skin, 0, 0.17, 0.0, head);
      skull.scale.set(0.95, 0.9, 1.1);
      const snout = place(new THREE.CapsuleGeometry(0.075, 0.16, 4, 12).rotateX(Math.PI / 2), mats.skin, 0, 0.13, -0.16, head);
      snout.scale.set(1, 0.75, 1);
      for (const s of [-1, 1]) place(sphere(0.026, 8, 6), mats.eyes, s * 0.09, 0.21, -0.07, head);
      // Crista de espinhos na cabeça e nas costas.
      for (let i = 0; i < 4; i++) {
        place(new THREE.ConeGeometry(0.025, 0.09, 6), mats.accent, 0, 0.29 - i * 0.04, 0.04 + i * 0.05, head);
        place(new THREE.ConeGeometry(0.035, 0.11, 6).rotateX(-0.6), mats.accent, 0, 0.55 - i * 0.12, 0.17, c.torso);
      }
      parts.tail = tail(c, [{ r: 0.08, len: 0.25, m: mats.skin }, { r: 0.06, len: 0.22, m: mats.skin }, { r: 0.035, len: 0.2, m: mats.skin }], 0.9);
      break;
    }
    case 'robot': {
      neck(c);
      place(new THREE.BoxGeometry(0.25, 0.24, 0.24), mats.skin, 0, 0.18, 0, head);
      place(new THREE.BoxGeometry(0.21, 0.07, 0.02), c.mat(0x111418, { roughness: 0.2, metalness: 0.5 }), 0, 0.19, -0.121, head); // visor
      eyesPair(c, 0.19, -0.13, 0.05, 0.022);
      place(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), mats.secondary, 0.07, 0.36, 0, head); // antena
      place(sphere(0.025, 10, 8), c.mat(c.palette.accent, { emissive: c.palette.accent, emissiveIntensity: 1.5 }), 0.07, 0.44, 0, head);
      for (const s of [-1, 1]) place(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12).rotateZ(Math.PI / 2), mats.secondary, s * 0.135, 0.18, 0, head);
      place(new THREE.BoxGeometry(0.22, 0.14, 0.02), c.mat(c.palette.accent, { emissive: c.palette.accent, emissiveIntensity: 0.4 }), 0, 0.38, -0.155, c.torso); // painel no peito
      break;
    }
    case 'fox': {
      neck(c);
      place(sphere(0.135), mats.skin, 0, 0.17, 0, head);
      const muzzle = place(new THREE.ConeGeometry(0.075, 0.18, 14).rotateX(-Math.PI / 2), mats.accent, 0, 0.12, -0.17, head);
      muzzle.scale.set(1, 0.8, 1);
      place(sphere(0.022, 8, 6), c.mat(0x111111, { roughness: 0.3 }), 0, 0.125, -0.265, head); // nariz
      eyesPair(c, 0.2, -0.11, 0.055, 0.02);
      for (const s of [-1, 1]) {
        const ear = place(new THREE.ConeGeometry(0.06, 0.17, 4), mats.skin, s * 0.085, 0.33, 0.01, head);
        ear.rotation.z = s * -0.2;
        place(new THREE.ConeGeometry(0.03, 0.06, 4), c.mat(0x2a1a10), s * 0.1, 0.4, 0.01, head);
      }
      // Cauda peluda com ponta branca.
      const root = new THREE.Group();
      root.position.set(0, -0.02, 0.15);
      root.rotation.x = 1.1;
      place(new THREE.CapsuleGeometry(0.1, 0.38, 6, 12).rotateX(Math.PI / 2).translate(0, 0, 0.29), mats.skin, 0, 0, 0, root);
      place(sphere(0.105), mats.accent, 0, 0, 0.6, root);
      c.hips.add(root);
      parts.tail = root;
      break;
    }
    case 'owl': {
      neck(c);
      place(sphere(0.165), mats.skin, 0, 0.18, 0, head);
      const disc = place(sphere(0.13), mats.accent, 0, 0.18, -0.06, head); // disco facial
      disc.scale.set(1.1, 0.95, 0.55);
      for (const s of [-1, 1]) {
        place(sphere(0.045, 12, 10), mats.eyes, s * 0.06, 0.2, -0.125, head);
        place(sphere(0.022, 8, 6), c.mat(0x111111, { roughness: 0.2 }), s * 0.06, 0.2, -0.165, head);
        const tuft = place(new THREE.ConeGeometry(0.03, 0.12, 6), mats.skin, s * 0.1, 0.34, 0.0, head);
        tuft.rotation.z = s * -0.4;
      }
      const beak = place(new THREE.ConeGeometry(0.025, 0.07, 6).rotateX(-Math.PI / 2 - 0.6), c.mat(0xd8a630), 0, 0.15, -0.16, head);
      beak.scale.set(1, 1, 1);
      // Asas dobradas nas costas (abrem no pulo).
      for (const s of [-1, 1]) {
        const wing = new THREE.Group();
        wing.position.set(s * 0.14, 0.5, 0.13);
        const feather = place(sphere(1, 14, 10), mats.secondary, s * 0.05, -0.22, 0.02, wing);
        feather.scale.set(0.09, 0.3, 0.05);
        c.torso.add(wing);
        parts.wings.push(wing);
      }
      break;
    }
  }
  return parts;
}
