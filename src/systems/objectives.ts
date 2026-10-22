// Modo Gigantes: torres que atiram, gigantes que esmagam quem chega perto,
// ondas de tropas (mini golems) pelas trilhas, votação para desistir e fim da
// partida. No modo Todos contra todos, só o relógio (fim aos MATCH.duration s).
import type { Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { MATCH } from '../data/match';
import { MOBS, type MobDef } from '../data/mobs';
import { MINION_TYPE, MINION_WAVES, STRUCTURE_DAMAGE_SCALE, STRUCTURES, SURRENDER, type Team } from '../data/objectives';
import { isAlive } from '../entities/CharacterState';
import type { Combatant } from '../entities/Combatant';
import type { MobState } from '../entities/MobState';
import type { StructureState } from '../entities/StructureState';
import { applyDamage } from './combat';
import { grantLevelXp } from './levels';
import { MATCH_LEVELS } from '../data/levels';
import { makeCylinder } from './collision';
import type { Hitbox } from './hitboxes';

export interface SurrenderVote {
  team: Team;
  /** Voto de cada um do time (true = desistir). */
  votes: Record<string, boolean>;
  timeLeft: number;
  startedBy: string;
}

type TargetKind = 'character' | 'mob' | 'structure';

export function structureHitbox(s: StructureState): Hitbox {
  const def = STRUCTURES[s.kind];
  const p = s.position;
  return {
    id: s.id,
    kind: 'structure',
    body: makeCylinder(p.x, p.z, def.radius, p.y, p.y + def.height),
    head: { x: p.x, y: p.y + def.headY, z: p.z, radius: def.headRadius },
  };
}

/** Raio de um alvo (para medir a distância até a "borda" dele). */
function radiusOf(t: Combatant): number {
  const s = t as StructureState;
  if (s.kind === 'tower' || s.kind === 'giant') return STRUCTURES[s.kind].radius;
  const m = t as MobState;
  if (m.typeId) return MOBS[m.typeId].radius;
  return 0.4;
}

function kindOf(sim: Simulation, id: string): TargetKind {
  if (sim.getCharacter(id)) return 'character';
  return sim.getStructure(id) ? 'structure' : 'mob';
}

const dist2D = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

// ------------------------------------------------------------------ passo

export function stepObjectives(sim: Simulation, dt: number): void {
  const match = sim.state.match;
  if (!sim.teams) {
    if (!match.ended && match.elapsed + dt >= MATCH.duration) endMatch(sim, null, null);
    return;
  }
  if (match.ended) return;
  for (const s of sim.state.structures) {
    if (s.destroyed) continue;
    // O gigante só fica vulnerável depois que as duas torres do time caem.
    if (s.kind === 'giant') s.vulnerable = !sim.state.structures.some((t) => t.kind === 'tower' && t.team === s.team && !t.destroyed);
    if (s.kind === 'tower') stepTower(sim, s, dt);
    else stepGiant(sim, s, dt);
  }
  stepWaves(sim, dt);
  stepSurrender(sim, dt);
}

function endMatch(sim: Simulation, winner: Team | null, reason: 'giant' | 'surrender' | null): void {
  const match = sim.state.match;
  match.ended = true;
  match.winner = winner;
  match.reason = reason;
  match.surrender = null;
  sim.emit({ type: 'matchEnd' });
}

// ------------------------------------------------------------------ torres e gigantes

/** Inimigos (personagens e tropas) a até `range` m da borda de `s`. O mais perto primeiro. */
function enemiesNear(sim: Simulation, team: Team, at: Vec3, range: number, minionsFirst: boolean): Combatant[] {
  const list: { c: Combatant; d: number }[] = [];
  for (const c of sim.state.characters) {
    if (c.team === team || !isAlive(c) || c.protection > 0) continue;
    const d = dist2D(c.position, at);
    if (d <= range && Math.abs(c.position.y - at.y) < 14) list.push({ c, d: d + (minionsFirst ? 1000 : 0) });
  }
  for (const m of sim.state.mobs) {
    if (m.mode === 'dead' || m.team === undefined || m.team === team) continue;
    const d = dist2D(m.position, at);
    if (d <= range) list.push({ c: m, d });
  }
  list.sort((a, b) => a.d - b.d);
  return list.map((x) => x.c);
}

function stepTower(sim: Simulation, s: StructureState, dt: number): void {
  const def = STRUCTURES.tower;
  s.cooldown = Math.max(0, s.cooldown - dt);
  // Mantém o alvo enquanto ele estiver ao alcance; senão, tropas primeiro, depois personagens.
  let target = s.targetId ? sim.getCombatant(s.targetId) : undefined;
  if (!target || target.health <= 0 || dist2D(target.position, s.position) > def.range || ((target as { protection?: number }).protection ?? 0) > 0) {
    target = enemiesNear(sim, s.team, s.position, def.range, true)[0];
    s.targetId = target?.id ?? null;
  }
  if (!target || s.cooldown > 0) return;
  s.cooldown = def.cooldown;
  const from = { x: s.position.x, y: s.position.y + def.headY, z: s.position.z };
  const kind = kindOf(sim, target.id);
  const to = { x: target.position.x, y: target.position.y + (kind === 'character' ? 1.1 : 0.7), z: target.position.z };
  sim.emit({ type: 'towerShot', ownerId: s.id, team: s.team, from, to });
  applyDamage(sim, target.id, kind, kind === 'character' ? def.damage : def.minionDamage, false, s.id, to);
}

function stepGiant(sim: Simulation, s: StructureState, dt: number): void {
  const def = STRUCTURES.giant;
  s.cooldown = Math.max(0, s.cooldown - dt);
  if (s.windup > 0) {
    s.windup -= dt;
    if (s.windup > 0) return;
    s.windup = 0;
    // Golpe no chão: atinge todos os inimigos em volta (o dano cai com a distância).
    const center = { x: s.position.x - Math.sin(s.yaw) * 3, y: s.position.y, z: s.position.z - Math.cos(s.yaw) * 3 };
    sim.emit({ type: 'giantSlam', ownerId: s.id, position: center, radius: def.splash });
    for (const e of enemiesNear(sim, s.team, center, def.splash, false)) {
      const kind = kindOf(sim, e.id);
      const k = 1 - 0.5 * (dist2D(e.position, center) / def.splash);
      applyDamage(sim, e.id, kind, (kind === 'character' ? def.damage : def.minionDamage) * k, false, s.id, { x: e.position.x, y: e.position.y + 1, z: e.position.z });
    }
    s.cooldown = def.cooldown;
    return;
  }
  if (s.cooldown > 0) return;
  const target = enemiesNear(sim, s.team, s.position, def.range + def.radius, false)[0];
  if (!target) return;
  // Vira para o alvo e ergue os punhos.
  s.yaw = Math.atan2(-(target.position.x - s.position.x), -(target.position.z - s.position.z));
  s.targetId = target.id;
  s.windup = def.windup;
  sim.emit({ type: 'giantWindup', ownerId: s.id });
}

/** Está dentro do círculo de ataque da estrutura (só assim dá para feri-la)? */
export function insideAttackArea(s: StructureState, p: { x: number; z: number }): boolean {
  return dist2D(s.position, p) <= STRUCTURES[s.kind].attackArea;
}

/** Dano numa torre/gigante (chamado por applyDamage). */
export function damageStructure(sim: Simulation, s: StructureState, amount: number, headshot: boolean, ownerId: string, position: Vec3): void {
  if (s.destroyed || sim.state.match.ended) return;
  if (!s.vulnerable) {
    sim.emit({ type: 'shielded', ownerId, targetId: s.id, position: { ...position } });
    return;
  }
  // Só causa dano quem está dentro do círculo da estrutura (personagens; tropas lutam colado).
  const attacker = sim.getCharacter(ownerId);
  if (attacker && !insideAttackArea(s, attacker.position)) {
    sim.emit({ type: 'outOfRange', ownerId, targetId: s.id, position: { ...position } });
    return;
  }
  const scale = attacker ? STRUCTURE_DAMAGE_SCALE : 1;
  const taken = Math.max(1, Math.round(amount * scale));
  sim.emit({ type: 'hit', ownerId, targetId: s.id, damage: taken, headshot, position: { ...position } });
  s.health = Math.max(0, s.health - taken);
  s.lastAttackerId = ownerId;
  if (s.health > 0) return;
  s.destroyed = true;
  s.windup = 0;
  sim.invalidateHitboxes();
  sim.onStructureDestroyed(s);
  sim.state.arrows = sim.state.arrows.filter((a) => a.stuckToTarget !== s.id);
  sim.emit({ type: 'structureDestroyed', ownerId, targetId: s.id, kind: s.kind, team: s.team });
  // XP para todo o time que derrubou.
  const def = STRUCTURES[s.kind];
  for (const c of sim.state.characters) {
    if (c.team === s.team) continue;
    c.matchXp += def.xp;
    if (s.kind === 'tower') grantLevelXp(sim, c, MATCH_LEVELS.tower);
  }
  if (s.kind === 'giant') endMatch(sim, s.team === 0 ? 1 : 0, 'giant');
}

// ------------------------------------------------------------------ tropas

function stepWaves(sim: Simulation, dt: number): void {
  const match = sim.state.match;
  const W = MINION_WAVES;
  if (match.elapsed + dt >= W.firstDelay) {
    match.nextWave -= dt;
    if (match.nextWave <= 0) {
      match.nextWave = W.interval;
      for (const team of [0, 1] as Team[]) {
        for (let lane = 0; lane < sim.map.lanes.length; lane++) {
          for (let k = 0; k < W.perLane; k++) sim.waveQueue.push({ team, lane, delay: k * W.stagger });
        }
      }
      sim.emit({ type: 'wave' });
    }
  }
  for (let i = sim.waveQueue.length - 1; i >= 0; i--) {
    const q = sim.waveQueue[i];
    q.delay -= dt;
    if (q.delay > 0) continue;
    sim.waveQueue.splice(i, 1);
    const alive = sim.state.mobs.filter((m) => m.mode !== 'dead' && m.team === q.team).length;
    if (alive < W.maxAlive) spawnMinion(sim, q.team, q.lane);
  }
}

/** Tropas mais fortes conforme a partida avança (vida e dano). */
const minionGrowth = (sim: Simulation) => 1 + (sim.state.match.elapsed / 60) * MINION_WAVES.growthPerMinute;

/** Pontos da trilha na ordem em que a tropa do time anda. */
function lanePoints(sim: Simulation, team: Team, lane: number): [number, number][] {
  const pts = sim.map.lanes[lane];
  return team === 0 ? pts : [...pts].reverse();
}

function spawnMinion(sim: Simulation, team: Team, lane: number): void {
  const [x0, z0] = lanePoints(sim, team, lane)[0];
  const x = x0 + sim.rng.range(-1.5, 1.5);
  const z = z0 + sim.rng.range(-1.5, 1.5);
  const typeId = MINION_TYPE[team];
  sim.state.mobs.push({
    id: `mob-${sim.allocId()}`,
    typeId,
    position: { x, y: sim.world.terrain.sample(x, z) + 0.2, z },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: team === 0 ? 0 : Math.PI,
    health: Math.round(MOBS[typeId].maxHealth * minionGrowth(sim)),
    mode: 'wander',
    targetId: null,
    spawnIndex: -1,
    home: { x, z },
    wanderTo: null,
    timer: 0,
    attackCooldown: 0,
    grounded: false,
    lastAttackerId: null,
    slowTimer: 0,
    team,
    lane,
    laneStep: 1,
  });
}

/** Inimigo mais perto da tropa (personagens, tropas e estruturas), medindo até a borda. */
function minionTarget(sim: Simulation, m: MobState, range: number): Combatant | undefined {
  let best: Combatant | undefined;
  let bestD = range;
  const consider = (c: Combatant, r: number) => {
    const d = dist2D(c.position, m.position) - r;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  };
  for (const c of sim.state.characters) if (c.team !== m.team && isAlive(c) && c.protection <= 0) consider(c, 0.4);
  for (const o of sim.state.mobs) if (o.mode !== 'dead' && o.team !== undefined && o.team !== m.team) consider(o, MOBS[o.typeId].radius);
  for (const s of sim.state.structures) if (!s.destroyed && s.team !== m.team) consider(s, STRUCTURES[s.kind].radius);
  return best;
}

/**
 * Pensamento de uma tropa: segue a trilha até o gigante inimigo; no caminho,
 * para e ataca o inimigo mais perto (tropas, personagens, torres, gigante).
 * Usa os modos dos mobs: wander = andando pela trilha (para wanderTo), chase, attack.
 */
export function thinkMinion(sim: Simulation, m: MobState, def: MobDef, dt: number): void {
  m.attackCooldown = Math.max(0, m.attackCooldown - dt);
  let target = m.targetId ? sim.getCombatant(m.targetId) : undefined;
  if (target && (target.health <= 0 || sim.sameTeam(m.id, target.id))) target = undefined;
  if (m.mode !== 'attack') {
    // Reavalia o alvo de vez em quando (sempre o mais perto).
    m.timer -= dt;
    if (!target || m.timer <= 0) {
      m.timer = 0.4;
      target = minionTarget(sim, m, MINION_WAVES.aggroRange);
    }
  }
  m.targetId = target?.id ?? null;

  if (m.mode === 'attack') {
    m.timer -= dt;
    if (target) m.yaw = Math.atan2(-(target.position.x - m.position.x), -(target.position.z - m.position.z));
    if (m.timer > 0) return;
    if (target && dist2D(target.position, m.position) - radiusOf(target) <= def.attackRange * 1.3) {
      const kind = kindOf(sim, target.id);
      const dmg = def.attackDamage * minionGrowth(sim) * (kind === 'structure' ? MINION_WAVES.structureDamage : 1);
      const y = kind === 'structure' ? target.position.y + 1.5 : target.position.y + 0.8;
      applyDamage(sim, target.id, kind, dmg, false, m.id, { x: target.position.x, y, z: target.position.z });
    }
    m.attackCooldown = def.attackCooldown;
    m.mode = target ? 'chase' : 'wander';
    m.timer = 0;
    return;
  }

  if (target) {
    const d = dist2D(target.position, m.position) - radiusOf(target);
    if (d <= def.attackRange && m.attackCooldown <= 0) {
      m.mode = 'attack';
      m.timer = def.attackWindup;
      sim.emit({ type: 'mobAttack', mobId: m.id });
    } else {
      m.mode = 'chase';
    }
    return;
  }

  // Sem inimigo por perto: segue a trilha.
  m.mode = 'wander';
  const pts = lanePoints(sim, m.team!, m.lane ?? 0);
  let step = m.laneStep ?? 1;
  while (step < pts.length && dist2D(m.position, { x: pts[step][0], z: pts[step][1] }) < 4) step++;
  m.laneStep = step;
  if (step < pts.length) {
    m.wanderTo = { x: pts[step][0], z: pts[step][1] };
  } else {
    // Fim da trilha: vai para o gigante inimigo.
    const giant = sim.state.structures.find((s) => s.kind === 'giant' && s.team !== m.team);
    m.wanderTo = giant ? { x: giant.position.x, z: giant.position.z } : null;
  }
}

/** Raio do alvo da perseguição (para a tropa parar na borda de torres e gigantes). */
export function chaseStopRadius(sim: Simulation, targetId: string): number {
  const s = sim.getStructure(targetId);
  return s ? STRUCTURES[s.kind].radius : 0;
}

// ------------------------------------------------------------------ desistência

/** Quanto o time está atrás (positivo = perdendo). */
export function teamDeficit(sim: Simulation, team: Team): number {
  const enemy: Team = team === 0 ? 1 : 0;
  const towersLost = (t: Team) => sim.state.structures.filter((s) => s.kind === 'tower' && s.team === t && s.destroyed).length;
  const giantFrac = (t: Team) => {
    const g = sim.state.structures.find((s) => s.kind === 'giant' && s.team === t);
    return g ? g.health / g.maxHealth : 1;
  };
  const kills = (t: Team) => sim.state.characters.filter((c) => c.team === t).reduce((n, c) => n + c.kills, 0);
  return towersLost(team) - towersLost(enemy) + (giantFrac(enemy) - giantFrac(team)) * 2 + (kills(enemy) - kills(team)) / 10;
}

/** Por que não dá para pedir a votação agora (ou null se dá). */
export function surrenderBlocked(sim: Simulation, team: Team): string | null {
  const match = sim.state.match;
  if (!sim.teams || match.ended) return 'Não há partida em times.';
  if (match.surrender) return 'Já há uma votação em andamento.';
  if (match.elapsed < SURRENDER.minTime) return `Só dá para desistir depois de ${Math.round(SURRENDER.minTime / 60)} min de partida.`;
  if (match.surrenderCooldown[team] > 0) return `Espere ${Math.ceil(match.surrenderCooldown[team])} s para votar de novo.`;
  return null;
}

/** Começa a votação para o time de `byId` desistir (quem pede já vota "sim"). */
export function startSurrender(sim: Simulation, byId: string): boolean {
  const c = sim.getCharacter(byId);
  if (!c || surrenderBlocked(sim, c.team)) return false;
  sim.state.match.surrender = { team: c.team, votes: { [byId]: true }, timeLeft: SURRENDER.voteTime, startedBy: byId };
  sim.emit({ type: 'surrenderVote', team: c.team, byId });
  return true;
}

/** Voto de um personagem na votação do time dele. */
export function castVote(sim: Simulation, id: string, yes: boolean): void {
  const v = sim.state.match.surrender;
  const c = sim.getCharacter(id);
  if (!v || !c || c.team !== v.team || id in v.votes) return;
  v.votes[id] = yes;
}

/** Chance de um bot votar "sim", conforme o placar. */
function botYesChance(deficit: number): number {
  if (deficit >= 2.5) return 0.85;
  if (deficit >= 1.5) return 0.55;
  if (deficit >= 0.8) return 0.25;
  return 0.08;
}

function stepSurrender(sim: Simulation, dt: number): void {
  const match = sim.state.match;
  match.surrenderCooldown[0] = Math.max(0, match.surrenderCooldown[0] - dt);
  match.surrenderCooldown[1] = Math.max(0, match.surrenderCooldown[1] - dt);
  const v = match.surrender;
  if (!v) {
    // Bots também pedem para desistir quando o time está muito atrás.
    if (sim.state.tick % 600 === 0) {
      for (const team of [0, 1] as Team[]) {
        const bot = sim.state.characters.find((c) => c.team === team && c.isBot);
        if (bot && teamDeficit(sim, team) >= 2.2 && !surrenderBlocked(sim, team) && sim.rng.chance(0.35)) {
          startSurrender(sim, bot.id);
          break;
        }
      }
    }
    return;
  }
  v.timeLeft -= dt;
  // Bots votam aos poucos (cada um pensa por alguns segundos).
  const p = botYesChance(teamDeficit(sim, v.team));
  for (const c of sim.state.characters) {
    if (c.team !== v.team || !c.isBot || c.id in v.votes) continue;
    if (sim.rng.chance(dt * 0.45)) v.votes[c.id] = sim.rng.chance(p);
  }
  const team = sim.state.characters.filter((c) => c.team === v.team);
  const yes = team.filter((c) => v.votes[c.id] === true).length;
  const no = team.filter((c) => v.votes[c.id] === false).length;
  const needed = Math.min(SURRENDER.yesNeeded, team.length);
  if (yes >= needed) {
    sim.emit({ type: 'surrenderResult', team: v.team, passed: true, yes, no });
    endMatch(sim, v.team === 0 ? 1 : 0, 'surrender');
    return;
  }
  if (no > team.length - needed || v.timeLeft <= 0) {
    sim.emit({ type: 'surrenderResult', team: v.team, passed: false, yes, no: team.length - yes });
    match.surrender = null;
    match.surrenderCooldown[v.team] = SURRENDER.cooldown;
  }
}
