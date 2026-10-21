// Colisão simples e determinística: o cenário é feito de caixas (que podem
// girar no eixo Y) e cilindros verticais, mais o terreno (Heightfield).
// Personagens são cilindros verticais. Também há raycast, usado pela câmera
// e, na etapa 2, pelas flechas.

import type { Heightfield } from '../world/Heightfield';

export interface BoxCollider {
  kind: 'box';
  x: number;
  z: number;
  /** Meia largura (eixo X local) e meia profundidade (eixo Z local). */
  hx: number;
  hz: number;
  /** Rotação no eixo Y (mesma convenção de Object3D.rotation.y). */
  rotation: number;
  cos: number;
  sin: number;
  minY: number;
  maxY: number;
  /** Raio do círculo que envolve a caixa (filtro rápido). */
  bound: number;
}

export interface CylinderCollider {
  kind: 'cylinder';
  x: number;
  z: number;
  radius: number;
  minY: number;
  maxY: number;
  bound: number;
}

export type Collider = BoxCollider | CylinderCollider;

export interface CollisionWorld {
  terrain: Heightfield;
  colliders: Collider[];
  /** Limite da área jogável (|x| e |z| não passam disso). */
  bounds: number;
}

export function makeBox(x: number, z: number, width: number, depth: number, rotation: number, minY: number, maxY: number): BoxCollider {
  const hx = width / 2;
  const hz = depth / 2;
  return {
    kind: 'box', x, z, hx, hz, rotation,
    cos: Math.cos(rotation), sin: Math.sin(rotation),
    minY, maxY, bound: Math.sqrt(hx * hx + hz * hz),
  };
}

export function makeCylinder(x: number, z: number, radius: number, minY: number, maxY: number): CylinderCollider {
  return { kind: 'cylinder', x, z, radius, minY, maxY, bound: radius };
}

// Conversão mundo <-> local da caixa (rotação em Y no estilo Three.js).
function toLocalX(b: BoxCollider, dx: number, dz: number) { return b.cos * dx - b.sin * dz; }
function toLocalZ(b: BoxCollider, dx: number, dz: number) { return b.sin * dx + b.cos * dz; }
function toWorldX(b: BoxCollider, lx: number, lz: number) { return b.cos * lx + b.sin * lz; }
function toWorldZ(b: BoxCollider, lx: number, lz: number) { return -b.sin * lx + b.cos * lz; }

/** O círculo (x, z, r) encosta na projeção do colisor no chão? */
export function circleOverlapsFootprint(c: Collider, x: number, z: number, r: number): boolean {
  const dx = x - c.x;
  const dz = z - c.z;
  const reach = c.bound + r;
  if (dx * dx + dz * dz > reach * reach) return false;
  if (c.kind === 'cylinder') return true;
  const lx = toLocalX(c, dx, dz);
  const lz = toLocalZ(c, dx, dz);
  const qx = lx - Math.max(-c.hx, Math.min(c.hx, lx));
  const qz = lz - Math.max(-c.hz, Math.min(c.hz, lz));
  return qx * qx + qz * qz < r * r;
}

/**
 * Empurra um círculo para fora do colisor no plano XZ.
 * Retorna o deslocamento aplicado (0, 0 se não havia sobreposição).
 */
function pushOut(c: Collider, x: number, z: number, r: number, out: { x: number; z: number }): boolean {
  const dx = x - c.x;
  const dz = z - c.z;
  const reach = c.bound + r;
  if (dx * dx + dz * dz >= reach * reach) return false;

  if (c.kind === 'cylinder') {
    const d = Math.sqrt(dx * dx + dz * dz);
    const pen = c.radius + r - d;
    if (pen <= 0) return false;
    if (d < 1e-6) { out.x = pen; out.z = 0; return true; }
    out.x = (dx / d) * pen;
    out.z = (dz / d) * pen;
    return true;
  }

  const lx = toLocalX(c, dx, dz);
  const lz = toLocalZ(c, dx, dz);
  const cx = Math.max(-c.hx, Math.min(c.hx, lx));
  const cz = Math.max(-c.hz, Math.min(c.hz, lz));
  let px = lx - cx;
  let pz = lz - cz;
  const d2 = px * px + pz * pz;
  if (d2 >= r * r) return false;
  let mx: number;
  let mz: number;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const pen = r - d;
    mx = (px / d) * pen;
    mz = (pz / d) * pen;
  } else {
    // Centro dentro da caixa: sai pelo lado mais próximo.
    const penX = c.hx - Math.abs(lx) + r;
    const penZ = c.hz - Math.abs(lz) + r;
    if (penX < penZ) { mx = Math.sign(lx || 1) * penX; mz = 0; }
    else { mx = 0; mz = Math.sign(lz || 1) * penZ; }
  }
  out.x = toWorldX(c, mx, mz);
  out.z = toWorldZ(c, mx, mz);
  return true;
}

const tmpPush = { x: 0, z: 0 };

/**
 * Resolve a colisão horizontal de um personagem (cilindro). Colisores cujo topo
 * está abaixo de `feetY + stepHeight` são ignorados (o personagem sobe neles).
 * Retorna a soma dos empurrões, útil para zerar a velocidade contra a parede.
 */
export function resolveCharacterHorizontal(
  world: CollisionWorld,
  pos: { x: number; y: number; z: number },
  radius: number,
  height: number,
  stepHeight: number,
): { x: number; z: number } {
  let totalX = 0;
  let totalZ = 0;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const c of world.colliders) {
      if (c.maxY <= pos.y + stepHeight || c.minY >= pos.y + height) continue;
      if (pushOut(c, pos.x, pos.z, radius, tmpPush)) {
        pos.x += tmpPush.x;
        pos.z += tmpPush.z;
        totalX += tmpPush.x;
        totalZ += tmpPush.z;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const b = world.bounds - radius;
  if (pos.x > b) { totalX += b - pos.x; pos.x = b; }
  if (pos.x < -b) { totalX += -b - pos.x; pos.x = -b; }
  if (pos.z > b) { totalZ += b - pos.z; pos.z = b; }
  if (pos.z < -b) { totalZ += -b - pos.z; pos.z = -b; }
  return { x: totalX, z: totalZ };
}

/** Altura do chão sob o personagem: terreno ou topo de algo em que ele pode pisar. */
export function groundHeightAt(world: CollisionWorld, x: number, z: number, radius: number, feetY: number, stepHeight: number): number {
  let h = world.terrain.sample(x, z);
  // Considera só metade do raio para não "flutuar" na quina dos objetos.
  const footR = radius * 0.6;
  for (const c of world.colliders) {
    if (c.maxY > feetY + stepHeight || c.maxY <= h) continue;
    if (circleOverlapsFootprint(c, x, z, footR)) h = c.maxY;
  }
  return h;
}

/** Altura do teto acima do personagem (Infinity se não houver). */
export function ceilingHeightAt(world: CollisionWorld, x: number, z: number, radius: number, headY: number): number {
  let h = Infinity;
  for (const c of world.colliders) {
    if (c.minY < headY - 0.05 || c.minY >= h) continue;
    if (circleOverlapsFootprint(c, x, z, radius * 0.8)) h = c.minY;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Raycast

/** Interseção de um raio com o intervalo [min, max] num eixo (método das placas). */
function slab(o: number, d: number, min: number, max: number, t: { near: number; far: number }): boolean {
  if (Math.abs(d) < 1e-9) return o >= min && o <= max;
  let t0 = (min - o) / d;
  let t1 = (max - o) / d;
  if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
  if (t0 > t.near) t.near = t0;
  if (t1 < t.far) t.far = t1;
  return t.near <= t.far;
}

const tSpan = { near: 0, far: 0 };

/** Distância até o colisor ao longo do raio (dir normalizado), ou -1. */
export function rayCollider(c: Collider, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): number {
  tSpan.near = 0;
  tSpan.far = maxDist;
  if (!slab(oy, dy, c.minY, c.maxY, tSpan)) return -1;
  const rx = ox - c.x;
  const rz = oz - c.z;
  if (c.kind === 'box') {
    const lox = toLocalX(c, rx, rz);
    const loz = toLocalZ(c, rx, rz);
    const ldx = toLocalX(c, dx, dz);
    const ldz = toLocalZ(c, dx, dz);
    if (!slab(lox, ldx, -c.hx, c.hx, tSpan)) return -1;
    if (!slab(loz, ldz, -c.hz, c.hz, tSpan)) return -1;
    return tSpan.near;
  }
  // Cilindro infinito no plano XZ.
  const a = dx * dx + dz * dz;
  const b = 2 * (rx * dx + rz * dz);
  const cc = rx * rx + rz * rz - c.radius * c.radius;
  if (a < 1e-9) {
    if (cc > 0) return -1;
  } else {
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc);
    const t0 = (-b - sq) / (2 * a);
    const t1 = (-b + sq) / (2 * a);
    if (t0 > tSpan.near) tSpan.near = t0;
    if (t1 < tSpan.far) tSpan.far = t1;
    if (tSpan.near > tSpan.far) return -1;
  }
  return tSpan.near;
}

export interface RayHit {
  distance: number;
  /** null = terreno. */
  collider: Collider | null;
}

/** Raycast contra colisores e terreno. `dir` deve estar normalizado. */
export function raycast(world: CollisionWorld, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): RayHit | null {
  let best = maxDist;
  let hit: Collider | null | undefined;
  for (const c of world.colliders) {
    const t = rayCollider(c, ox, oy, oz, dx, dy, dz, best);
    if (t >= 0 && t < best) { best = t; hit = c; }
  }
  // Terreno: marcha em passos e refina por bisseção.
  const step = 0.5;
  let prevT = 0;
  if (oy > world.terrain.sample(ox, oz)) {
    for (let t = step; t <= best + step; t += step) {
      const tt = Math.min(t, best);
      const above = oy + dy * tt - world.terrain.sample(ox + dx * tt, oz + dz * tt) > 0;
      if (!above) {
        let lo = prevT;
        let hi = tt;
        for (let k = 0; k < 8; k++) {
          const mid = (lo + hi) / 2;
          if (oy + dy * mid - world.terrain.sample(ox + dx * mid, oz + dz * mid) > 0) lo = mid;
          else hi = mid;
        }
        if (hi < best) { best = hi; hit = null; }
        break;
      }
      prevT = tt;
      if (tt >= best) break;
    }
  }
  return hit === undefined ? null : { distance: best, collider: hit };
}

/** Raycast só contra os colisores (sem terreno). Distância ou -1. */
export function raycastColliders(world: CollisionWorld, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): number {
  let best = -1;
  let limit = maxDist;
  for (const c of world.colliders) {
    // Filtro rápido: o colisor está perto do segmento?
    const ex = c.x - ox;
    const ez = c.z - oz;
    const along = ex * dx + ez * dz;
    if (along < -c.bound || along > limit + c.bound) continue;
    const t = rayCollider(c, ox, oy, oz, dx, dy, dz, limit);
    if (t >= 0 && t < limit) {
      limit = t;
      best = t;
    }
  }
  return best;
}

/** Normal da superfície atingida num ponto (para o ricochete). `collider` null = terreno. */
export function surfaceNormal(world: CollisionWorld, collider: Collider | null, p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  if (!collider) {
    const e = 0.5;
    const t = world.terrain;
    const nx = -(t.sample(p.x + e, p.z) - t.sample(p.x - e, p.z)) / (2 * e);
    const nz = -(t.sample(p.x, p.z + e) - t.sample(p.x, p.z - e)) / (2 * e);
    const l = Math.hypot(nx, 1, nz);
    return { x: nx / l, y: 1 / l, z: nz / l };
  }
  if (collider.kind === 'cylinder') {
    if (p.y >= collider.maxY - 0.05) return { x: 0, y: 1, z: 0 };
    const dx = p.x - collider.x;
    const dz = p.z - collider.z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, y: 0, z: dz / l };
  }
  const b = collider;
  const lx = toLocalX(b, p.x - b.x, p.z - b.z);
  const lz = toLocalZ(b, p.x - b.x, p.z - b.z);
  const faces = [
    { d: b.hx - Math.abs(lx), n: [Math.sign(lx) || 1, 0, 0] },
    { d: b.hz - Math.abs(lz), n: [0, 0, Math.sign(lz) || 1] },
    { d: b.maxY - p.y, n: [0, 1, 0] },
    { d: p.y - b.minY, n: [0, -1, 0] },
  ];
  faces.sort((a, c) => a.d - c.d);
  const [nx, ny, nz] = faces[0].n;
  return { x: toWorldX(b, nx, nz), y: ny, z: toWorldZ(b, nx, nz) };
}
