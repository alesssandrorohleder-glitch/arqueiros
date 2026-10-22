// Modelos 3D dos arcos: um desenho por arco (data/bows.ts → look). Quanto mais
// raro, maior e mais enfeitado: comum = madeira simples; incomum = enfeites de
// metal; raro = ouro e joias; épico = brilho e espinhos; lendário = halo,
// partes flutuando e muito brilho.
//
// "Espaço do arco": +Y para cima, -Z para onde a flecha vai, corda do lado +Z.
// A empunhadura fica em (0, 0, GRIP_Z) e as pontas em ±size no Y.
import * as THREE from 'three';
import { getBow, type BowLook } from '../data/bows';
import { RARITIES, RARITY_ORDER } from '../data/rarities';

export const GRIP_Z = -0.12;

export interface BowModel {
  readonly group: THREE.Group;
  /** Pontas onde a corda prende. */
  readonly tipTop: THREE.Vector3;
  readonly tipBottom: THREE.Vector3;
  /** Posição da corda em repouso (z). */
  readonly restNockZ: number;
  /** Anima partes (anéis girando, brilho pulsando, partículas). */
  update(dt: number): void;
  /** Disparou: estouro de brilho e partículas (raros em diante). */
  onShot(): void;
  dispose(): void;
}

type V = [number, number, number];

/** Tubo que afina da empunhadura (r0) até as pontas (r1). */
function taperedTube(points: THREE.Vector3[], r0: number, r1: number, radial = 8): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = 48;
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.getAttribute('position');
  const c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, c);
    const r = r0 + (r1 - r0) * Math.abs(2 * t - 1);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r, c.y + (pos.getY(k) - c.y) * r, c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Metade de cima (do centro até a ponta) → arco inteiro, espelhando no Y. */
function fullLimb(top: V[]): THREE.Vector3[] {
  const up = top.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const down = up.slice(1).map((p) => new THREE.Vector3(p.x, -p.y, p.z)).reverse();
  return [...down, ...up];
}

/** Ponto e direção ao longo do arco (t de 0 = ponta de baixo a 1 = ponta de cima). */
function along(points: THREE.Vector3[], t: number): { p: THREE.Vector3; tan: THREE.Vector3 } {
  const c = new THREE.CatmullRomCurve3(points);
  return { p: c.getPointAt(t), tan: c.getTangentAt(t) };
}

class Builder {
  readonly group = new THREE.Group();
  readonly materials: THREE.Material[] = [];
  readonly geometries: THREE.BufferGeometry[] = [];
  readonly animators: ((t: number) => void)[] = [];

  mat(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
    this.materials.push(m);
    return m;
  }

  glow(color: number, opacity = 1): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    this.materials.push(m);
    return m;
  }

  add(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = this.group): THREE.Mesh {
    this.geometries.push(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = !(m instanceof THREE.MeshBasicMaterial);
    parent.add(mesh);
    return mesh;
  }

  /** Peça orientada pelo eixo Y da geometria ao longo de `dir`, em `at`. */
  place(geo: THREE.BufferGeometry, m: THREE.Material, at: THREE.Vector3, dir?: THREE.Vector3, parent?: THREE.Object3D): THREE.Mesh {
    const mesh = this.add(geo, m, parent);
    mesh.position.copy(at);
    if (dir) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }

  sprite(color: number, size: number, at: THREE.Vector3, opacity = 0.8, parent: THREE.Object3D = this.group): THREE.Sprite {
    const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    this.materials.push(m);
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    s.position.copy(at);
    parent.add(s);
    return s;
  }
}

let glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/** Forma do braço do arco (metade de cima), em função do tamanho. */
function limbShape(look: BowLook): V[] {
  const s = look.size;
  const g = GRIP_Z;
  switch (look.shape) {
    case 'recurve':
    case 'storm':
    case 'blade':
      // Pontas viram para a frente (recurvo).
      return [[0, 0, g], [0, 0.4 * s, g - 0.06], [0, 0.78 * s, g + 0.2], [0, 0.92 * s, g + 0.2], [0, s, g + 0.08]];
    case 'composite':
      return [[0, 0, g], [0, 0.3 * s, g - 0.02], [0, 0.62 * s, g + 0.1], [0, s, g + 0.22]];
    case 'sun':
    case 'echo':
      // Grande e dramático: barriga funda e pontas abertas.
      return [[0, 0, g], [0, 0.35 * s, g - 0.1], [0, 0.72 * s, g + 0.08], [0, s, g + 0.32], [0, 1.06 * s, g + 0.28]];
    default:
      return [[0, 0, g], [0, 0.5 * s, g + 0.07], [0, 0.85 * s, g + 0.18], [0, s, g + 0.24]];
  }
}

export function buildBowModel(bowId: string): BowModel {
  const look = getBow(bowId).look;
  const b = new Builder();
  const s = look.size;
  const limbPts = fullLimb(limbShape(look));
  const tipTop = limbPts[limbPts.length - 1].clone();
  const tipBottom = limbPts[0].clone();
  const grip = new THREE.Vector3(0, 0, GRIP_Z);

  const thick = { simple: 0.03, short: 0.036, long: 0.028, recurve: 0.032, elven: 0.024, composite: 0.034, storm: 0.04, crystal: 0.036, blade: 0.034, echo: 0.032, sun: 0.042 }[look.shape];
  const glowColor = look.glow ?? look.accent;

  // Material do braço do arco.
  const limbMat =
    look.shape === 'crystal'
      ? b.mat(look.main, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, emissive: glowColor, emissiveIntensity: 0.7 })
      : look.shape === 'echo'
        ? b.mat(look.main, { roughness: 0.3, emissive: glowColor, emissiveIntensity: 1.1 })
        : look.shape === 'sun'
          ? b.mat(look.main, { roughness: 0.25, metalness: 0.9, emissive: glowColor, emissiveIntensity: 0.7 })
          : look.shape === 'storm' || look.shape === 'blade'
            ? b.mat(look.main, { roughness: 0.35, metalness: 0.8 })
            : b.mat(look.main, { roughness: look.shape === 'elven' ? 0.4 : 0.75 });
  b.add(taperedTube(limbPts, thick, thick * 0.45), limbMat);

  const accent = b.mat(look.accent, { roughness: 0.3, metalness: look.shape === 'simple' || look.shape === 'short' ? 0 : 0.85 });
  const leather = b.mat(0x3a2a1e, { roughness: 0.9 });

  // Empunhadura (todos).
  b.place(new THREE.CylinderGeometry(thick * 1.45, thick * 1.45, 0.22, 10), look.shape === 'simple' || look.shape === 'short' ? leather : accent, grip);

  const tipAt = (t: number) => along(limbPts, t);
  const both = (f: (t: number, side: 1 | -1) => void) => {
    f(1, 1);
    f(0, -1);
  };

  switch (look.shape) {
    case 'simple': {
      // Pontas de chifre.
      both((t) => {
        const { p, tan } = tipAt(t);
        b.place(new THREE.ConeGeometry(thick * 0.8, 0.08, 6), b.mat(0xe8dcc0), p, t === 1 ? tan : tan.clone().negate());
      });
      break;
    }
    case 'short': {
      // Amarrações de corda perto da empunhadura.
      for (const y of [-0.16, -0.11, 0.11, 0.16]) b.place(new THREE.TorusGeometry(thick * 1.25, 0.008, 5, 12).rotateX(Math.PI / 2), accent, along(limbPts, 0.5 + y / (2.2 * s)).p);
      break;
    }
    case 'long': {
      // Faixa de pano verde com fitas penduradas e pontas de osso.
      b.place(new THREE.CylinderGeometry(thick * 1.6, thick * 1.6, 0.3, 10), b.mat(look.accent, { roughness: 0.95 }), grip);
      for (const side of [-1, 1]) {
        const ribbon = b.place(new THREE.PlaneGeometry(0.035, 0.32).translate(0, -0.16, 0), b.mat(look.accent, { side: THREE.DoubleSide, roughness: 0.95 }), new THREE.Vector3(0.02 * side, -0.08, GRIP_Z + 0.03));
        b.animators.push((time) => (ribbon.rotation.x = Math.sin(time * 3 + side) * 0.25 + 0.2));
      }
      both((t) => {
        const { p, tan } = tipAt(t);
        b.place(new THREE.ConeGeometry(thick * 0.9, 0.1, 6), b.mat(0xf2ead8), p, t === 1 ? tan : tan.clone().negate());
      });
      break;
    }
    case 'recurve': {
      // Ponteiras de latão e anéis de metal.
      both((t) => {
        const { p, tan } = tipAt(t);
        b.place(new THREE.CylinderGeometry(thick * 0.9, thick * 0.7, 0.12, 8), accent, p, tan);
      });
      for (const t of [0.3, 0.7]) b.place(new THREE.TorusGeometry(thick * 1.15, 0.01, 6, 14).rotateX(Math.PI / 2), accent, tipAt(t).p, tipAt(t).tan);
      break;
    }
    case 'elven': {
      // Folhas de ouro nas pontas, espiral dourada e esmeralda na empunhadura.
      for (let i = 1; i < 12; i++) {
        if (Math.abs(i - 6) < 1) continue;
        const { p, tan } = tipAt(i / 12);
        b.place(new THREE.TorusGeometry(thick * 1.2, 0.006, 5, 12).rotateX(Math.PI / 2), accent, p, tan);
      }
      both((t, side) => {
        const { p } = tipAt(t);
        for (const k of [-1, 1]) {
          const leaf = b.place(new THREE.SphereGeometry(0.05, 8, 6).scale(0.35, 1.6, 0.9), accent, p.clone().add(new THREE.Vector3(0, -0.06 * side, 0.03 * k)));
          leaf.rotation.x = 0.7 * k * side;
        }
      });
      b.place(new THREE.OctahedronGeometry(0.05), b.mat(glowColor, { emissive: glowColor, emissiveIntensity: 1.2, roughness: 0.1 }), grip.clone().add(new THREE.Vector3(0, 0, -0.05)));
      b.sprite(glowColor, 0.22, grip.clone().add(new THREE.Vector3(0, 0, -0.06)), 0.5);
      break;
    }
    case 'composite': {
      // Camada de chifre por dentro, rodas (cames) de aço nas pontas e safira.
      const inner = limbPts.map((p) => p.clone().add(new THREE.Vector3(0, 0, 0.03)));
      b.add(taperedTube(inner, thick * 0.7, thick * 0.3), b.mat(0x1f1a17, { roughness: 0.5 }));
      both((t) => {
        const { p } = tipAt(t);
        b.place(new THREE.TorusGeometry(0.06, 0.016, 8, 16).rotateY(Math.PI / 2), accent, p);
        b.place(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8).rotateZ(Math.PI / 2), accent, p);
      });
      for (const side of [-1, 1]) b.place(new THREE.BoxGeometry(0.02, 0.12, 0.05), accent, new THREE.Vector3(0, 0.17 * side, GRIP_Z + 0.02));
      b.place(new THREE.OctahedronGeometry(0.05), b.mat(glowColor, { emissive: glowColor, emissiveIntensity: 1.2, roughness: 0.1 }), grip.clone().add(new THREE.Vector3(0, 0, -0.05)));
      b.sprite(glowColor, 0.22, grip.clone().add(new THREE.Vector3(0, 0, -0.06)), 0.5);
      break;
    }
    case 'storm': {
      // Espinhos de aço, veias de energia e faíscas piscando nas pontas.
      const vein = limbPts.map((p) => p.clone().add(new THREE.Vector3(0, 0, -0.025)));
      b.add(taperedTube(vein, 0.012, 0.006, 5), b.glow(glowColor, 0.95));
      for (let i = 1; i < 10; i++) {
        if (i === 5) continue;
        const { p, tan } = tipAt(i / 10);
        const out = new THREE.Vector3(0, 0, -1).addScaledVector(tan, i < 5 ? -0.6 : 0.6).normalize();
        b.place(new THREE.ConeGeometry(0.02, 0.1 + (i % 2) * 0.05, 5), accent, p.clone().addScaledVector(out, 0.04), out);
      }
      const sparks: THREE.Sprite[] = [];
      both((t) => sparks.push(b.sprite(glowColor, 0.3, tipAt(t).p, 0.8)));
      sparks.push(b.sprite(0x7fe0ff, 0.35, grip.clone().add(new THREE.Vector3(0, 0, -0.06)), 0.7));
      b.animators.push((time) => sparks.forEach((sp, i) => {
        const flick = Math.random() < 0.15 ? 1.6 : 1;
        sp.material.opacity = (0.45 + 0.35 * Math.abs(Math.sin(time * (9 + i * 3)))) * flick;
      }));
      break;
    }
    case 'crystal': {
      // Gelo: cristais pontudos ao longo do arco e grandes nas pontas.
      const ice = b.mat(look.accent, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8, emissive: glowColor, emissiveIntensity: 0.9 });
      for (let i = 1; i < 12; i++) {
        if (i === 6) continue;
        const { p, tan } = tipAt(i / 12);
        const out = new THREE.Vector3((i % 2 ? 1 : -1) * 0.6, 0, -1).addScaledVector(tan, 0.3).normalize();
        b.place(new THREE.OctahedronGeometry(0.035).scale(0.7, 2.2, 0.7), ice, p.clone().addScaledVector(out, 0.04), out);
      }
      both((t, side) => {
        const { p } = tipAt(t);
        for (let k = 0; k < 3; k++) {
          const d = new THREE.Vector3(Math.cos(k * 2.1) * 0.5, side, Math.sin(k * 2.1) * 0.5).normalize();
          b.place(new THREE.OctahedronGeometry(0.05).scale(0.6, 2.6, 0.6), ice, p.clone().addScaledVector(d, 0.06), d);
        }
      });
      const mist = b.sprite(glowColor, 0.5, grip, 0.45);
      b.animators.push((time) => (mist.material.opacity = 0.3 + 0.15 * Math.sin(time * 2.5)));
      break;
    }
    case 'blade': {
      // Lâminas nas costas do arco, núcleo vermelho e pontas de lança.
      const core = limbPts.map((p) => p.clone().add(new THREE.Vector3(0, 0, -0.02)));
      b.add(taperedTube(core, 0.01, 0.005, 5), b.glow(glowColor, 0.9));
      const steel = b.mat(look.accent, { metalness: 0.95, roughness: 0.2 });
      for (let i = 1; i < 10; i++) {
        if (i === 5) continue;
        const { p, tan } = tipAt(i / 10);
        const fin = b.place(new THREE.ConeGeometry(0.06, 0.2, 3).scale(1, 1, 0.18), steel, p.clone().add(new THREE.Vector3(0, 0, -0.06)), new THREE.Vector3(0, 0, -1).addScaledVector(tan, i < 5 ? -0.8 : 0.8));
        fin.rotateY(Math.PI / 2);
      }
      both((t) => {
        const { p, tan } = tipAt(t);
        b.place(new THREE.ConeGeometry(0.035, 0.24, 4), steel, p.clone().addScaledVector(t === 1 ? tan : tan.clone().negate(), 0.1), t === 1 ? tan : tan.clone().negate());
      });
      const eye = b.sprite(glowColor, 0.32, grip.clone().add(new THREE.Vector3(0, 0, -0.06)), 0.8);
      b.animators.push((time) => (eye.material.opacity = 0.55 + 0.35 * Math.sin(time * 4)));
      break;
    }
    case 'echo': {
      // Cópias fantasmas pulsando, anéis de runas girando e orbes nas pontas.
      const ghostMats: THREE.MeshBasicMaterial[] = [];
      for (const k of [1.12, 1.25]) {
        const pts = limbPts.map((p) => new THREE.Vector3(p.x, p.y * k, GRIP_Z + (p.z - GRIP_Z) * k + 0.04 * (k - 1)));
        const m = b.glow(glowColor, 0.35 / k);
        ghostMats.push(m);
        b.add(taperedTube(pts, thick * 0.8, thick * 0.3, 6), m);
      }
      const ringPivot = new THREE.Group();
      ringPivot.position.copy(grip);
      b.group.add(ringPivot);
      const runeMat = b.glow(look.accent, 0.85);
      const rings: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const r = b.add(new THREE.TorusGeometry(0.2 + i * 0.07, 0.008, 6, 40), runeMat, ringPivot);
        r.rotation.set(i * 0.9, i * 0.6, 0);
        rings.push(r);
      }
      const orbs: THREE.Sprite[] = [];
      both((t) => orbs.push(b.sprite(glowColor, 0.38, tipAt(t).p, 0.9)));
      b.place(new THREE.SphereGeometry(0.035, 10, 8), b.mat(0xffffff, { emissive: glowColor, emissiveIntensity: 2 }), tipAt(1).p);
      b.place(new THREE.SphereGeometry(0.035, 10, 8), b.mat(0xffffff, { emissive: glowColor, emissiveIntensity: 2 }), tipAt(0).p);
      b.animators.push((time) => {
        rings.forEach((r, i) => {
          r.rotation.x += 0.02 * (i + 1);
          r.rotation.y += 0.013 * (3 - i);
        });
        ghostMats.forEach((m, i) => (m.opacity = (0.22 + 0.15 * Math.sin(time * 3 + i * 1.5)) / (i + 1)));
        orbs.forEach((o, i) => o.scale.setScalar(0.32 + 0.08 * Math.sin(time * 5 + i * Math.PI)));
      });
      break;
    }
    case 'sun': {
      // Disco solar com raios girando atrás da empunhadura, asas douradas e chamas nas pontas.
      const sunPivot = new THREE.Group();
      sunPivot.position.copy(grip).add(new THREE.Vector3(0, 0, 0.05));
      b.group.add(sunPivot);
      const gold = b.mat(look.accent, { metalness: 0.95, roughness: 0.2, emissive: glowColor, emissiveIntensity: 0.6 });
      b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 28).rotateZ(Math.PI / 2), gold, sunPivot);
      const rays = new THREE.Group();
      sunPivot.add(rays);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const len = i % 2 ? 0.18 : 0.3;
        const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
        b.place(new THREE.ConeGeometry(0.035, len, 4).scale(0.35, 1, 1), gold, dir.clone().multiplyScalar(0.16 + len / 2), dir, rays);
      }
      const halo = b.sprite(glowColor, 1.0, new THREE.Vector3(), 0.55, sunPivot);
      // Asas: arcos dourados por fora dos braços.
      for (const side of [1, -1]) {
        const wing: V[] = [[0, 0.12 * side, GRIP_Z - 0.04], [0, 0.4 * s * side, GRIP_Z - 0.26], [0, 0.75 * s * side, GRIP_Z - 0.16], [0, 0.95 * s * side, GRIP_Z + 0.08]];
        b.add(taperedTube(wing.map(([x, y, z]) => new THREE.Vector3(x, y, z)), 0.02, 0.008, 6), gold);
        for (let k = 1; k <= 3; k++) {
          const { p } = along(wing.map(([x, y, z]) => new THREE.Vector3(x, y, z)), k / 4);
          b.place(new THREE.ConeGeometry(0.025, 0.16, 4), gold, p, new THREE.Vector3(0, 0.3 * side, -1));
        }
      }
      const flames: THREE.Sprite[] = [];
      both((t) => {
        flames.push(b.sprite(0xff6a10, 0.4, tipAt(t).p, 0.9));
        flames.push(b.sprite(0xffe08a, 0.2, tipAt(t).p, 1));
      });
      b.animators.push((time) => {
        rays.rotation.x = time * 0.8;
        halo.material.opacity = 0.45 + 0.15 * Math.sin(time * 3);
        flames.forEach((f, i) => f.scale.setScalar((i % 2 ? 0.2 : 0.4) * (1 + 0.25 * Math.sin(time * 14 + i * 2.3) + Math.random() * 0.1)));
      });
      break;
    }
  }

  // Brilho e partículas por raridade (raro em diante): quanto mais raro, mais.
  const rank = RARITY_ORDER.indexOf(getBow(bowId).rarity);
  const sparkleColor = new THREE.Color(look.glow ?? RARITIES[getBow(bowId).rarity].color);
  const sparkles = rank >= 2 ? new Sparkles(b, limbPts, sparkleColor, [0, 0, 10, 20, 34][rank], rank) : null;
  let burst = 0;
  if (rank >= 2) {
    // Brilho pulsando no próprio arco.
    const baseIntensity = (limbMat as THREE.MeshStandardMaterial).emissiveIntensity ?? 0;
    if (!(limbMat as THREE.MeshStandardMaterial).emissive.getHex()) (limbMat as THREE.MeshStandardMaterial).emissive.copy(sparkleColor);
    b.animators.push((t) => {
      (limbMat as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(baseIntensity, 0.15 * rank) * (0.8 + 0.3 * Math.sin(t * 2.5)) + burst * 1.5;
    });
  }
  // Épico e lendário: halo de luz em volta do arco inteiro.
  const halo = rank >= 3 ? b.sprite(sparkleColor.getHex(), s * (rank === 4 ? 2.6 : 2.0), grip, 0.16) : null;
  if (halo) b.animators.push((t) => (halo.material.opacity = (rank === 4 ? 0.22 : 0.14) * (0.75 + 0.25 * Math.sin(t * 1.7)) + burst * 0.5));

  let time = Math.random() * 10;
  return {
    group: b.group,
    tipTop,
    tipBottom,
    restNockZ: tipTop.z,
    update(dt: number) {
      time += dt;
      burst = Math.max(0, burst - dt * 4);
      for (const a of b.animators) a(time);
      sparkles?.update(dt);
    },
    onShot() {
      if (rank < 2) return;
      burst = 1;
      sparkles?.burst(4 + rank * 4);
    },
    dispose() {
      for (const g of b.geometries) g.dispose();
      for (const m of b.materials) m.dispose();
    },
  };
}

/**
 * Partículas brilhantes que nascem ao longo do arco e sobem devagar, apagando.
 * (Cores por vértice + brilho aditivo: "apagar" = escurecer até preto.)
 */
class Sparkles {
  private readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly tmp = new THREE.Vector3();

  constructor(b: Builder, limb: THREE.Vector3[], private readonly color: THREE.Color, private readonly count: number, rank: number) {
    this.curve = new THREE.CatmullRomCurve3(limb);
    const n = count + 24; // folga para os estouros ao atirar
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    b.geometries.push(geo);
    const mat = new THREE.PointsMaterial({
      size: 0.05 + rank * 0.012,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    b.materials.push(mat);
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    b.group.add(this.points);
    // Começam espalhadas no tempo para não nascerem todas juntas.
    for (let i = 0; i < count; i++) this.spawn(i, Math.random());
  }

  private spawn(i: number, age = 0, fast = false): void {
    this.curve.getPointAt(Math.random(), this.tmp);
    const k = i * 3;
    this.pos[k] = this.tmp.x + (Math.random() - 0.5) * 0.06;
    this.pos[k + 1] = this.tmp.y + (Math.random() - 0.5) * 0.06;
    this.pos[k + 2] = this.tmp.z + (Math.random() - 0.5) * 0.06;
    const sp = fast ? 1.2 : 0.25;
    this.vel[k] = (Math.random() - 0.5) * sp;
    this.vel[k + 1] = (fast ? 0.2 : 0.15) + Math.random() * sp;
    this.vel[k + 2] = (Math.random() - 0.5) * sp - (fast ? 0.6 : 0);
    this.maxLife[i] = (fast ? 0.35 : 0.8) + Math.random() * 0.8;
    this.life[i] = this.maxLife[i] * (1 - age);
  }

  burst(n: number): void {
    for (let j = 0; j < n; j++) {
      const i = this.count + Math.floor(Math.random() * (this.life.length - this.count));
      this.spawn(i, 0, true);
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.life.length; i++) {
      const k = i * 3;
      if (this.life[i] <= 0) {
        if (i < this.count) this.spawn(i);
        else {
          this.col[k] = this.col[k + 1] = this.col[k + 2] = 0;
          continue;
        }
      }
      this.life[i] -= dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      // Acende rápido e apaga devagar (com uma leve cintilação).
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      const a = Math.min(1, (1 - t) * 6) * t * (0.7 + Math.random() * 0.3) * 1.6;
      this.col[k] = this.color.r * a;
      this.col[k + 1] = this.color.g * a;
      this.col[k + 2] = this.color.b * a;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
