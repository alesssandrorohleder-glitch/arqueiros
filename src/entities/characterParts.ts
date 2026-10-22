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
    case 'goldbird': {
      // Alien-pássaro dourado: cabeça redonda, olhos enormes brilhando, bico, crista e antenas.
      const gold = c.mat(c.palette.skin, { metalness: 0.85, roughness: 0.25, emissive: 0x8a5a00, emissiveIntensity: 0.25 });
      const glow = c.mat(c.palette.eyes, { emissive: c.palette.eyes, emissiveIntensity: 2.2, roughness: 0.2 });
      neck(c);
      const skull = place(sphere(0.16), gold, 0, 0.19, 0, head);
      skull.scale.set(1, 1.1, 1);
      for (const s of [-1, 1]) {
        const eye = place(sphere(0.06, 14, 10), glow, s * 0.075, 0.21, -0.12, head);
        eye.scale.set(1, 1.35, 0.6);
        eye.rotation.z = s * 0.35;
        // Antena com bolinha brilhante.
        const ant = place(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), gold, s * 0.07, 0.42, 0.02, head);
        ant.rotation.z = -s * 0.35;
        place(sphere(0.025, 10, 8), glow, s * 0.11, 0.51, 0.02, head);
      }
      place(new THREE.ConeGeometry(0.04, 0.16, 8).rotateX(-Math.PI / 2 - 0.25), c.mat(0xff9a20, { metalness: 0.6, roughness: 0.3 }), 0, 0.13, -0.2, head);
      // Crista de penas.
      for (let i = 0; i < 4; i++) {
        const f = place(new THREE.ConeGeometry(0.03, 0.2 - i * 0.025, 6), c.mat(c.palette.accent, { emissive: c.palette.accent, emissiveIntensity: 0.6 }), 0, 0.36 - i * 0.01, 0.02 + i * 0.06, head);
        f.rotation.x = 0.4 + i * 0.25;
      }
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
      // Caveira de urso: crânio largo, órbitas escuras com brasas, orelhas redondas, focinho com presas.
      const bone = c.mat(c.palette.skin, { roughness: 0.75 });
      const dark = c.mat(0x14100e, { roughness: 1 });
      const ember = c.mat(c.palette.eyes, { emissive: c.palette.eyes, emissiveIntensity: 2.5 });
      place(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 6), bone, 0, 0.02, 0, head); // vértebra
      const skull = place(sphere(0.17), bone, 0, 0.2, 0.01, head);
      skull.scale.set(1.15, 0.95, 1.05);
      const snout = place(new THREE.BoxGeometry(0.15, 0.1, 0.17), bone, 0, 0.13, -0.17, head);
      snout.rotation.x = 0.1;
      place(sphere(0.03, 8, 6), dark, 0, 0.17, -0.26, head); // nariz (buraco)
      for (const s of [-1, 1]) {
        place(sphere(0.045, 10, 8), dark, s * 0.07, 0.23, -0.13, head); // órbita
        place(sphere(0.026, 10, 8), ember, s * 0.07, 0.23, -0.18, head); // brasa no olho
        // Orelha redonda de urso (osso).
        const ear = place(sphere(0.065, 12, 8, ), bone, s * 0.14, 0.33, 0.03, head);
        ear.scale.set(1, 1, 0.45);
        place(sphere(0.035, 10, 8), dark, s * 0.14, 0.33, 0.005, head);
        place(new THREE.ConeGeometry(0.014, 0.06, 5).rotateX(Math.PI), bone, s * 0.05, 0.05, -0.22, head); // presa
      }
      // Mandíbula separada (caveira aberta) com dentes.
      const jaw = place(new THREE.BoxGeometry(0.13, 0.04, 0.15), bone, 0, 0.04, -0.15, head);
      jaw.rotation.x = 0.25;
      for (let i = 0; i < 4; i++) place(new THREE.BoxGeometry(0.014, 0.025, 0.014), bone, -0.03 + i * 0.02, 0.075, -0.21, head);
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
      // Cabeça de tubarão: focinho comprido e pontudo, barriga clara, boca cheia de dentes, guelras e barbatanas.
      const skin = c.mat(c.palette.skin, { roughness: 0.4, metalness: 0.1 });
      const belly = c.mat(c.palette.accent, { roughness: 0.5 });
      const black = c.mat(0x050608, { roughness: 0.1 });
      const gum = c.mat(0x8a2a34, { roughness: 0.7 });
      neck(c);
      const headShape = place(sphere(0.16, 20, 14), skin, 0, 0.19, -0.06, head);
      headShape.scale.set(0.95, 0.9, 1.55);
      // Focinho pontudo para a frente e barbatana no alto da cabeça.
      const nose = place(new THREE.ConeGeometry(0.1, 0.2, 14).rotateX(-Math.PI / 2), skin, 0, 0.21, -0.29, head);
      nose.scale.set(1, 0.7, 1);
      const headFin = place(new THREE.ConeGeometry(0.09, 0.26, 3).scale(0.22, 1, 1), skin, 0, 0.38, 0.04, head);
      headFin.rotation.x = -0.5;
      const jawBase = place(sphere(0.13, 18, 12), belly, 0, 0.11, -0.08, head);
      jawBase.scale.set(0.9, 0.55, 1.4);
      // Boca aberta com fileira de dentes.
      const mouth = place(new THREE.BoxGeometry(0.17, 0.05, 0.12), gum, 0, 0.12, -0.22, head);
      mouth.rotation.x = 0.1;
      for (let i = 0; i < 7; i++) {
        const x = -0.075 + i * 0.025;
        place(new THREE.ConeGeometry(0.011, 0.04, 4).rotateX(Math.PI), belly, x, 0.155, -0.26 + Math.abs(x) * 0.6, head);
        place(new THREE.ConeGeometry(0.011, 0.035, 4), belly, x, 0.095, -0.25 + Math.abs(x) * 0.6, head);
      }
      for (const s of [-1, 1]) {
        place(sphere(0.022, 10, 8), black, s * 0.12, 0.22, -0.12, head); // olho lateral
        for (let g = 0; g < 3; g++) {
          const gill = place(new THREE.BoxGeometry(0.006, 0.07, 0.012), c.mat(0x4a6578), s * 0.135, 0.15, 0.04 + g * 0.035, head);
          gill.rotation.z = s * 0.2;
        }
      }
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
