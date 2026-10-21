// Mobs: surgimento nos pontos de spawn, comportamento (vagar, perseguir,
// atacar corpo a corpo, voltar para casa) e movimento com colisão.
import { approachAngle, clamp, lerp } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { EFFECTS } from '../data/combat';
import { MATCH } from '../data/match';
import { MOB_SPAWNING, MOBS, type MobDef } from '../data/mobs';
import { isAlive, type CharacterState } from '../entities/CharacterState';
import type { MobState } from '../entities/MobState';
import { applyDamage } from './combat';
import { groundHeightAt, raycastColliders, resolveCharacterHorizontal } from './collision';

const GRAVITY = 22;
const ACCEL = 18;
const TURN_SPEED = 7;
const STEP_HEIGHT = 0.5;

export const mobAlive = (m: MobState) => m.mode !== 'dead';

/** Cria mobs nos pontos de spawn, num ritmo que acelera ao longo da partida. */
export function stepMobSpawning(sim: Simulation, dt: number): void {
  const spawns = sim.map.mobSpawns;
  const elapsed = MATCH.duration - sim.state.match.timeLeft;
  const interval = lerp(MOB_SPAWNING.intervalStart, MOB_SPAWNING.intervalEnd, clamp(elapsed / MATCH.duration, 0, 1));
  const aliveTotal = sim.state.mobs.filter(mobAlive).length;
  spawns.forEach((sp, i) => {
    sim.mobSpawnTimers[i] -= dt;
    if (sim.mobSpawnTimers[i] > 0) return;
    sim.mobSpawnTimers[i] = interval * sim.rng.range(0.8, 1.2);
    const here = sim.state.mobs.filter((m) => mobAlive(m) && m.spawnIndex === i).length;
    if (here >= sp.max || aliveTotal >= MOB_SPAWNING.globalMax) return;
    const typeId = sim.rng.pick(sp.types);
    const a = sim.rng.range(0, Math.PI * 2);
    const d = sim.rng.range(0, sp.radius);
    const x = sp.x + Math.cos(a) * d;
    const z = sp.z + Math.sin(a) * d;
    const def = MOBS[typeId];
    const m: MobState = {
      id: `mob-${sim.allocId()}`,
      typeId,
      position: { x, y: sim.world.terrain.sample(x, z) + 0.2, z },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: sim.rng.range(-Math.PI, Math.PI),
      health: def.maxHealth,
      mode: 'idle',
      targetId: null,
      spawnIndex: i,
      home: { x: sp.x, z: sp.z },
      wanderTo: null,
      timer: sim.rng.range(0.5, 2),
      attackCooldown: 0,
      grounded: false,
      lastAttackerId: null,
      slowTimer: 0,
    };
    sim.state.mobs.push(m);
  });
}

export function stepMobs(sim: Simulation, dt: number): void {
  const remove = new Set<string>();
  for (const m of sim.state.mobs) {
    const def = MOBS[m.typeId];
    if (m.mode === 'dead') {
      m.timer -= dt;
      if (m.timer <= 0) remove.add(m.id);
      continue;
    }
    think(sim, m, def, dt);
    move(sim, m, def, dt);
  }
  if (remove.size) sim.state.mobs = sim.state.mobs.filter((m) => !remove.has(m.id));
}

/** Mob levou dano: neutros e hostis passam a perseguir quem atacou. */
export function provokeMob(sim: Simulation, m: MobState, attackerId: string): void {
  const attacker = sim.getCharacter(attackerId);
  if (!attacker || !isAlive(attacker)) return;
  m.targetId = attackerId;
  if (m.mode !== 'attack') m.mode = 'chase';
}

function dist2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function think(sim: Simulation, m: MobState, def: MobDef, dt: number): void {
  m.attackCooldown = Math.max(0, m.attackCooldown - dt);
  let target: CharacterState | undefined = m.targetId ? sim.getCharacter(m.targetId) : undefined;
  if (target && !isAlive(target)) {
    target = undefined;
    m.targetId = null;
  }

  // Longe demais de casa: desiste e volta.
  if (m.mode !== 'return' && dist2D(m.position, m.home) > def.leashRange) {
    m.mode = 'return';
    m.targetId = null;
    target = undefined;
  }

  // Hostil procura alguém por perto.
  if (!target && def.behavior === 'hostile' && m.mode !== 'return') {
    let best: CharacterState | undefined;
    let bestD = def.aggroRange;
    for (const c of sim.state.characters) {
      if (!isAlive(c) || c.protection > 0) continue;
      const d = dist2D(c.position, m.position);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) {
      target = best;
      m.targetId = best.id;
      m.mode = 'chase';
    }
  }

  switch (m.mode) {
    case 'idle':
      m.timer -= dt;
      if (m.timer <= 0) {
        const a = sim.rng.range(0, Math.PI * 2);
        const d = sim.rng.range(3, 12);
        m.wanderTo = { x: m.home.x + Math.cos(a) * d, z: m.home.z + Math.sin(a) * d };
        m.mode = 'wander';
      }
      break;
    case 'wander':
      if (!m.wanderTo || dist2D(m.position, m.wanderTo) < 1) {
        m.mode = 'idle';
        m.timer = sim.rng.range(2, 5);
      }
      break;
    case 'return':
      if (dist2D(m.position, m.home) < 3) {
        m.mode = 'idle';
        m.timer = sim.rng.range(1, 3);
        m.health = def.maxHealth; // descansou em casa
      }
      break;
    case 'chase':
      if (!target) {
        m.mode = 'idle';
        m.timer = 1;
      } else if (dist2D(target.position, m.position) <= def.attackRange && m.attackCooldown <= 0) {
        m.mode = 'attack';
        m.timer = def.attackWindup;
        sim.emit({ type: 'mobAttack', mobId: m.id });
      }
      break;
    case 'attack':
      if (target) m.yaw = approachAngle(m.yaw, Math.atan2(-(target.position.x - m.position.x), -(target.position.z - m.position.z)), TURN_SPEED * dt);
      m.timer -= dt;
      if (m.timer <= 0) {
        // Golpe: só acerta se o alvo ainda estiver ao alcance (dá para desviar).
        if (target && dist2D(target.position, m.position) <= def.attackRange * 1.3 && Math.abs(target.position.y - m.position.y) < 2) {
          const hit = { x: target.position.x, y: target.position.y + 1, z: target.position.z };
          applyDamage(sim, target.id, 'character', def.attackDamage, false, m.id, hit);
        }
        m.attackCooldown = def.attackCooldown;
        m.mode = target ? 'chase' : 'idle';
        m.timer = 1;
      }
      break;
  }
}

function move(sim: Simulation, m: MobState, def: MobDef, dt: number): void {
  let goal: { x: number; z: number } | null = null;
  let speed = 0;
  if (m.mode === 'wander' && m.wanderTo) {
    goal = m.wanderTo;
    speed = def.wanderSpeed;
  } else if (m.mode === 'return') {
    goal = m.home;
    speed = def.chaseSpeed * 0.7;
  } else if (m.mode === 'chase' && m.targetId) {
    const t = sim.getCharacter(m.targetId);
    if (t) {
      goal = t.position;
      speed = def.chaseSpeed;
    }
  }

  m.slowTimer = Math.max(0, m.slowTimer - dt);
  if (m.slowTimer > 0) speed *= EFFECTS.frostSlow;
  let vx = 0;
  let vz = 0;
  if (goal) {
    const dx = goal.x - m.position.x;
    const dz = goal.z - m.position.z;
    const d = Math.hypot(dx, dz);
    // Para um pouco antes do alvo ao perseguir.
    const stop = m.mode === 'chase' ? def.attackRange * 0.8 : 0.3;
    if (d > stop) {
      let a = Math.atan2(dz, dx);
      // Desvio simples: se há algo logo à frente, tenta os lados.
      for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
        const ux = Math.cos(a + off);
        const uz = Math.sin(a + off);
        if (raycastColliders(sim.world, m.position.x, m.position.y + 0.5, m.position.z, ux, 0, uz, def.radius + 1.2) < 0) {
          a += off;
          break;
        }
      }
      vx = Math.cos(a) * speed;
      vz = Math.sin(a) * speed;
    }
  }
  const dvx = vx - m.velocity.x;
  const dvz = vz - m.velocity.z;
  const dl = Math.hypot(dvx, dvz);
  const maxDv = ACCEL * dt;
  if (dl <= maxDv) {
    m.velocity.x = vx;
    m.velocity.z = vz;
  } else {
    m.velocity.x += (dvx / dl) * maxDv;
    m.velocity.z += (dvz / dl) * maxDv;
  }
  if (m.mode === 'attack') {
    m.velocity.x *= 0.8;
    m.velocity.z *= 0.8;
  }

  if (!m.grounded) m.velocity.y = Math.max(m.velocity.y - GRAVITY * dt, -40);
  m.position.x += m.velocity.x * dt;
  m.position.z += m.velocity.z * dt;
  resolveCharacterHorizontal(sim.world, m.position, def.radius, def.height, STEP_HEIGHT);
  m.position.y += m.velocity.y * dt;
  const ground = groundHeightAt(sim.world, m.position.x, m.position.z, def.radius, m.position.y, STEP_HEIGHT);
  if (m.position.y <= ground + (m.grounded ? 0.35 : 0)) {
    m.position.y = ground;
    m.velocity.y = 0;
    m.grounded = true;
  } else {
    m.grounded = false;
  }

  const hs = Math.hypot(m.velocity.x, m.velocity.z);
  if (hs > 0.3 && m.mode !== 'attack') m.yaw = approachAngle(m.yaw, Math.atan2(-m.velocity.x, -m.velocity.z), TURN_SPEED * dt);
}
