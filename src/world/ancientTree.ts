// Árvore anciã escalável: tronco gigante, escada de tábuas em espiral, plataforma
// com parapeito no topo e uma copa larga acima. A mesma geometria serve para todas
// (instanciada e girada); os colisores são gerados para cada posição.
import * as THREE from 'three';
import { Random } from '../core/random';
import { ANCIENT_TREE as T } from '../data/trees';
import { makeBox, makeCylinder, type Collider } from '../systems/collision';
import { merge, paint, trunkGeometry, foliageCards } from './props';

/** Caixa no espaço da árvore (origem no chão, no centro do tronco). */
interface LocalBox {
  x: number;
  z: number;
  w: number;
  d: number;
  rot: number;
  minY: number;
  maxY: number;
  color: number;
  /** Parapeito: colide como caixa cheia, mas aparece como postes e travessas. */
  rail?: boolean;
}

const DECK_THICKNESS = 0.35;
const STEP_THICKNESS = 0.22;
const WOOD = [0x7a5634, 0x6e4c2e, 0x85603a];
const RAIL = 0x5e4128;

/** Caixa na direção do ângulo `a` (rad, 0 = +X) entre os raios r0 e r1. */
function radialBox(a: number, r0: number, r1: number, width: number, minY: number, maxY: number, color: number, rail = false): LocalBox {
  const r = (r0 + r1) / 2;
  // Comprida no X local; rotateY(-a) aponta o X local para (cos a, sin a).
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, w: r1 - r0, d: width, rot: -a, minY, maxY, color, rail };
}

/** Peças sólidas da escada e da plataforma (geram visual e colisão). */
function layout(): LocalBox[] {
  const boxes: LocalBox[] = [];
  const H = T.deckHeight;
  const steps = Math.round(H / T.stepRise) - 1;
  const r0 = T.trunkRadius[2];
  let lastAngle = 0;
  for (let k = 0; k < steps; k++) {
    const top = (k + 1) * T.stepRise;
    lastAngle = k * T.stepAngle;
    boxes.push(radialBox(lastAngle, r0 - 0.1, T.stepOuterRadius, T.stepWidth, top - STEP_THICKNESS, top, WOOD[k % 3]));
  }
  // Patamar ligando o último degrau à plataforma.
  const landing = lastAngle + T.stepAngle;
  boxes.push(radialBox(landing, r0 - 0.1, T.stepOuterRadius, T.stepWidth * 1.3, H - DECK_THICKNESS, H, WOOD[1]));

  // Abertura na plataforma em cima da parte final da escada (para não bater a cabeça).
  const headroom = 1.8 + DECK_THICKNESS + 0.1;
  const firstHigh = Math.ceil((H - headroom) / T.stepRise) - 1;
  const openFrom = firstHigh * T.stepAngle - 0.35;
  // Termina logo depois do último degrau: o patamar já fica com piso e parapeito em volta.
  const openTo = lastAngle + 0.1;
  const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const inOpening = (a0: number, a1: number) => {
    for (let a = a0; a <= a1 + 1e-6; a += (a1 - a0) / 4) {
      const rel = norm(a - openFrom);
      if (rel <= openTo - openFrom) return true;
    }
    return false;
  };
  const sectors = 24;
  const span = (Math.PI * 2) / sectors;
  const width = 2 * T.deckRadius * Math.tan(span / 2) + 0.05;
  for (let i = 0; i < sectors; i++) {
    const a = i * span;
    if (inOpening(a - span / 2, a + span / 2)) {
      // Sobre a escada: só o anel de fora, com um corrimão separando do vão.
      const inner = T.stepOuterRadius + 0.15;
      boxes.push(radialBox(a, inner, T.deckRadius, width, H - DECK_THICKNESS, H, WOOD[i % 3]));
      boxes.push(radialBox(a, T.stepOuterRadius, inner, width * (inner / T.deckRadius) + 0.05, H - DECK_THICKNESS, H + T.railHeight, RAIL, true));
    } else {
      boxes.push(radialBox(a, r0 - 0.2, T.deckRadius, width, H - DECK_THICKNESS, H, WOOD[i % 3]));
    }
    // Parapeito na borda.
    boxes.push(radialBox(a, T.deckRadius - 0.14, T.deckRadius, width, H, H + T.railHeight, RAIL, true));
  }
  return boxes;
}

const LAYOUT = layout();

export interface AncientTreeGeometry {
  trunk: THREE.BufferGeometry;
  wood: THREE.BufferGeometry;
  foliage: THREE.BufferGeometry;
}

export function ancientTreeGeometry(rng: Random): AncientTreeGeometry {
  const H = T.deckHeight;
  // Base da copa: galhos e folhas começam bem acima da cabeça de quem está na plataforma.
  const C = H + T.canopyClearance;
  const crown = new THREE.Vector3(0, C + 4, 0);
  // Grupos de folhas: topo, anel alto sobre a plataforma e anel mais baixo, afastado da borda.
  const clusters: THREE.Vector3[] = [new THREE.Vector3(0, C + 6.5, 0)];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const r = rng.range(3.5, 5.5);
    clusters.push(new THREE.Vector3(Math.cos(a) * r, C + rng.range(3.2, 4.5), Math.sin(a) * r));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5 + rng.range(-0.2, 0.2);
    const r = rng.range(8, 9.5);
    clusters.push(new THREE.Vector3(Math.cos(a) * r, C + rng.range(2, 3), Math.sin(a) * r));
  }
  // Galhos grossos do tronco até as folhas (saem acima da plataforma).
  const branches: THREE.BufferGeometry[] = [];
  for (const c of clusters.slice(1)) {
    const from = new THREE.Vector3(0, C + rng.range(0, 1), 0);
    const d = c.clone().sub(from);
    const len = d.length() * 0.85;
    const b = new THREE.CylinderGeometry(0.14, 0.38, len, 6).translate(0, len / 2, 0);
    b.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    b.translate(from.x, from.y, from.z);
    branches.push(b);
  }
  const trunk = trunkGeometry(1.95, 1.0, C + 2, branches, 1.8);
  const foliage = foliageCards(rng, clusters, crown, 15, [2.8, 3.8]);

  const woodGeos: THREE.BufferGeometry[] = [];
  const piece = (b: LocalBox, w: number, h: number, d: number, lz: number, y: number, color: number) =>
    // lz: deslocamento ao longo da largura da caixa (eixo Z local).
    woodGeos.push(paint(new THREE.BoxGeometry(w, h, d).translate(0, y, lz).rotateY(b.rot).translate(b.x, 0, b.z), color));
  for (const b of LAYOUT) {
    if (!b.rail) {
      piece(b, b.w, b.maxY - b.minY, b.d, 0, (b.minY + b.maxY) / 2, b.color);
      continue;
    }
    // Parapeito vazado: poste numa ponta + duas travessas (a colisão continua cheia).
    const top = b.maxY;
    const base = top - T.railHeight;
    piece(b, 0.14, T.railHeight, 0.14, -b.d / 2 + 0.07, base + T.railHeight / 2, b.color);
    piece(b, 0.1, 0.09, b.d, 0, top - 0.06, b.color);
    piece(b, 0.07, 0.07, b.d, 0, base + 0.45, b.color);
  }
  // Suportes inclinados sob cada degrau (só visual).
  const steps = Math.round(H / T.stepRise) - 1;
  for (let k = 0; k < steps; k += 2) {
    const a = k * T.stepAngle;
    const top = (k + 1) * T.stepRise - STEP_THICKNESS;
    const brace = new THREE.BoxGeometry(1.3, 0.12, 0.12).rotateZ(0.6).translate((T.trunkRadius[2] + T.stepOuterRadius) / 2, top - 0.38, 0).rotateY(-a);
    woodGeos.push(paint(brace, 0x4e3624));
  }
  return { trunk, wood: merge(woodGeos, true), foliage };
}

/** Colisores de uma árvore anciã em (x, groundY, z) girada por `rotation`. */
export function ancientTreeColliders(x: number, groundY: number, z: number, rotation: number): Collider[] {
  const out: Collider[] = [];
  const H = T.deckHeight;
  const [rb, rm, rt] = T.trunkRadius;
  out.push(makeCylinder(x, z, rb, groundY - 1, groundY + 4));
  out.push(makeCylinder(x, z, rm, groundY + 4, groundY + 8));
  out.push(makeCylinder(x, z, rt, groundY + 8, groundY + H + T.canopyClearance + 2));
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  for (const b of LAYOUT) {
    // Mesma rotação em Y do Three.js: x' = x·cos + z·sin, z' = -x·sin + z·cos.
    const wx = x + b.x * cos + b.z * sin;
    const wz = z - b.x * sin + b.z * cos;
    out.push(makeBox(wx, wz, b.w, b.d, b.rot + rotation, groundY + b.minY, groundY + b.maxY));
  }
  return out;
}

/** Raio ocupado (para outras árvores e pedras não nascerem em cima). */
export const ANCIENT_TREE_CLEARANCE = Math.max(T.deckRadius, 9.5) + 1;

/**
 * Altura da base da árvore: o ponto mais baixo em volta da escada (assim o 1º
 * degrau nunca fica alto demais para subir andando).
 */
export function ancientTreeBase(sample: (x: number, z: number) => number, x: number, z: number): number {
  let ground = sample(x, z);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    for (const r of [1.8, 2.6, 3.4]) ground = Math.min(ground, sample(x + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  return ground;
}

/**
 * Caminho para subir (usado pelos bots): começa no chão antes do 1º degrau,
 * passa por cada degrau no meio da escada e termina num ponto da plataforma,
 * perto do parapeito. Coordenadas do mundo (y = altura do piso esperado).
 */
export function ancientTreeClimbPath(x: number, groundY: number, z: number, rotation: number): { x: number; y: number; z: number }[] {
  const H = T.deckHeight;
  const steps = Math.round(H / T.stepRise) - 1;
  const mid = (T.trunkRadius[2] + T.stepOuterRadius) / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const at = (a: number, r: number, y: number) => {
    const lx = Math.cos(a) * r;
    const lz = Math.sin(a) * r;
    return { x: x + lx * cos + lz * sin, y: groundY + y, z: z - lx * sin + lz * cos };
  };
  // Entrada: fora da área dos degraus, um pouco antes do primeiro.
  const path = [at(-0.7, T.stepOuterRadius + 1.6, 0), at(-0.45, mid, 0)];
  for (let k = 0; k < steps; k++) path.push(at(k * T.stepAngle, mid, (k + 1) * T.stepRise));
  const landing = steps * T.stepAngle;
  path.push(at(landing, mid, H));
  // Anda pela plataforma até um ponto junto ao parapeito.
  path.push(at(landing + 0.5, T.deckRadius - 1.0, H));
  path.push(at(landing + 1.1, T.deckRadius - 0.8, H));
  return path;
}
