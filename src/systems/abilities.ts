// Habilidades únicas dos personagens (data/abilities.ts): ativação, efeitos que
// duram e o que acontece a cada tick. Roda na simulação, igual para jogador e bots.
import type { Simulation } from '../core/Simulation';
import { ABILITY_TUNING as T, getAbility } from '../data/abilities';
import { getCharacter } from '../data/characters';
import { MOVEMENT } from '../data/movement';
import { isAlive, type CharacterState } from '../entities/CharacterState';
import type { InputCommand } from '../entities/InputCommand';
import { applyDamage } from './combat';
import { groundHeightAt, raycastColliders } from './collision';

export function stepAbility(sim: Simulation, c: CharacterState, cmd: InputCommand, dt: number): void {
  const def = getAbility(c.characterId);
  c.abilityCooldown = Math.max(0, c.abilityCooldown - dt);
  if (c.abilityActive > 0) {
    c.abilityActive = Math.max(0, c.abilityActive - dt);
    // Regeneração: cura um pouco a cada tick enquanto dura.
    if (def.kind === 'regen' && isAlive(c)) {
      const max = getCharacter(c.characterId).maxHealth;
      c.health = Math.min(max, c.health + (T.regenTotal / def.duration) * dt);
    }
    if (c.abilityActive === 0 && def.kind === 'shield') c.shield = 0;
  }
  c.glide = Math.max(0, c.glide - dt);
  if (c.dashTime > 0 && def.kind === 'charge' && !c.dashHit) chargeBite(sim, c);

  if (!cmd.ability || c.abilityCooldown > 0 || !isAlive(c) || sim.state.match.ended) return;
  c.abilityCooldown = def.cooldown;
  c.abilityActive = def.duration;
  const p = c.position;
  // Frente da mira no chão e direção em que anda.
  const fx = -Math.sin(c.aimYaw);
  const fz = -Math.cos(c.aimYaw);
  let mx = fx * cmd.forward + Math.cos(c.aimYaw) * cmd.right;
  let mz = fz * cmd.forward - Math.sin(c.aimYaw) * cmd.right;
  const ml = Math.hypot(mx, mz);
  if (ml < 0.1) {
    mx = fx;
    mz = fz;
  } else {
    mx /= ml;
    mz /= ml;
  }
  const from = { x: p.x, y: p.y, z: p.z };

  switch (def.kind) {
    case 'shield':
      c.shield = T.shieldAmount;
      break;
    case 'dash':
      c.dashTime = def.duration;
      c.dashVel = { x: mx * T.dashSpeed, z: mz * T.dashSpeed };
      break;
    case 'charge':
      c.dashTime = def.duration;
      c.dashVel = { x: fx * T.chargeSpeed, z: fz * T.chargeSpeed };
      c.dashHit = false;
      break;
    case 'jetpack':
      c.velocity.y = T.jetpackVelocity;
      c.grounded = false;
      c.airTime = MOVEMENT.coyoteTime;
      c.glide = def.duration + 1.4;
      break;
    case 'emp':
      emp(sim, c);
      break;
    case 'blink':
      blink(sim, c, fx, fz);
      break;
    default:
      break; // lifesteal, hawkeye, regen, bonearmor: só a duração (abilityActive)
  }
  sim.emit({ type: 'ability', ownerId: c.id, kind: def.kind, from, to: { x: p.x, y: p.y, z: p.z } });
}

/** Pulso EMP: dano e lentidão em todos os inimigos (e mobs) por perto. */
function emp(sim: Simulation, c: CharacterState): void {
  const p = c.position;
  const r2 = T.empRadius * T.empRadius;
  for (const o of sim.state.characters) {
    if (o === c || !isAlive(o)) continue;
    const d2 = (o.position.x - p.x) ** 2 + (o.position.z - p.z) ** 2;
    if (d2 > r2 || Math.abs(o.position.y - p.y) > 4) continue;
    o.slowTimer = Math.max(o.slowTimer, T.empSlow);
    applyDamage(sim, o.id, 'character', T.empDamage, false, c.id, { x: o.position.x, y: o.position.y + 1, z: o.position.z });
  }
  for (const m of sim.state.mobs) {
    if (m.mode === 'dead') continue;
    const d2 = (m.position.x - p.x) ** 2 + (m.position.z - p.z) ** 2;
    if (d2 > r2) continue;
    m.slowTimer = Math.max(m.slowTimer, T.empSlow);
    applyDamage(sim, m.id, 'mob', T.empDamage, false, c.id, { x: m.position.x, y: m.position.y + 0.8, z: m.position.z });
  }
}

/** Investida: morde o primeiro inimigo que encostar durante a corrida. */
function chargeBite(sim: Simulation, c: CharacterState): void {
  const p = c.position;
  const reach = getCharacter(c.characterId).radius + T.chargeReach;
  for (const o of sim.state.characters) {
    if (o === c || !isAlive(o)) continue;
    if (Math.hypot(o.position.x - p.x, o.position.z - p.z) > reach || Math.abs(o.position.y - p.y) > 2) continue;
    c.dashHit = true;
    c.dashTime = 0;
    applyDamage(sim, o.id, 'character', T.chargeDamage, false, c.id, { x: o.position.x, y: o.position.y + 1.1, z: o.position.z });
    return;
  }
  for (const m of sim.state.mobs) {
    if (m.mode === 'dead' || Math.hypot(m.position.x - p.x, m.position.z - p.z) > reach) continue;
    c.dashHit = true;
    c.dashTime = 0;
    applyDamage(sim, m.id, 'mob', T.chargeDamage, false, c.id, { x: m.position.x, y: m.position.y + 0.6, z: m.position.z });
    return;
  }
}

/** Teleporte: até `blinkDistance` m à frente, parando antes de paredes, em cima do chão. */
function blink(sim: Simulation, c: CharacterState, fx: number, fz: number): void {
  const p = c.position;
  const def = getCharacter(c.characterId);
  let dist = T.blinkDistance;
  for (const h of [0.5, 1.2, def.height - 0.2]) {
    const hit = raycastColliders(sim.world, p.x, p.y + h, p.z, fx, 0, fz, dist);
    if (hit >= 0) dist = Math.max(0, hit - def.radius - 0.3);
  }
  const b = sim.world.bounds - 2;
  const x = Math.max(-b, Math.min(b, p.x + fx * dist));
  const z = Math.max(-b, Math.min(b, p.z + fz * dist));
  p.x = x;
  p.z = z;
  p.y = groundHeightAt(sim.world, x, z, def.radius, p.y + 1.2, 0);
  c.velocity.x = c.velocity.z = 0;
  c.velocity.y = 0;
  sim.invalidateHitboxes();
}

/**
 * Modifica um dano recebido por `c` (escudo e armadura de ossos). Devolve o dano
 * que sobra para a vida.
 */
export function absorbDamage(c: CharacterState, amount: number): number {
  const def = getAbility(c.characterId);
  if (def.kind === 'bonearmor' && c.abilityActive > 0) amount *= T.bonearmorFactor;
  if (c.shield > 0) {
    const used = Math.min(c.shield, amount);
    c.shield -= used;
    amount -= used;
  }
  return amount;
}

/** Bônus de dano das flechas de `c` (Olhar de Coruja). */
export function abilityDamageScale(c: CharacterState): number {
  return getAbility(c.characterId).kind === 'hawkeye' && c.abilityActive > 0 ? T.hawkeyeDamage : 1;
}

/** Cura por dano causado (Sede de Sangue). */
export function abilityOnDamageDealt(sim: Simulation, ownerId: string, amount: number): void {
  const c = sim.getCharacter(ownerId);
  if (!c || !isAlive(c) || c.abilityActive <= 0 || getAbility(c.characterId).kind !== 'lifesteal') return;
  c.health = Math.min(getCharacter(c.characterId).maxHealth, c.health + amount * T.lifestealFraction);
}
