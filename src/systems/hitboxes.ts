// Hitboxes de tudo que leva dano: corpo (cilindro) + cabeça (esfera).
import type { Vec3 } from '../core/math';
import { getCharacter } from '../data/characters';
import type { CharacterState } from '../entities/CharacterState';
import { DUMMY_HITBOX, type TargetState } from '../entities/TargetState';
import { makeCylinder, rayCollider, type CylinderCollider } from './collision';

export interface Hitbox {
  id: string;
  kind: 'target' | 'character';
  body: CylinderCollider;
  head: { x: number; y: number; z: number; radius: number };
}

export function targetHitbox(t: TargetState): Hitbox {
  const p = t.position;
  const H = DUMMY_HITBOX;
  return {
    id: t.id,
    kind: 'target',
    body: makeCylinder(p.x, p.z, H.bodyRadius, p.y + H.bodyBottom, p.y + H.bodyTop),
    head: { x: p.x, y: p.y + H.headY, z: p.z, radius: H.headRadius },
  };
}

export function characterHitbox(c: CharacterState): Hitbox {
  const def = getCharacter(c.characterId);
  const p = c.position;
  const headR = 0.13 * (def.height / 1.8) + 0.04;
  return {
    id: c.id,
    kind: 'character',
    body: makeCylinder(p.x, p.z, def.radius, p.y, p.y + def.height * 0.83),
    head: { x: p.x, y: p.y + def.height * 0.92, z: p.z, radius: headR },
  };
}

/** Distância até a esfera ao longo do raio (dir normalizado), ou -1. */
export function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cy: number, cz: number, r: number, maxDist: number): number {
  const lx = ox - cx;
  const ly = oy - cy;
  const lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 && t <= maxDist ? t : -1;
}

export interface HitboxHit {
  hitbox: Hitbox;
  distance: number;
  headshot: boolean;
}

/** Raycast contra uma lista de hitboxes. `pad` engorda as formas (raio da flecha). */
export function raycastHitboxes(hitboxes: Hitbox[], o: Vec3, d: Vec3, maxDist: number, pad: number, ignoreId: string | null): HitboxHit | null {
  let best: HitboxHit | null = null;
  let bestDist = maxDist;
  for (const hb of hitboxes) {
    if (hb.id === ignoreId) continue;
    const h = hb.head;
    const th = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, h.x, h.y, h.z, h.radius + pad, bestDist);
    if (th >= 0 && th <= bestDist) {
      bestDist = th;
      best = { hitbox: hb, distance: th, headshot: true };
    }
    const body = pad > 0 ? { ...hb.body, radius: hb.body.radius + pad, bound: hb.body.bound + pad } : hb.body;
    const tb = rayCollider(body, o.x, o.y, o.z, d.x, d.y, d.z, bestDist);
    if (tb >= 0 && tb < bestDist) {
      bestDist = tb;
      best = { hitbox: hb, distance: tb, headshot: false };
    }
  }
  return best;
}
