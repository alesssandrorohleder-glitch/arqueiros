// Dano, eliminações e volta (alvos de treino e personagens).
import type { Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { COMBAT, FRENZY, HASTE } from '../data/combat';
import { MATCH } from '../data/match';
import { MOB_SPAWNING, MOBS } from '../data/mobs';
import { isAlive, type CharacterState } from '../entities/CharacterState';
import { absorbDamage, abilityOnDamageDealt } from './abilities';
import { provokeMob } from './mobs';
import { damageStructure } from './objectives';
import { grantLevelXp, levelDamageScale, maxHealthOf } from './levels';
import { ASSIST, MATCH_LEVELS } from '../data/levels';
import { RESPAWN } from '../data/objectives';

export function applyDamage(sim: Simulation, targetId: string, kind: 'target' | 'character' | 'mob' | 'structure', damage: number, headshot: boolean, ownerId: string, position: Vec3): void {
  // Modo Gigantes: aliados não se ferem.
  if (sim.sameTeam(ownerId, targetId)) return;
  // Nível na partida: personagens mais altos causam mais dano (data/levels.ts).
  const owner = sim.getCharacter(ownerId);
  const amount = Math.round(damage * (headshot ? COMBAT.headshotMultiplier : 1) * (owner ? levelDamageScale(owner) : 1));

  if (kind === 'structure') {
    const s = sim.getStructure(targetId);
    if (s) damageStructure(sim, s, amount, headshot, ownerId, position);
    return;
  }

  if (kind === 'target') {
    const t = sim.state.targets.find((x) => x.id === targetId);
    if (!t || t.respawnTimer > 0) return;
    sim.emit({ type: 'hit', ownerId, targetId, damage: amount, headshot, position: { ...position } });
    t.health = Math.max(0, t.health - amount);
    if (t.health === 0) {
      sim.invalidateHitboxes();
      t.respawnTimer = COMBAT.dummyRespawnTime;
      sim.emit({ type: 'kill', ownerId, targetId, victimKind: 'target', headshot });
      // As flechas cravadas no boneco caem junto.
      sim.state.arrows = sim.state.arrows.filter((a) => a.stuckToTarget !== targetId);
    }
    return;
  }

  if (kind === 'mob') {
    const m = sim.state.mobs.find((x) => x.id === targetId);
    if (!m || m.mode === 'dead') return;
    sim.emit({ type: 'hit', ownerId, targetId, damage: amount, headshot, position: { ...position } });
    m.health = Math.max(0, m.health - amount);
    m.lastAttackerId = ownerId;
    abilityOnDamageDealt(sim, ownerId, amount);
    if (m.health > 0) {
      provokeMob(sim, m, ownerId);
      return;
    }
    // Mob eliminado: XP para quem matou, corpo fica um pouco, talvez deixe um arco.
    const def = MOBS[m.typeId];
    sim.invalidateHitboxes();
    m.mode = 'dead';
    m.timer = MOB_SPAWNING.corpseTime;
    m.velocity.x = m.velocity.z = 0;
    sim.state.arrows = sim.state.arrows.filter((a) => a.stuckToTarget !== m.id);
    sim.emit({ type: 'kill', ownerId, targetId, victimKind: 'mob', headshot });
    const killer = sim.getCharacter(ownerId);
    if (killer) {
      killer.matchXp += def.xp;
      grantLevelXp(sim, killer, def.xp);
      if (!def.minion) killer.mobKills++;
      // Mob especial: dá um poder para quem matou (Fúria ou Velocidade).
      if (def.buff && isAlive(killer)) {
        if (def.buff === 'frenzy') killer.frenzy = FRENZY.duration;
        else killer.haste = HASTE.duration;
        sim.emit({ type: 'buff', ownerId, buff: def.buff });
      }
      sim.emit({ type: 'xp', ownerId, amount: def.xp, position: { x: m.position.x, y: m.position.y + def.height, z: m.position.z } });
    }
    return;
  }

  const c = sim.getCharacter(targetId);
  if (!c || !isAlive(c) || sim.state.match.ended) return;
  if (c.protection > 0) return;
  // Escudo arcano e armadura de ossos reduzem o dano (data/abilities.ts).
  const taken = Math.round(absorbDamage(c, amount));
  sim.emit({ type: 'hit', ownerId, targetId, damage: taken, headshot, position: { ...position } });
  c.health = Math.max(0, c.health - taken);
  if (ownerId !== c.id) abilityOnDamageDealt(sim, ownerId, taken);
  c.sinceHit = 0;
  c.lastAttackerId = ownerId;
  if (owner && owner !== c) c.damagers[ownerId] = sim.state.match.elapsed;
  sim.notifyDamaged(c, ownerId);
  if (c.health === 0) eliminate(sim, c, ownerId, headshot);
}

function eliminate(sim: Simulation, c: CharacterState, killerId: string, headshot: boolean): void {
  sim.invalidateHitboxes();
  c.deaths++;
  // Modo Gigantes: o tempo para voltar cresce com a partida.
  c.respawnTimer = sim.teams ? Math.min(RESPAWN.max, RESPAWN.base + (sim.state.match.elapsed / 60) * RESPAWN.perMinute) : MATCH.respawnDelay;
  c.bow.drawing = false;
  c.bow.drawTime = 0;
  c.frenzy = 0;
  c.haste = 0;
  c.velocity.x = 0;
  c.velocity.z = 0;
  const killer = sim.getCharacter(killerId);
  if (killer && killer !== c) {
    killer.kills++;
    grantLevelXp(sim, killer, MATCH_LEVELS.kill);
  }
  // Assistências: quem feriu a vítima nos últimos segundos (e não deu o abate).
  const assists: string[] = [];
  for (const [id, t] of Object.entries(c.damagers)) {
    if (id === killerId || sim.state.match.elapsed - t > ASSIST.window) continue;
    const helper = sim.getCharacter(id);
    if (!helper || sim.sameTeam(id, c.id)) continue;
    helper.assists++;
    grantLevelXp(sim, helper, MATCH_LEVELS.assist);
    assists.push(id);
  }
  c.damagers = {};
  // Último de pé: sem volta; entra na lista de eliminados (define a colocação).
  if (sim.royale) {
    c.respawnTimer = Infinity;
    sim.state.match.out.push(c.id);
  }
  sim.emit({ type: 'kill', ownerId: killerId, targetId: c.id, victimKind: 'character', headshot, assists });
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
    if (c.frenzy > 0) c.frenzy = Math.max(0, c.frenzy - dt);
    if (c.haste > 0) c.haste = Math.max(0, c.haste - dt);
    // Vida volta aos poucos depois de um tempo sem levar dano.
    if (isAlive(c)) {
      c.sinceHit += dt;
      const max = maxHealthOf(c);
      if (c.sinceHit > MATCH.regenDelay && c.health < max) c.health = Math.min(max, c.health + MATCH.regenPerSecond * dt);
    }
    if (isAlive(c) || sim.state.match.ended || sim.royale) continue;
    c.respawnTimer -= dt;
    if (c.respawnTimer <= 0) {
      const sp = sim.pickSpawn(c.id);
      c.position = { x: sp.x, y: sim.world.terrain.sample(sp.x, sp.z), z: sp.z };
      c.velocity = { x: 0, y: 0, z: 0 };
      c.health = maxHealthOf(c);
      c.respawnTimer = 0;
      c.protection = MATCH.spawnProtection;
      c.lastAttackerId = null;
      c.bodyYaw = c.aimYaw = sp.yaw;
      c.aimPitch = 0;
      sim.emit({ type: 'respawn', targetId: c.id });
    }
  }
}
