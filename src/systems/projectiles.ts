// Voo das flechas: gravidade e colisão contínua (testa o trecho percorrido a
// cada tick, então flechas rápidas não atravessam nada).
import type { Simulation } from '../core/Simulation';
import { COMBAT } from '../data/combat';
import { raycast } from './collision';
import { applyDamage } from './combat';
import { raycastHitboxes } from './hitboxes';

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
    let hitWorld = false;
    const wh = raycast(sim.world, o.x, o.y, o.z, dir.x, dir.y, dir.z, len);
    if (wh) { best = wh.distance; hitWorld = true; }
    const hh = raycastHitboxes(hitboxes, o, dir, best, COMBAT.arrowRadius, a.ownerId);

    if (hh || hitWorld) {
      const d = hh ? hh.distance : best;
      a.position = { x: o.x + dir.x * d, y: o.y + dir.y * d, z: o.z + dir.z * d };
      a.stuck = true;
      a.stuckDir = dir;
      a.age = 0;
      a.velocity = { x: 0, y: 0, z: 0 };
      if (hh) {
        if (hh.hitbox.kind === 'target') a.stuckToTarget = hh.hitbox.id;
        else remove.add(a.id); // em personagens a flecha some (etapa 3 decide o visual)
        applyDamage(sim, hh.hitbox.id, hh.hitbox.kind, a.damage, hh.headshot, a.ownerId, a.position);
      } else {
        sim.emit({ type: 'arrowStuck', arrowId: a.id, position: { ...a.position } });
      }
      continue;
    }

    a.position = { x: o.x + dx, y: o.y + dy, z: o.z + dz };
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
