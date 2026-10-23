// Tiro instantâneo: no momento do disparo, uma linha reta sai do centro da
// mira e o que estiver nela é atingido na hora. Efeitos especiais: perfurante
// (atravessa alvos), ricochete (quica no cenário), explosiva e gelo.
import type { Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import type { BowEffect } from '../data/bows';
import { COMBAT, EFFECTS } from '../data/combat';
import { raycast, surfaceNormal } from './collision';
import { applyDamage } from './combat';
import { raycastHitboxes, type Hitbox } from './hitboxes';

export interface ShotResult {
  /** Pontos por onde o tiro passou (impactos e quiques), na ordem. */
  path: Vec3[];
  /** A flecha visual crava no último ponto? (não crava em personagens) */
  stick: boolean;
  /** Se cravou em alvo/mob, o id dele. */
  stickTarget: string | null;
  /** Direção final (para a flecha cravada ficar na posição certa). */
  dir: Vec3;
}

export function traceShot(sim: Simulation, shooterId: string, from: Vec3, dir: Vec3, damage: number, effect: BowEffect | null): ShotResult {
  const path: Vec3[] = [];
  let o = { ...from };
  let d = { ...dir };
  let remaining = COMBAT.hitscanRange;
  let pierce = effect === 'piercing' ? EFFECTS.piercingCount : 0;
  let bounces = effect === 'ricochet' ? EFFECTS.ricochetBounces : 0;
  let hitIds: string[] = [];
  const at = (t: number): Vec3 => ({ x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t });

  for (let guard = 0; guard < 8; guard++) {
    const wh = raycast(sim.world, o.x, o.y, o.z, d.x, d.y, d.z, remaining);
    const maxD = wh ? wh.distance : remaining;
    // Flechas atravessam aliados (modo Gigantes).
    const candidates = sim.shotHitboxes(shooterId).filter((h) => !hitIds.includes(h.id) && !sim.sameTeam(shooterId, h.id));
    const hh = raycastHitboxes(candidates, o, d, maxD, COMBAT.arrowRadius, shooterId);

    if (hh) {
      const point = at(hh.distance);
      path.push(point);
      hitIds.push(hh.hitbox.id);
      hit(sim, shooterId, hh.hitbox, hh.headshot, damage, effect, point);
      if (effect === 'explosive') {
        explode(sim, shooterId, point, damage, hh.hitbox.id);
        return { path, stick: false, stickTarget: null, dir: d };
      }
      if (pierce > 0) {
        // Atravessa e continua, com menos dano.
        pierce--;
        damage *= EFFECTS.piercingDamageKeep;
        remaining -= hh.distance;
        o = at(hh.distance + 0.05);
        continue;
      }
      const stick = hh.hitbox.kind !== 'character';
      return { path, stick, stickTarget: stick ? hh.hitbox.id : null, dir: d };
    }

    if (wh) {
      const point = at(wh.distance);
      path.push(point);
      if (effect === 'explosive') {
        explode(sim, shooterId, point, damage, null);
        return { path, stick: false, stickTarget: null, dir: d };
      }
      if (bounces > 0) {
        // Quica: reflete na superfície e segue com o alcance que sobrou.
        const n = surfaceNormal(sim.world, wh.collider, point);
        const dn = d.x * n.x + d.y * n.y + d.z * n.z;
        d = { x: d.x - 2 * dn * n.x, y: d.y - 2 * dn * n.y, z: d.z - 2 * dn * n.z };
        o = { x: point.x + n.x * 0.05, y: point.y + n.y * 0.05, z: point.z + n.z * 0.05 };
        remaining -= wh.distance;
        bounces--;
        damage *= EFFECTS.ricochetDamageKeep;
        hitIds = [];
        sim.emit({ type: 'ricochet', position: { ...point } });
        continue;
      }
      return { path, stick: true, stickTarget: null, dir: d };
    }

    // Não acertou nada: a flecha some no horizonte.
    path.push(at(remaining));
    return { path, stick: false, stickTarget: null, dir: d };
  }
  return { path, stick: false, stickTarget: null, dir: d };
}

function hit(sim: Simulation, shooterId: string, hb: Hitbox, headshot: boolean, damage: number, effect: BowEffect | null, point: Vec3): void {
  applyDamage(sim, hb.id, hb.kind, damage, headshot, shooterId, point);
  if (effect !== 'frost') return;
  // Gelo: deixa personagens e mobs mais lentos.
  if (hb.kind === 'character') {
    const c = sim.getCharacter(hb.id);
    if (c && c.health > 0) c.slowTimer = EFFECTS.frostDuration;
  } else if (hb.kind === 'mob' && !sim.sameTeam(shooterId, hb.id)) {
    const m = sim.state.mobs.find((x) => x.id === hb.id);
    if (m && m.mode !== 'dead') m.slowTimer = EFFECTS.frostDuration;
  }
  sim.emit({ type: 'frost', targetId: hb.id, position: { ...point } });
}

/** Explosão: dano em área que cai com a distância (quem atirou não se fere). */
function explode(sim: Simulation, shooterId: string, point: Vec3, damage: number, directHitId: string | null): void {
  const R = EFFECTS.explosionRadius;
  sim.emit({ type: 'explosion', position: { ...point }, radius: R });
  for (const hb of sim.shotHitboxes(shooterId)) {
    if (hb.id === shooterId || hb.id === directHitId || sim.sameTeam(shooterId, hb.id)) continue;
    const b = hb.body;
    const cy = (b.minY + b.maxY) / 2;
    const dist = Math.max(0, Math.hypot(b.x - point.x, cy - point.y, b.z - point.z) - b.radius);
    if (dist >= R) continue;
    applyDamage(sim, hb.id, hb.kind, damage * EFFECTS.explosionDamageFraction * (1 - dist / R), false, shooterId, { x: b.x, y: cy, z: b.z });
  }
}
