// Partes que dão a cara de cada personagem: cabeça e extras (cauda, asas,
// chapéu, túnica...). O corpo base (pernas, tronco, braços, arco) é comum.
import * as THREE from 'three';
import type { BodyStyle, CharacterPalette } from '../data/characters';
import { astronautSuit, bearSkullHead, foxHead, foxTail, goldbirdHead, lizardHead, owlChest, owlHead, owlWing, robotHead, sharkHead } from './creatureHeads';

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
  /** Luzes que pulsam (olhos/antena do robô, joia da elfa). */
  pulse?: THREE.MeshStandardMaterial[];
  /** Partes que giram devagar (orbes do mago). */
  spin?: THREE.Object3D[];
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
      // Cabeça esculpida (focinho, olhos de camaleão, escamas): ver creatureHeads.ts.
      lizardHead(c);
      // Crista de espinhos nas costas.
      for (let i = 0; i < 4; i++) {
        place(new THREE.ConeGeometry(0.035, 0.11, 6).rotateX(-0.6), mats.accent, 0, 0.55 - i * 0.12, 0.17, c.torso);
      }
      parts.tail = tail(c, [{ r: 0.08, len: 0.25, m: mats.skin }, { r: 0.06, len: 0.22, m: mats.skin }, { r: 0.035, len: 0.2, m: mats.skin }], 0.9);
      break;
    }
    case 'robot': {
      // Cobalto: cabeça de robô com tela, olhos de luz, fones e antena (ver creatureHeads.ts).
      parts.pulse = robotHead(c);
      break;
    }
    case 'fox': {
      // Fenna: cabeça esculpida e cauda bem peluda (ver creatureHeads.ts).
      foxHead(c);
      parts.tail = foxTail(c);
      // Traje metálico de astronauta (corpo do modelo recolorido + anel, painel e mochila).
      parts.pulse = astronautSuit(c);
      break;
    }
    case 'owl': {
      // Noctua: cabeça esculpida (disco facial, olhos enormes, tufos) e asas de penas (ver creatureHeads.ts).
      owlHead(c);
      owlChest(c);
      for (const s of [-1, 1]) parts.wings.push(owlWing(c, s));
      break;
    }
    case 'goldbird': {
      // Áurion: cabeça esculpida (olhos de alien, bico curvo, antenas, crista): ver creatureHeads.ts.
      goldbirdHead(c);
      const gold = c.mat(c.palette.skin, { metalness: 0.85, roughness: 0.25, emissive: 0x8a5a00, emissiveIntensity: 0.25 });
      // Asas douradas nas costas (abrem no pulo).
      for (const s of [-1, 1]) {
        const wing = new THREE.Group();
        wing.position.set(s * 0.14, 0.5, 0.14);
        for (let k = 0; k < 3; k++) {
          const feather = place(sphere(1, 12, 8), gold, s * (0.05 + k * 0.04), -0.18 - k * 0.05, 0.02, wing);
          feather.scale.set(0.07, 0.3 - k * 0.04, 0.035);
          feather.rotation.z = s * (0.15 + k * 0.2);
        }
        c.torso.add(wing);
        parts.wings.push(wing);
      }
      break;
    }
    case 'skelbear': {
      // Caveira de urso esculpida (órbitas com brasas, mandíbula, caninos): ver creatureHeads.ts.
      bearSkullHead(c);
      const bone = c.mat(c.palette.skin, { roughness: 0.75 });
      // Costelas no peito e espinha nas costas.
      for (let i = 0; i < 4; i++) {
        const rib = place(new THREE.TorusGeometry(0.17 - i * 0.012, 0.012, 5, 16, Math.PI), bone, 0, 0.44 - i * 0.07, -0.05, c.torso);
        rib.rotation.set(Math.PI / 2, 0, Math.PI);
        rib.scale.set(1.15, 1, 1);
      }
      for (let i = 0; i < 5; i++) place(new THREE.ConeGeometry(0.025, 0.08, 5).rotateX(-0.9), bone, 0, 0.52 - i * 0.09, 0.17, c.torso);
      parts.tail = tail(c, [{ r: 0.03, len: 0.09, m: bone }, { r: 0.025, len: 0.07, m: bone }], 1.2);
      break;
    }
    case 'shark': {
      // Cabeça de tubarão esculpida (contra-sombreamento, boca com dentes, guelras): ver creatureHeads.ts.
      sharkHead(c);
      const skin = c.mat(c.palette.skin, { roughness: 0.4, metalness: 0.1 });
      // Barbatana dorsal nas costas e cauda de peixe.
      const fin = place(new THREE.ConeGeometry(0.1, 0.36, 3).scale(0.25, 1, 1), skin, 0, 0.62, 0.2, c.torso);
      fin.rotation.x = -0.55;
      const root = new THREE.Group();
      root.position.set(0, 0.02, 0.16);
      root.rotation.x = 1.0;
      place(new THREE.CapsuleGeometry(0.07, 0.25, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.2), skin, 0, 0, 0, root);
      for (const s of [-1, 1]) {
        const lobe = place(new THREE.ConeGeometry(0.07, 0.3, 3).scale(0.25, 1, 1), skin, 0, s * 0.1, 0.4, root);
        lobe.rotation.x = s * 0.8;
      }
      c.hips.add(root);
      parts.tail = root;
      break;
    }
  }
  return parts;
}
