// Fábricas de geometria low-poly (árvores, pedras, grama). Cada geometria já
// vem com cores por vértice; as instâncias só variam escala, giro e tom.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

/** Junta geometrias (convertendo todas para não indexadas, para sombreamento chapado). */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('uv');
    ng.deleteAttribute('normal');
    return ng;
  });
  const merged = mergeGeometries(flat, false);
  if (!merged) throw new Error('mergeGeometries falhou');
  merged.computeVertexNormals();
  return merged;
}

/** Desloca levemente os vértices (mesma posição = mesmo deslocamento, sem rachaduras). */
function jitter(geo: THREE.BufferGeometry, amount: number, rng: Random): void {
  const pos = geo.getAttribute('position');
  const offsets = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let o = offsets.get(key);
    if (!o) {
      o = [rng.range(-amount, amount), rng.range(-amount, amount), rng.range(-amount, amount)];
      offsets.set(key, o);
    }
    pos.setXYZ(i, pos.getX(i) + o[0], pos.getY(i) + o[1], pos.getZ(i) + o[2]);
  }
}

export function pineGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(new THREE.CylinderGeometry(0.14, 0.22, 1.6, 6).translate(0, 0.8, 0), 0x6b4a2f));
  const layers: [number, number, number, number][] = [
    // raio, altura, y da base, cor
    [1.55, 2.2, 1.1, 0x2f6b3a],
    [1.2, 1.9, 2.3, 0x367a41],
    [0.8, 1.6, 3.4, 0x3f8a49],
  ];
  for (const [r, h, y, color] of layers) {
    parts.push(paint(new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2, 0), color));
  }
  return merge(parts);
}

export function broadleafGeometry(rng: Random): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6).translate(0, 1.2, 0), 0x725036));
  const blobs: [number, number, number, number, number][] = [
    [0, 3.5, 0, 1.7, 0x4f9a3e],
    [0.9, 3.1, 0.4, 1.1, 0x5aa646],
    [-0.8, 3.2, -0.3, 1.2, 0x468c38],
    [0.1, 4.4, -0.2, 1.0, 0x63b04d],
  ];
  for (const [x, y, z, r, color] of blobs) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    jitter(g, r * 0.12, rng);
    parts.push(paint(g.scale(1, 0.85, 1).translate(x, y, z), color));
  }
  return merge(parts);
}

export function rockGeometry(rng: Random): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(1, 0);
  jitter(g, 0.22, rng);
  return merge([paint(g, 0xffffff)]);
}

export function grassGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blades: [number, number, number, number][] = [
    [0, 0, 0.5, 0],
    [0.08, 0.05, 0.38, 0.35],
    [-0.07, 0.04, 0.42, -0.3],
  ];
  for (const [x, z, h, tilt] of blades) {
    parts.push(paint(new THREE.ConeGeometry(0.05, h, 3).translate(0, h / 2, 0).rotateZ(tilt).translate(x, 0, z), 0xffffff));
  }
  return merge(parts);
}

export function flowerGeometry(): THREE.BufferGeometry {
  return merge([
    paint(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 3).translate(0, 0.11, 0), 0x3f7a2a),
    paint(new THREE.IcosahedronGeometry(0.08, 0).translate(0, 0.24, 0), 0xffffff),
  ]);
}

export function cloudGeometry(rng: Random): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = rng.int(4, 7);
  for (let i = 0; i < n; i++) {
    const r = rng.range(4, 9);
    const g = new THREE.IcosahedronGeometry(r, 0);
    parts.push(paint(g.scale(1, 0.55, 1).translate(rng.range(-12, 12), rng.range(-1, 2), rng.range(-6, 6)), 0xffffff));
  }
  return merge(parts);
}
