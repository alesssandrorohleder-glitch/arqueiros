// Fábricas de geometria (árvores, pedras, flores). As árvores têm tronco
// sólido + folhagem em "cartões" com textura transparente, como em jogos 3D.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Random } from '../core/random';

/** Pinta todos os vértices de uma geometria com uma cor. */
export function paint(geo: THREE.BufferGeometry, color: number | THREE.Color): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const count = geo.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Junta geometrias. Por padrão recalcula as normais (faces chapadas);
 * com `keepNormals` mantém as originais (cilindros lisos, caixas corretas).
 */
export function merge(geos: THREE.BufferGeometry[], keepNormals = false): THREE.BufferGeometry {
  const flat = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('uv');
    if (!keepNormals) ng.deleteAttribute('normal');
    return ng;
  });
  const merged = mergeGeometries(flat, false);
  if (!merged) throw new Error('mergeGeometries falhou');
  if (!keepNormals) merged.computeVertexNormals();
  return merged;
}

export interface TreeGeometry {
  trunk: THREE.BufferGeometry;
  foliage: THREE.BufferGeometry;
}

/**
 * Cartão de folhagem: retângulo de `width` com o eixo V indo de `base` na
 * direção `dir` por `length`. A normal aponta para fora do centro da copa,
 * o que dá à copa um sombreamento "fofo" e volumoso.
 */
function card(
  out: { pos: number[]; uv: number[]; nrm: number[]; idx: number[] },
  base: THREE.Vector3,
  dir: THREE.Vector3,
  side: THREE.Vector3,
  length: number,
  width: number,
  center: THREE.Vector3,
): void {
  const i0 = out.pos.length / 3;
  const corners: [number, number][] = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
  for (const [u, v] of corners) {
    const p = base.clone().addScaledVector(side, u * width).addScaledVector(dir, v * length);
    out.pos.push(p.x, p.y, p.z);
    out.uv.push(u + 0.5, v);
    const n = p.clone().sub(center).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.3).normalize();
    out.nrm.push(n.x, n.y, n.z);
  }
  out.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
}

function cardsGeometry(out: { pos: number[]; uv: number[]; nrm: number[]; idx: number[] }): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nrm, 3));
  g.setIndex(out.idx);
  return g;
}

function trunkGeometry(radiusBottom: number, radiusTop: number, height: number, branches: THREE.BufferGeometry[] = []): THREE.BufferGeometry {
  const t = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 9, 4).translate(0, height / 2, 0);
  // Raízes um pouco mais grossas na base.
  const pos = t.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 + Math.max(0, 0.6 - y) * 0.5;
    pos.setXYZ(i, pos.getX(i) * k, y, pos.getZ(i) * k);
  }
  // Repete a textura de casca ao longo do tronco.
  const uv = t.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * height * 0.6);
  if (!branches.length) return t;
  const merged = mergeGeometries([t.toNonIndexed(), ...branches.map((b) => b.toNonIndexed())], false);
  return merged ?? t;
}

export function pineGeometry(rng: Random): TreeGeometry {
  const height = 7.5;
  const trunk = trunkGeometry(0.26, 0.08, height);
  const out = { pos: [] as number[], uv: [] as number[], nrm: [] as number[], idx: [] as number[] };
  const center = new THREE.Vector3(0, height * 0.45, 0);
  const levels = 9;
  for (let l = 0; l < levels; l++) {
    const t = l / (levels - 1);
    const y = 1.6 + t * (height - 2.0);
    const len = 2.4 * (1 - t) + 0.45;
    const count = Math.max(4, Math.round(8 - t * 3));
    const rot0 = rng.range(0, Math.PI * 2);
    for (let k = 0; k < count; k++) {
      const a = rot0 + (k / count) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const outward = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      // Galhos pendem para baixo, mais nas camadas de baixo.
      const dir = outward.clone().multiplyScalar(Math.cos(0.35 + 0.2 * (1 - t))).setY(-Math.sin(0.35 + 0.2 * (1 - t))).normalize();
      const side = new THREE.Vector3(-outward.z, 0, outward.x);
      card(out, new THREE.Vector3(0, y, 0), dir, side, len, len * 0.85, center);
    }
  }
  // Ponta.
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    card(out, new THREE.Vector3(0, height - 1.1, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 1.4, 0.9, center);
  }
  return { trunk, foliage: cardsGeometry(out) };
}

export function broadleafGeometry(rng: Random): TreeGeometry {
  const height = 3.2;
  const branches: THREE.BufferGeometry[] = [];
  const crown = new THREE.Vector3(0, 4.4, 0);
  const clusters: THREE.Vector3[] = [new THREE.Vector3(0, 5.0, 0)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const r = rng.range(1.2, 1.9);
    clusters.push(new THREE.Vector3(Math.cos(a) * r, rng.range(3.6, 5.0), Math.sin(a) * r));
  }
  // Galhos do topo do tronco até cada grupo de folhas.
  for (const c of clusters.slice(1)) {
    const from = new THREE.Vector3(0, height - 0.3, 0);
    const d = c.clone().sub(from);
    const len = d.length() * 0.8;
    const b = new THREE.CylinderGeometry(0.05, 0.11, len, 5).translate(0, len / 2, 0);
    b.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    b.translate(from.x, from.y, from.z);
    branches.push(b);
  }
  const trunk = trunkGeometry(0.32, 0.2, height, branches);

  const out = { pos: [] as number[], uv: [] as number[], nrm: [] as number[], idx: [] as number[] };
  for (const c of clusters) {
    const n = 9;
    for (let k = 0; k < n; k++) {
      const dir = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.4, 1), rng.range(-1, 1)).normalize();
      const side = new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).cross(dir).normalize();
      const size = rng.range(1.5, 2.1);
      const base = c.clone().addScaledVector(dir, -size * 0.5);
      card(out, base, dir, side, size, size, crown);
    }
  }
  return { trunk, foliage: cardsGeometry(out) };
}

/** Ruído 3D barato (soma de senos), usado para deformar as pedras. */
function noise3(x: number, y: number, z: number, seed: number): number {
  return (
    Math.sin(x * 1.7 + seed) * Math.sin(y * 2.1 + seed * 1.3) * Math.sin(z * 1.9 + seed * 0.7) * 0.5 +
    Math.sin(x * 3.9 + y * 2.7 + seed * 2.1) * Math.sin(z * 3.3 - x * 1.1) * 0.3 +
    Math.sin(x * 7.3 - z * 6.1 + y * 5.3 + seed) * 0.12
  );
}

export function rockGeometry(rng: Random): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const seed = rng.range(0, 100);
  const flatten = rng.range(0.15, 0.45);
  const pos = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise3(v.x, v.y, v.z, seed);
    v.multiplyScalar(1 + n * 0.28);
    // Base achatada (pedra assentada no chão) e algumas faces cortadas.
    if (v.y < -flatten) v.y = -flatten + (v.y + flatten) * 0.2;
    if (v.x > 0.75) v.x = 0.75 + (v.x - 0.75) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function flowerGeometry(): THREE.BufferGeometry {
  return merge([
    paint(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 3).translate(0, 0.16, 0), 0x3f7a2a),
    paint(new THREE.IcosahedronGeometry(0.06, 0).scale(1, 0.6, 1).translate(0, 0.33, 0), 0xffffff),
  ]);
}
