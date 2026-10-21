// Dano, abates e volta dos alvos de treino.
import type { Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { COMBAT } from '../data/combat';

export function applyDamage(sim: Simulation, targetId: string, kind: 'target' | 'character', damage: number, headshot: boolean, ownerId: string, position: Vec3): void {
  const amount = Math.round(damage * (headshot ? COMBAT.headshotMultiplier : 1));
  sim.emit({ type: 'hit', ownerId, targetId, damage: amount, headshot, position: { ...position } });

  if (kind === 'target') {
    const t = sim.state.targets.find((x) => x.id === targetId);
    if (!t || t.respawnTimer > 0) return;
    t.health = Math.max(0, t.health - amount);
    if (t.health === 0) {
      t.respawnTimer = COMBAT.dummyRespawnTime;
      sim.emit({ type: 'kill', ownerId, targetId });
      // As flechas cravadas no boneco caem junto.
      sim.state.arrows = sim.state.arrows.filter((a) => a.stuckToTarget !== targetId);
    }
  } else {
    const c = sim.getCharacter(targetId);
    if (!c) return;
    c.health = Math.max(0, c.health - amount);
    // Eliminação de personagens: etapa 3.
  }
}

export function stepTargets(sim: Simulation, dt: number): void {
  for (const t of sim.state.targets) {
    if (t.respawnTimer <= 0) continue;
    t.respawnTimer -= dt;
    if (t.respawnTimer <= 0) {
      t.respawnTimer = 0;
      t.health = t.maxHealth;
      sim.emit({ type: 'respawn', targetId: t.id });
    }
  }
}
