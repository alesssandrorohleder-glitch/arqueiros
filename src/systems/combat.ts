// Dano, eliminações e volta (alvos de treino e personagens).
import type { Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { getCharacter } from '../data/characters';
import { COMBAT } from '../data/combat';
import { MATCH } from '../data/match';
import { isAlive, type CharacterState } from '../entities/CharacterState';

export function applyDamage(sim: Simulation, targetId: string, kind: 'target' | 'character', damage: number, headshot: boolean, ownerId: string, position: Vec3): void {
  const amount = Math.round(damage * (headshot ? COMBAT.headshotMultiplier : 1));

  if (kind === 'target') {
    const t = sim.state.targets.find((x) => x.id === targetId);
    if (!t || t.respawnTimer > 0) return;
    sim.emit({ type: 'hit', ownerId, targetId, damage: amount, headshot, position: { ...position } });
    t.health = Math.max(0, t.health - amount);
    if (t.health === 0) {
      t.respawnTimer = COMBAT.dummyRespawnTime;
      sim.emit({ type: 'kill', ownerId, targetId, victimKind: 'target', headshot });
      // As flechas cravadas no boneco caem junto.
      sim.state.arrows = sim.state.arrows.filter((a) => a.stuckToTarget !== targetId);
    }
    return;
  }

  const c = sim.getCharacter(targetId);
  if (!c || !isAlive(c) || sim.state.match.ended) return;
  if (c.protection > 0) return;
  sim.emit({ type: 'hit', ownerId, targetId, damage: amount, headshot, position: { ...position } });
  c.health = Math.max(0, c.health - amount);
  c.lastAttackerId = ownerId;
  sim.notifyDamaged(c, ownerId);
  if (c.health === 0) eliminate(sim, c, ownerId, headshot);
}

function eliminate(sim: Simulation, c: CharacterState, killerId: string, headshot: boolean): void {
  c.deaths++;
  c.respawnTimer = MATCH.respawnDelay;
  c.bow.drawing = false;
  c.bow.drawTime = 0;
  c.velocity.x = 0;
  c.velocity.z = 0;
  const killer = sim.getCharacter(killerId);
  if (killer && killer !== c) killer.kills++;
  sim.emit({ type: 'kill', ownerId: killerId, targetId: c.id, victimKind: 'character', headshot });
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

/** Conta o tempo dos eliminados e da proteção; devolve quem deve voltar agora. */
export function stepCharacterLife(sim: Simulation, dt: number): void {
  for (const c of sim.state.characters) {
    if (c.protection > 0) c.protection = Math.max(0, c.protection - dt);
    if (isAlive(c) || sim.state.match.ended) continue;
    c.respawnTimer -= dt;
    if (c.respawnTimer <= 0) {
      const sp = sim.pickSpawn(c.id);
      c.position = { x: sp.x, y: sim.world.terrain.sample(sp.x, sp.z), z: sp.z };
      c.velocity = { x: 0, y: 0, z: 0 };
      c.health = getCharacter(c.characterId).maxHealth;
      c.respawnTimer = 0;
      c.protection = MATCH.spawnProtection;
      c.lastAttackerId = null;
      c.bodyYaw = c.aimYaw = sp.yaw;
      c.aimPitch = 0;
      sim.emit({ type: 'respawn', targetId: c.id });
    }
  }
}
