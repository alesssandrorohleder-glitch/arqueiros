// Voo das flechas: gravidade e colisão contínua (testa o trecho percorrido a
// cada tick, então flechas rápidas não atravessam nada), mais os efeitos
// especiais dos arcos: perfurante, ricochete, gelo e explosiva.
import type { Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { COMBAT, EFFECTS } from '../data/combat';
import type { ArrowState } from '../entities/ArrowState';
import { raycast, surfaceNormal } from './collision';
import { applyDamage } from './combat';
import { raycastHitboxes, type Hitbox } from './hitboxes';

export function stepArrows(sim: Simulation, dt: number): void {
  const hitboxes = sim.hitboxes();
  const remove = new Set<number>();

  for (const a of sim.state.arrows) {
    a.age += dt;
    if (a.stuck) {
      if (a.age > COMBAT.stuckArrowLifetime) remove.add(a.id);
      continue;
    }

    a.velocity.y -= COMBAT.arrowGravity * dt;
    const o = a.position;
    const dx = a.velocity.x * dt;
    const dy = a.velocity.y * dt;
    const dz = a.velocity.z * dt;
    const len = Math.hypot(dx, dy, dz);
    const dir = { x: dx / len, y: dy / len, z: dz / len };

    let best = len;
    const wh = raycast(sim.world, o.x, o.y, o.z, dir.x, dir.y, dir.z, len);
    if (wh) best = wh.distance;
    // Não acerta quem atirou nem quem já foi atravessado por esta flecha.
    const candidates = a.hitIds.length ? hitboxes.filter((h) => !a.hitIds.includes(h.id)) : hitboxes;
    const hh = raycastHitboxes(candidates, o, dir, best, COMBAT.arrowRadius, a.ownerId);
    const at = (d: number): Vec3 => ({ x: o.x + dir.x * d, y: o.y + dir.y * d, z: o.z + dir.z * d });

    if (hh) {
      const point = at(hh.distance);
      hitTarget(sim, a, hh.hitbox, hh.headshot, point);
      if (a.effect === 'explosive') {
        explode(sim, a, point, hh.hitbox.id);
        remove.add(a.id);
      } else if (a.effect === 'piercing' && a.pierceLeft > 0) {
        // Atravessa: segue voando um pouco à frente, com menos dano.
        a.pierceLeft--;
        a.damage *= EFFECTS.piercingDamageKeep;
        a.position = at(hh.distance + 0.05);
      } else if (hh.hitbox.kind === 'character') {
        remove.add(a.id); // em personagens a flecha some
      } else {
        stick(sim, a, point, dir, hh.hitbox.id);
      }
      continue;
    }

    if (wh) {
      const point = at(wh.distance);
      if (a.effect === 'explosive') {
        explode(sim, a, point, null);
        remove.add(a.id);
      } else if (a.effect === 'ricochet' && a.bouncesLeft > 0) {
        // Quica: reflete a velocidade na normal da superfície.
        const n = surfaceNormal(sim.world, wh.collider, point);
        const v = a.velocity;
        const vn = v.x * n.x + v.y * n.y + v.z * n.z;
        const k = EFFECTS.ricochetSpeedKeep;
        a.velocity = { x: (v.x - 2 * vn * n.x) * k, y: (v.y - 2 * vn * n.y) * k, z: (v.z - 2 * vn * n.z) * k };
        a.position = { x: point.x + n.x * 0.05, y: point.y + n.y * 0.05, z: point.z + n.z * 0.05 };
        a.bouncesLeft--;
        a.damage *= EFFECTS.ricochetDamageKeep;
        a.hitIds = []; // depois de quicar pode acertar de novo quem já acertou
        sim.emit({ type: 'ricochet', position: { ...point } });
      } else {
        stick(sim, a, point, dir, null);
      }
      continue;
    }

    a.position = at(len);
    if (a.age > COMBAT.arrowMaxFlightTime || a.position.y < -50) remove.add(a.id);
  }

  // Limite de flechas cravadas: remove as mais antigas.
  const stuck = sim.state.arrows.filter((a) => a.stuck && !remove.has(a.id));
  if (stuck.length > COMBAT.maxStuckArrows) {
    stuck.sort((x, y) => y.age - x.age);
    for (let i = 0; i < stuck.length - COMBAT.maxStuckArrows; i++) remove.add(stuck[i].id);
  }
  if (remove.size) sim.state.arrows = sim.state.arrows.filter((a) => !remove.has(a.id));
}

function stick(sim: Simulation, a: ArrowState, point: Vec3, dir: Vec3, targetId: string | null): void {
  sim.emit({ type: 'arrowStuck', arrowId: a.id, position: { ...point }, dir: { ...dir }, targetId, rarity: a.rarity, trail: a.trail });
  a.position = point;
  a.stuck = true;
  a.stuckDir = dir;
  a.stuckToTarget = targetId;
  a.age = 0;
  a.velocity = { x: 0, y: 0, z: 0 };
}

function hitTarget(sim: Simulation, a: ArrowState, hb: Hitbox, headshot: boolean, point: Vec3): void {
  a.hitIds.push(hb.id);
  applyDamage(sim, hb.id, hb.kind, a.damage, headshot, a.ownerId, point);
  if (a.effect === 'frost') applyFrost(sim, hb, point);
}

/** Flecha de gelo: deixa personagens e mobs mais lentos. */
function applyFrost(sim: Simulation, hb: Hitbox, point: Vec3): void {
  if (hb.kind === 'character') {
    const c = sim.getCharacter(hb.id);
    if (c && c.health > 0) c.slowTimer = EFFECTS.frostDuration;
  } else if (hb.kind === 'mob') {
    const m = sim.state.mobs.find((x) => x.id === hb.id);
    if (m && m.mode !== 'dead') m.slowTimer = EFFECTS.frostDuration;
  }
  sim.emit({ type: 'frost', targetId: hb.id, position: { ...point } });
}

/** Explosão: dano em área que cai com a distância (quem atirou não se fere). */
function explode(sim: Simulation, a: ArrowState, point: Vec3, directHitId: string | null): void {
  const R = EFFECTS.explosionRadius;
  sim.emit({ type: 'explosion', position: { ...point }, radius: R });
  for (const hb of sim.hitboxes()) {
    if (hb.id === a.ownerId || hb.id === directHitId) continue;
    const b = hb.body;
    const cy = (b.minY + b.maxY) / 2;
    const d = Math.max(0, Math.hypot(b.x - point.x, cy - point.y, b.z - point.z) - b.radius);
    if (d >= R) continue;
    const dmg = a.damage * EFFECTS.explosionDamageFraction * (1 - d / R);
    applyDamage(sim, hb.id, hb.kind, dmg, false, a.ownerId, { x: b.x, y: cy, z: b.z });
  }
}
