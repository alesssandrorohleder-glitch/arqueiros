// Peças exclusivas de cada skin (CharacterModel.variant): além das cores, cada skin
// ganha um detalhe próprio em 3D (coroa, lua, asas de fada, chamas, cristais...).
// Tudo é enfeite preso à cabeça ou ao tronco: não muda tamanho, ossos nem hitbox.
// Coordenadas: as cabeças dos personagens têm o centro perto de (0, 0.2, 0) no
// encaixe da cabeça, com a frente para −Z; o peito fica perto de (0, 0.45, −0.22) no tronco.
import * as THREE from 'three';
import type { PartsContext } from './characterParts';

type V3 = [number, number, number];

function add(c: PartsContext, geo: THREE.BufferGeometry, m: THREE.Material, at: V3, parent: THREE.Object3D, rot: V3 = [0, 0, 0]): THREE.Mesh {
  const me = c.place(geo, m, at[0], at[1], at[2], parent);
  me.rotation.set(rot[0], rot[1], rot[2]);
  return me;
}

const gold = (c: PartsContext) => c.mat(0xffcc44, { metalness: 0.9, roughness: 0.25 });
const silver = (c: PartsContext) => c.mat(0xe4eaf4, { metalness: 0.9, roughness: 0.2 });
const glow = (c: PartsContext, color: number, k = 1.8) => c.mat(color, { emissive: color, emissiveIntensity: k, roughness: 0.2 });

/** Estrela de 5 pontas em relevo. */
function starGeo(r: number, depth = 0.01): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: depth * 0.3, bevelSegments: 1 }).translate(0, 0, -depth / 2);
}

/** Lua crescente em relevo (de frente para −Z). */
function crescentGeo(r: number, depth = 0.012): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, Math.PI * 0.15, Math.PI * 1.85, false);
  s.absarc(r * 0.42, 0, r * 0.78, Math.PI * 1.7, Math.PI * 0.3, true);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: depth * 0.25, bevelSegments: 1, curveSegments: 16 }).translate(0, 0, -depth / 2);
}

/** Folha (elipse achatada com ponta). */
function leafGeo(len: number, w: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 10, 8).scale(w, len, w * 0.18);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / len;
    p.setX(i, p.getX(i) * (1 - Math.max(0, y) * 0.6));
    p.setZ(i, p.getZ(i) + y * y * w * 0.4);
  }
  g.computeVertexNormals();
  return g.translate(0, len, 0);
}

/** Coroa: aro com pontas e joias. */
function crown(c: PartsContext, at: V3, r: number, metal: THREE.Material, gem: THREE.Material, points = 6, tilt = -0.12): void {
  const g = new THREE.Group();
  g.position.set(...at);
  g.rotation.x = tilt;
  c.head.add(g);
  add(c, new THREE.CylinderGeometry(r, r * 0.96, r * 0.32, 28, 1, true), metal, [0, 0, 0], g);
  add(c, new THREE.TorusGeometry(r, r * 0.06, 6, 28).rotateX(Math.PI / 2), metal, [0, -r * 0.16, 0], g);
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + Math.PI / 2;
    add(c, new THREE.ConeGeometry(r * 0.16, r * 0.42, 6), metal, [Math.cos(a) * r, r * 0.36, Math.sin(a) * r], g);
    add(c, new THREE.SphereGeometry(r * 0.07, 8, 6), metal, [Math.cos(a) * r, r * 0.6, Math.sin(a) * r], g);
  }
  add(c, new THREE.OctahedronGeometry(r * 0.13).scale(0.8, 1.2, 0.6), gem, [0, 0.0, -r * 1.02], g);
}

/** Cristais pontudos saindo de um ponto (gelo, obsidiana, magia). */
function crystals(c: PartsContext, parent: THREE.Object3D, at: V3, m: THREE.Material, n: number, size: number, spread = 0.5): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = size * (0.7 + 0.5 * ((i * 37) % 10) / 10);
    const k = add(c, new THREE.OctahedronGeometry(1, 0).scale(size * 0.28, len, size * 0.28), m, [at[0] + Math.cos(a) * size * 0.35, at[1] + len * 0.6, at[2] + Math.sin(a) * size * 0.35], parent);
    k.rotation.set(Math.sin(a) * spread, 0, -Math.cos(a) * spread);
  }
}

/** Asa de fada: membrana fininha (elipse 3D achatada) com borda e brilho. */
function fairyWing(c: PartsContext, side: number, upper: boolean): void {
  const g = new THREE.Group();
  g.position.set(side * 0.06, upper ? 0.55 : 0.42, 0.22);
  g.rotation.set(0.25, side * 0.55, side * (upper ? -0.75 : -2.1));
  c.torso.add(g);
  const len = upper ? 0.32 : 0.22;
  const mem = c.mat(0xffd8f0, { transparent: true, opacity: 0.55, emissive: 0xff8ad8, emissiveIntensity: 0.6, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  add(c, new THREE.SphereGeometry(1, 16, 10).scale(len * 0.42, len, 0.006).translate(0, len, 0), mem, [0, 0, 0], g);
  add(c, new THREE.TorusGeometry(1, 0.03, 4, 24).scale(len * 0.42, len, 1).translate(0, len, 0), c.mat(0xffe6a0, { metalness: 0.7, roughness: 0.3 }), [0, 0, 0], g);
}

/** Chamas: cones emissivos subindo (fogo mágico). */
function flames(c: PartsContext, parent: THREE.Object3D, at: V3, scale: number, colors: [number, number]): THREE.MeshStandardMaterial[] {
  const outer = glow(c, colors[0], 2.2);
  const inner = glow(c, colors[1], 2.6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const h = scale * (0.7 + (i % 3) * 0.2);
    add(c, new THREE.ConeGeometry(scale * 0.22, h, 8).translate(0, h / 2, 0), outer, [at[0] + Math.cos(a) * scale * 0.18, at[1], at[2] + Math.sin(a) * scale * 0.18], parent, [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]);
  }
  add(c, new THREE.ConeGeometry(scale * 0.2, scale * 1.1, 8).translate(0, scale * 0.55, 0), inner, at, parent);
  return [outer, inner];
}

/** Lenço/cachecol em volta do pescoço. */
function scarf(c: PartsContext, color: number, tail = true): void {
  const m = c.mat(color, { roughness: 0.9 });
  const ring = add(c, new THREE.TorusGeometry(0.15, 0.05, 10, 24).rotateX(Math.PI / 2), m, [0, 0.66, -0.01], c.torso);
  ring.scale.set(1.15, 1, 0.95);
  if (tail) add(c, new THREE.BoxGeometry(0.08, 0.22, 0.03), m, [0.09, 0.53, -0.19], c.torso, [0.1, 0, 0.25]);
}

/** Peças exclusivas da skin. Devolve materiais que pulsam (luzes). */
export function skinExtras(c: PartsContext, variant: string): THREE.MeshStandardMaterial[] {
  const lights: THREE.MeshStandardMaterial[] = [];
  const h = c.head;
  const t = c.torso;
  switch (variant) {
    // ---------------------------------------------------------------- Kael
    case 'paladin': {
      // Asas de ouro presas ao capuz e pena branca; broche de luz azul.
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) add(c, leafGeo(0.08 - k * 0.014, 0.026), gold(c), [s * 0.23, 0.25 + k * 0.01, 0.02 + k * 0.03], h, [0.3, 0, -s * (1.0 + k * 0.25)]);
      }
      const l = glow(c, 0x6ad0ff, 2);
      lights.push(l);
      add(c, new THREE.OctahedronGeometry(0.03).scale(0.8, 1.2, 0.5), l, [0, 0.5, -0.28], t);
      break;
    }
    case 'champion':
      crown(c, [0, 0.36, 0.01], 0.215, gold(c), glow(c, 0xc02030, 1.2), 5, -0.25);
      break;
    case 'moon': {
      const l = glow(c, 0xd8e0ff, 1.6);
      lights.push(l);
      add(c, crescentGeo(0.05), l, [0, 0.3, -0.25], h, [-0.3, 0, 0.3]);
      // Lâminas de prata no cinto.
      for (const s of [-1, 1]) add(c, new THREE.ConeGeometry(0.018, 0.2, 4).scale(1, 1, 0.3), silver(c), [s * 0.2, 0.0, -0.12], t, [0, 0, Math.PI + s * 0.3]);
      break;
    }
    // ---------------------------------------------------------------- Sylwen
    case 'autumn': {
      // Grinalda de folhas de outono no cabelo.
      const tones = [0xd8501a, 0xe8902a, 0xb83a12, 0xf0b040];
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9;
        add(c, leafGeo(0.07, 0.034), c.mat(tones[i % 4], { roughness: 0.7 }), [Math.cos(a) * 0.235, 0.33, Math.sin(a) * 0.215 + 0.01], h, [-0.4, -a, 0.4]);
      }
      break;
    }
    case 'lunar': {
      const l = glow(c, 0xe8eeff, 1.4);
      lights.push(l);
      add(c, crescentGeo(0.045), l, [0, 0.38, -0.17], h, [-0.35, 0, Math.PI / 2]);
      for (const s of [-1, 1]) add(c, starGeo(0.018, 0.006), silver(c), [s * 0.205, 0.13, 0.0], h, [0, s * 1.4, 0]);
      break;
    }
    case 'fairy': {
      for (const s of [-1, 1]) {
        fairyWing(c, s, true);
        fairyWing(c, s, false);
      }
      // Coroa de flores.
      const petal = c.mat(0xffb8d8, { roughness: 0.6 });
      const core = c.mat(0xffe060, { emissive: 0xffc020, emissiveIntensity: 0.6 });
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * 0.9 + (i / 5) * Math.PI * 0.8;
        const p: V3 = [Math.cos(a) * 0.235, 0.34, Math.sin(a) * 0.215 + 0.01];
        for (let k = 0; k < 5; k++) add(c, new THREE.SphereGeometry(0.022, 8, 6).scale(1.4, 0.45, 0.9).translate(0.022, 0, 0), petal, p, h, [0, (k / 5) * Math.PI * 2, 0]);
        add(c, new THREE.SphereGeometry(0.014, 8, 6), core, p, h);
      }
      break;
    }
    // ---------------------------------------------------------------- Eldrin
    case 'fire':
      lights.push(...flames(c, h, [0, 0.37, 0.04], 0.075, [0xff5a10, 0xffd040]));
      break;
    case 'ice': {
      const ice = c.mat(0xcfefff, { transparent: true, opacity: 0.85, emissive: 0x4ab0ff, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.1 });
      lights.push(ice);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        add(c, new THREE.ConeGeometry(0.014, 0.07, 5), ice, [Math.cos(a) * 0.27, 0.06, Math.sin(a) * 0.27], h, [Math.PI, 0, 0]);
      }
      crystals(c, h, [0, 0.36, 0.04], ice, 4, 0.05, 0.6);
      break;
    }
    case 'celestial': {
      const l = glow(c, 0xffe080, 2);
      lights.push(l);
      add(c, crescentGeo(0.045), gold(c), [0.0, 0.26, -0.15], h, [-0.35, 0, 0.4]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        add(c, starGeo(0.02, 0.006), l, [Math.cos(a) * 0.3, 0.16 + (i % 2) * 0.1, Math.sin(a) * 0.3], h, [0, -a, 0]);
      }
      break;
    }
    // ---------------------------------------------------------------- Cobalto
    case 'gold-bot': {
      crown(c, [0, 0.43, 0.0], 0.11, gold(c), glow(c, 0xff2020, 1.6), 4, 0);
      for (const s of [-1, 1]) add(c, new THREE.BoxGeometry(0.06, 0.02, 0.14), gold(c), [s * 0.33, 0.66, 0], t, [0, 0, -s * 0.4]);
      break;
    }
    case 'camo': {
      // Rede de camuflagem com folhas no alto da cabeça e bolsa de munição.
      const leaf = c.mat(0x4a6a28, { roughness: 0.8 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        add(c, leafGeo(0.06, 0.026), leaf, [Math.cos(a) * 0.12, 0.42, Math.sin(a) * 0.12], h, [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0]);
      }
      add(c, new THREE.BoxGeometry(0.12, 0.08, 0.06), c.mat(0x3a3020, { roughness: 0.9 }), [0.14, 0.05, -0.2], t);
      break;
    }
    case 'neon': {
      const pink = glow(c, 0xff2a8a, 2.2);
      const cyan = glow(c, 0x3ae8ff, 2.2);
      lights.push(pink, cyan);
      add(c, new THREE.TorusGeometry(0.2, 0.008, 6, 36).rotateX(Math.PI / 2), pink, [0, 0.36, 0.0], h);
      add(c, new THREE.TorusGeometry(0.2, 0.008, 6, 36).rotateX(Math.PI / 2), cyan, [0, 0.1, 0.0], h);
      add(c, new THREE.BoxGeometry(0.22, 0.012, 0.012), cyan, [0, 0.5, -0.24], t);
      break;
    }
    // ---------------------------------------------------------------- Fenna
    case 'arctic': {
      // Óculos de neve na testa e cachecol fofo.
      const strap = c.mat(0x2a3a4a, { roughness: 0.6 });
      const lens = c.mat(0x8ad8ff, { metalness: 0.6, roughness: 0.05, emissive: 0x2a8acc, emissiveIntensity: 0.4 });
      for (const s of [-1, 1]) {
        add(c, new THREE.TorusGeometry(0.035, 0.012, 8, 16), strap, [s * 0.055, 0.33, -0.15], h, [-0.6, 0, 0]);
        add(c, new THREE.SphereGeometry(0.032, 12, 10).scale(1, 1, 0.4), lens, [s * 0.055, 0.33, -0.152], h, [-0.6, 0, 0]);
      }
      scarf(c, 0x6ab8e8);
      break;
    }
    case 'mars': {
      // Antena de rádio e emblema de missão no peito.
      add(c, new THREE.CylinderGeometry(0.004, 0.006, 0.22, 5), silver(c), [0.12, 0.45, 0.06], h, [0, 0, -0.3]);
      const l = glow(c, 0xff4a2a, 2.4);
      lights.push(l);
      add(c, new THREE.SphereGeometry(0.014, 8, 6), l, [0.153, 0.555, 0.06], h);
      add(c, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20).rotateX(Math.PI / 2), c.mat(0xe8e8e8, { roughness: 0.5 }), [-0.1, 0.52, -0.24], t);
      add(c, new THREE.SphereGeometry(0.022, 12, 10).scale(1, 1, 0.3), c.mat(0xc8502a), [-0.1, 0.52, -0.25], t);
      break;
    }
    case 'galaxy': {
      const l = glow(c, 0xffd040, 2.2);
      lights.push(l);
      for (const s of [-1, 1]) add(c, starGeo(0.018, 0.006), l, [s * 0.1, 0.42, -0.05], h, [0, 0, s * 0.3]);
      const ring = add(c, new THREE.TorusGeometry(0.24, 0.006, 6, 40).rotateX(Math.PI / 2), glow(c, 0xb48cff, 1.6), [0, 0.22, 0.02], h);
      ring.rotation.z = 0.35;
      break;
    }
    // ---------------------------------------------------------------- Noctua
    case 'snow': {
      const ice = c.mat(0xe8f6ff, { emissive: 0x8ad0ff, emissiveIntensity: 0.4, roughness: 0.1 });
      lights.push(ice);
      crystals(c, h, [0, 0.36, 0.0], ice, 5, 0.045, 0.7);
      scarf(c, 0xc8d8ec);
      break;
    }
    case 'royal':
      crown(c, [0, 0.4, 0.02], 0.1, gold(c), glow(c, 0xff6a1a, 1.4), 5, -0.15);
      break;
    case 'owl-celestial': {
      const l = glow(c, 0xffe080, 2);
      lights.push(l);
      add(c, starGeo(0.035, 0.01), gold(c), [0, 0.4, -0.12], h, [-0.4, 0, 0]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(c, new THREE.SphereGeometry(0.008, 8, 6), l, [Math.cos(a) * 0.26, 0.42 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.26], h);
      }
      break;
    }
    // ---------------------------------------------------------------- Áurion
    case 'cosmic': {
      // Anel planetário inclinado em volta da cabeça e uma luazinha.
      const ring = add(c, new THREE.TorusGeometry(0.27, 0.01, 6, 48).rotateX(Math.PI / 2), glow(c, 0x3affc8, 1.6), [0, 0.24, 0], h);
      ring.rotation.set(0.35, 0, 0.25);
      add(c, new THREE.SphereGeometry(0.025, 14, 10), c.mat(0x7a5ad8, { emissive: 0x4a2ab8, emissiveIntensity: 0.6 }), [0.27, 0.3, -0.05], h);
      break;
    }
    case 'silver': {
      // Viseira cromada sobre os olhos.
      const visor = add(c, new THREE.SphereGeometry(0.2, 24, 12, -Math.PI * 0.4, Math.PI * 0.8, Math.PI * 0.38, Math.PI * 0.18), c.mat(0xd8f0ff, { metalness: 0.95, roughness: 0.05, transparent: true, opacity: 0.55 }), [0, 0.2, 0.0], h);
      visor.rotation.y = Math.PI;
      break;
    }
    case 'ruby': {
      const ruby = c.mat(0xd0102a, { emissive: 0x8a0010, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.3 });
      lights.push(ruby);
      add(c, new THREE.OctahedronGeometry(0.035).scale(0.8, 1.2, 0.6), ruby, [0, 0.36, -0.15], h, [-0.4, 0, 0]);
      add(c, new THREE.TorusGeometry(0.04, 0.007, 6, 20), gold(c), [0, 0.36, -0.148], h, [-0.4, 0, 0]);
      break;
    }
    // ---------------------------------------------------------------- Ossurso
    case 'obsidian': {
      const soul = glow(c, 0x5aff8a, 2.2);
      lights.push(soul);
      crystals(c, c.torso, [0, 0.62, 0.16], c.mat(0x14141a, { metalness: 0.4, roughness: 0.15 }), 5, 0.07, 0.6);
      lights.push(...flames(c, h, [0, 0.38, 0.05], 0.06, [0x2aff6a, 0xcaffda]));
      break;
    }
    case 'ancient': {
      // Musgo e cogumelos crescendo no crânio.
      const moss = c.mat(0x4a6a2a, { roughness: 1 });
      for (let i = 0; i < 6; i++) add(c, new THREE.SphereGeometry(0.035, 8, 6).scale(1, 0.4, 1), moss, [Math.sin(i * 2.1) * 0.1, 0.38, Math.cos(i * 2.1) * 0.08 + 0.04], h);
      const cap = c.mat(0xc84a2a, { roughness: 0.6 });
      const stem = c.mat(0xe8dcc0, { roughness: 0.8 });
      for (const [x, z, s] of [[0.08, 0.06, 1], [-0.06, 0.1, 0.7], [0.02, 0.12, 0.55]] as const) {
        add(c, new THREE.CylinderGeometry(0.008 * s, 0.01 * s, 0.05 * s, 6), stem, [x, 0.4 + 0.025 * s, z], h);
        add(c, new THREE.SphereGeometry(0.03 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cap, [x, 0.4 + 0.05 * s, z], h);
      }
      break;
    }
    case 'ice-king': {
      const ice = c.mat(0xcfefff, { transparent: true, opacity: 0.85, emissive: 0x4ab0ff, emissiveIntensity: 0.6, roughness: 0.08 });
      lights.push(ice);
      crown(c, [0, 0.4, 0.02], 0.13, ice, glow(c, 0xe8f8ff, 2), 7, -0.1);
      break;
    }
    // ---------------------------------------------------------------- Squalo
    case 'abyss': {
      // Isca luminosa de peixe-das-profundezas presa na testa.
      const stalk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.36, -0.08), new THREE.Vector3(0, 0.5, -0.14), new THREE.Vector3(0, 0.5, -0.3), new THREE.Vector3(0, 0.44, -0.36)]);
      add(c, new THREE.TubeGeometry(stalk, 16, 0.007, 6), c.mat(0x1a3a4a, { roughness: 0.5 }), [0, 0, 0], h);
      const l = glow(c, 0x3ae8ff, 2.8);
      lights.push(l);
      add(c, new THREE.SphereGeometry(0.025, 14, 10), l, [0, 0.42, -0.37], h);
      break;
    }
    case 'tiger': {
      // Colar de dentes de tubarão.
      const cord = c.mat(0x3a2a1a, { roughness: 0.9 });
      const tooth = c.mat(0xf2ecd8, { roughness: 0.4 });
      add(c, new THREE.TorusGeometry(0.16, 0.006, 6, 30, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI), cord, [0, 0.6, -0.04], t, [0.35, 0, 0]);
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (0.2 + (i / 4) * 0.6);
        add(c, new THREE.ConeGeometry(0.014, 0.045, 4), tooth, [Math.cos(a) * 0.16, 0.57 - Math.sin(a) * 0.05, -Math.sin(a) * 0.16 - 0.02], t, [Math.PI, 0, 0]);
      }
      break;
    }
    case 'sea-king': {
      crown(c, [0, 0.4, 0.06], 0.12, gold(c), glow(c, 0x3ae8ff, 1.6), 5, -0.15);
      // Medalhão com tridente.
      add(c, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20).rotateX(Math.PI / 2), gold(c), [0, 0.48, -0.26], t);
      for (const x of [-0.016, 0, 0.016]) add(c, new THREE.ConeGeometry(0.006, 0.04, 4), c.mat(0x1a2a8a), [x, 0.49, -0.27], t);
      break;
    }
    // ---------------------------------------------------------------- Faísca
    case 'bamboo': {
      // Faixa de bambu na testa com duas folhas.
      add(c, new THREE.TorusGeometry(0.18, 0.012, 6, 32).rotateX(Math.PI / 2), c.mat(0x8aa83a, { roughness: 0.6 }), [0, 0.32, 0.02], h, [-0.15, 0, 0]);
      for (const s of [-1, 1]) add(c, leafGeo(0.08, 0.022), c.mat(0x5a8a2a, { roughness: 0.7 }), [0.12, 0.33, 0.12], h, [0.6, 0.4, s * 0.5 - 0.8]);
      break;
    }
    case 'faisca-neon': {
      // Viseira de neon atravessando os olhos.
      const l = glow(c, 0xff2a8a, 2.4);
      lights.push(l);
      add(c, new THREE.TorusGeometry(0.17, 0.014, 6, 32, Math.PI * 0.7).rotateX(Math.PI / 2).rotateY(Math.PI * 0.65), l, [0, 0.27, 0.0], h);
      break;
    }
    case 'solar': {
      // Auréola de sol atrás da cabeça.
      const l = glow(c, 0xffb020, 2.2);
      lights.push(l);
      add(c, new THREE.TorusGeometry(0.2, 0.01, 6, 40), l, [0, 0.26, 0.2], h);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        add(c, new THREE.ConeGeometry(0.012, 0.05, 4), l, [Math.cos(a) * 0.23, 0.26 + Math.sin(a) * 0.23, 0.2], h, [0, 0, a - Math.PI / 2]);
      }
      break;
    }
    // ---------------------------------------------------------------- Ringo
    case 'desert': {
      // Cantil no cinto e poncho listrado nos ombros.
      add(c, new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16).rotateX(Math.PI / 2).rotateY(Math.PI / 2), c.mat(0x7a8a6a, { metalness: 0.4, roughness: 0.5 }), [-0.22, 0.02, 0.0], t);
      const poncho = add(c, new THREE.ConeGeometry(0.32, 0.22, 20, 1, true), c.mat(0xc8642a, { roughness: 0.9, side: THREE.DoubleSide }), [0, 0.55, 0.0], t);
      poncho.scale.set(1, 1, 0.8);
      add(c, new THREE.TorusGeometry(0.3, 0.012, 6, 30).rotateX(Math.PI / 2), c.mat(0xf0d8a0), [0, 0.47, 0], t).scale.set(1, 1, 0.8);
      break;
    }
    case 'outlaw': {
      // Lenço preto cobrindo o focinho (por cima da bandana) e caveira no chapéu.
      const m = add(c, new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.32), c.mat(0x1a1616, { roughness: 0.9 }), [0, 0.2, -0.02], h);
      m.scale.set(1.05, 1, 1.15);
      add(c, new THREE.SphereGeometry(0.016, 10, 8), c.mat(0xe8e0d0), [0, 0.44, -0.19], h);
      break;
    }
    case 'legend': {
      const l = glow(c, 0xffd040, 1.2);
      lights.push(l);
      add(c, starGeo(0.05, 0.012), l, [-0.1, 0.5, -0.25], t);
      break;
    }
  }
  return lights;
}

/** Bandoleira atravessando o peito (ombro direito → quadril esquerdo), com rebites. `depth`: frente do peito. */
function bandolier(c: PartsContext, strapMat: THREE.Material, studMat: THREE.Material, depth: number, radius = 0.024): THREE.CatmullRomCurve3 {
  const k = depth / 0.31;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.27, 0.68, 0.0),
    new THREE.Vector3(0.18, 0.56, -0.27 * k),
    new THREE.Vector3(-0.05, 0.36, -0.31 * k),
    new THREE.Vector3(-0.24, 0.16, -0.25 * k),
    new THREE.Vector3(-0.3, 0.08, 0.0),
  ]);
  c.place(new THREE.TubeGeometry(curve, 40, radius, 8, false), strapMat, 0, 0, 0, c.torso);
  for (let i = 1; i < 9; i++) {
    const p = curve.getPointAt(0.12 + i * 0.075);
    c.place(new THREE.SphereGeometry(radius * 0.38, 8, 6), studMat, p.x, p.y, p.z - radius * 0.8, c.torso);
  }
  return curve;
}

/** Ombreira em camadas (couro/metal/osso) com borda. */
function pauldron(c: PartsContext, side: number, plate: THREE.Material, rim: THREE.Material, at: V3, size = 0.12, layers = 3): void {
  for (let k = 0; k < layers; k++) {
    const m = add(c, new THREE.SphereGeometry(size - k * 0.014, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), plate, [at[0] + side * k * 0.02, at[1] - k * 0.045, at[2]], c.torso);
    m.rotation.z = -side * (0.5 + k * 0.14);
  }
  add(c, new THREE.TorusGeometry(size * 0.98, 0.008, 6, 28).rotateX(Math.PI / 2), rim, at, c.torso).rotation.z = -side * 0.5;
}

/**
 * Equipamento de couro e metal de cada personagem (acabamento premium), além do que o
 * modelo já tem. `depth`: profundidade da frente do peito no modelo usado.
 */
export function characterGear(c: PartsContext, style: string): void {
  const leather = c.mat(0x5a3a22, { roughness: 0.75 });
  const brass = c.mat(0xc8a050, { metalness: 0.85, roughness: 0.3 });
  switch (style) {
    case 'owl': {
      // Guardiã da Biblioteca das Penas: alça de couro com fivela de latão e bolsa de pergaminhos.
      const curve = bandolier(c, leather, brass, 0.3);
      const p = curve.getPointAt(0.5);
      add(c, new THREE.BoxGeometry(0.06, 0.05, 0.015), brass, [p.x, p.y, p.z - 0.02], c.torso, [0, 0, 0.7]);
      add(c, new THREE.BoxGeometry(0.16, 0.13, 0.07), leather, [-0.26, 0.06, -0.08], c.torso, [0, 0.7, 0]);
      add(c, new THREE.BoxGeometry(0.165, 0.06, 0.075), c.mat(0x4a2e1a, { roughness: 0.8 }), [-0.26, 0.11, -0.08], c.torso, [0, 0.7, 0]);
      // Pergaminhos saindo da bolsa.
      const paper = c.mat(0xefe2c0, { roughness: 0.9 });
      for (const [x, z] of [[-0.24, -0.05], [-0.28, -0.1]] as const) add(c, new THREE.CylinderGeometry(0.015, 0.015, 0.12, 10), paper, [x, 0.17, z], c.torso, [0.2, 0, 0.2]);
      break;
    }
    case 'goldbird': {
      // Medalhão estelar: disco de ouro com cristal que brilha e correntinha.
      const gold = c.mat(0xffcc44, { metalness: 0.9, roughness: 0.2 });
      add(c, new THREE.TorusGeometry(0.15, 0.006, 6, 30, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI), gold, [0, 0.6, -0.03], c.torso, [0.4, 0, 0]);
      add(c, new THREE.CylinderGeometry(0.05, 0.05, 0.014, 6).rotateX(Math.PI / 2), gold, [0, 0.5, -0.245], c.torso);
      add(c, new THREE.OctahedronGeometry(0.026).scale(1, 1.3, 0.6), c.mat(c.palette.accent, { emissive: c.palette.accent, emissiveIntensity: 1.4, roughness: 0.1 }), [0, 0.5, -0.257], c.torso);
      break;
    }
    case 'skelbear': {
      // Ombreira de osso amarrada com corrente e fivela de caveira.
      const bone = c.mat(0xe8dfc4, { roughness: 0.55 });
      const iron = c.mat(0x9a9aa2, { metalness: 0.85, roughness: 0.35 });
      pauldron(c, -1, bone, iron, [-0.34, 0.62, 0], 0.13, 2);
      for (let j = 0; j < 3; j++) add(c, new THREE.ConeGeometry(0.018, 0.08, 6), bone, [-0.36 + j * 0.03, 0.72, -0.05 + j * 0.05], c.torso, [0, 0, 0.5]);
      // Corrente do ombro ao quadril: elos alternados.
      const k = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.27, 0.66, -0.05), new THREE.Vector3(-0.1, 0.42, -0.31), new THREE.Vector3(0.18, 0.18, -0.27), new THREE.Vector3(0.3, 0.08, -0.02)]);
      for (let i = 0; i < 16; i++) {
        const p = k.getPointAt(i / 15);
        add(c, new THREE.TorusGeometry(0.02, 0.007, 6, 12), iron, [p.x, p.y, p.z - 0.02], c.torso, [0, i % 2 ? Math.PI / 2 : 0, 0.6]);
      }
      break;
    }
    case 'shark': {
      // Corda de marinheiro com conchas e fivela de âncora.
      const rope = c.mat(0xb89a68, { roughness: 0.95 });
      const curve = bandolier(c, rope, c.mat(0xf2e8d8, { roughness: 0.4 }), 0.3, 0.02);
      for (let i = 0; i < 3; i++) {
        const p = curve.getPointAt(0.3 + i * 0.15);
        add(c, new THREE.SphereGeometry(0.022, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1), c.mat([0xf0c8b0, 0xe8e0d0, 0xf4b0a0][i], { roughness: 0.4 }), [p.x, p.y - 0.02, p.z - 0.025], c.torso, [-Math.PI / 2, 0, 0]);
      }
      const anchor = new THREE.Group();
      anchor.position.set(0, 0.06, -0.3);
      c.torso.add(anchor);
      add(c, new THREE.BoxGeometry(0.012, 0.07, 0.012), brass, [0, 0, 0], anchor);
      add(c, new THREE.TorusGeometry(0.03, 0.007, 6, 16, Math.PI).rotateZ(Math.PI), brass, [0, -0.01, 0], anchor);
      add(c, new THREE.TorusGeometry(0.012, 0.005, 6, 12), brass, [0, 0.045, 0], anchor);
      break;
    }
    case 'robot': {
      // Placas de ombro rebitadas com faixas de alerta.
      const plate = c.mat(0x6a747e, { metalness: 0.85, roughness: 0.35 });
      const stripe = c.mat(c.palette.accent, { roughness: 0.5 });
      for (const s of [-1, 1]) {
        pauldron(c, s, plate, plate, [s * 0.34, 0.62, 0], 0.12, 2);
        add(c, new THREE.BoxGeometry(0.1, 0.018, 0.13), stripe, [s * 0.36, 0.64, 0], c.torso, [0, 0, -s * 0.5]);
        for (let j = 0; j < 3; j++) add(c, new THREE.SphereGeometry(0.009, 8, 6), brass, [s * 0.3, 0.68, -0.06 + j * 0.06], c.torso);
      }
      break;
    }
  }
}
