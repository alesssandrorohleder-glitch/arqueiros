// Flechas visuais: o acerto já foi decidido no disparo (systems/hitscan.ts);
// aqui a flecha só voa rápido pelo caminho do tiro e crava no fim.
import type { Simulation } from '../core/Simulation';
import { COMBAT } from '../data/combat';

export function stepArrows(sim: Simulation, dt: number): void {
  const remove = new Set<number>();
  for (const a of sim.state.arrows) {
    a.age += dt;
    if (a.stuck) {
      if (a.age > COMBAT.stuckArrowLifetime) remove.add(a.id);
      continue;
    }
    // Anda pelo caminho na velocidade do traçado.
    let step = COMBAT.tracerSpeed * dt;
    while (step > 0 && a.path.length) {
      const target = a.path[0];
      const dx = target.x - a.position.x;
      const dy = target.y - a.position.y;
      const dz = target.z - a.position.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 1e-6) a.velocity = { x: (dx / d) * COMBAT.tracerSpeed, y: (dy / d) * COMBAT.tracerSpeed, z: (dz / d) * COMBAT.tracerSpeed };
      if (d <= step) {
        a.position = { ...target };
        a.path.shift();
        step -= d;
      } else {
        a.position = { x: a.position.x + (dx / d) * step, y: a.position.y + (dy / d) * step, z: a.position.z + (dz / d) * step };
        step = 0;
      }
    }
    if (!a.path.length) {
      if (!a.endStick) {
        remove.add(a.id);
        continue;
      }
      const v = a.velocity;
      const l = Math.hypot(v.x, v.y, v.z) || 1;
      a.stuck = true;
      a.stuckDir = { x: v.x / l, y: v.y / l, z: v.z / l };
      a.age = 0;
      a.velocity = { x: 0, y: 0, z: 0 };
      sim.emit({ type: 'arrowStuck', arrowId: a.id, position: { ...a.position }, dir: a.stuckDir, targetId: a.stuckToTarget, rarity: a.rarity, trail: a.trail });
    }
  }

  // Limite de flechas cravadas: remove as mais antigas.
  const stuck = sim.state.arrows.filter((a) => a.stuck && !remove.has(a.id));
  if (stuck.length > COMBAT.maxStuckArrows) {
    stuck.sort((x, y) => y.age - x.age);
    for (let i = 0; i < stuck.length - COMBAT.maxStuckArrows; i++) remove.add(stuck[i].id);
  }
  if (remove.size) sim.state.arrows = sim.state.arrows.filter((a) => !remove.has(a.id));
}
