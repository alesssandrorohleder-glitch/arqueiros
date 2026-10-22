// Protocolo do multiplayer (JSON por WebSocket). O servidor é autoritativo:
// roda a mesma Simulation do jogo offline e manda "retratos" (snapshots)
// compactos do estado ~20 vezes por segundo. O cliente manda só comandos.
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/Simulation';
import type { BowEffect } from '../data/bows';
import type { Rarity } from '../data/rarities';
import type { ArrowState } from '../entities/ArrowState';
import type { CharacterState, MoveState } from '../entities/CharacterState';
import type { InputCommand } from '../entities/InputCommand';
import type { LootState, MobMode, MobState } from '../entities/MobState';

export const PROTOCOL_VERSION = 1;
/** Snapshots por segundo enviados pelo servidor. */
export const SNAPSHOT_RATE = 20;

// ------------------------------------------------------------------ mensagens

export type ClientMessage =
  | { t: 'join'; v: number; name: string; characterId: string; bowId: string }
  | { t: 'input'; seq: number; cmd: InputCommand }
  | { t: 'profile'; characterId: string; bowId: string }
  | { t: 'ping'; time: number };

export type ServerMessage =
  | { t: 'welcome'; id: string; room: string; seed: number }
  | { t: 'snap'; tick: number; ack: number; s: Snapshot; e: GameEvent[] }
  | { t: 'pong'; time: number }
  | { t: 'error'; message: string };

// ------------------------------------------------------------------ snapshot

/** Arredonda para reduzir o tamanho do JSON. */
const r = (n: number, d = 100) => Math.round(n * d) / d;
const MOVE_STATES: MoveState[] = ['idle', 'walk', 'run', 'air'];
const MOB_MODES: MobMode[] = ['idle', 'wander', 'chase', 'attack', 'return', 'dead'];

type CharRow = [
  string, string, number, string, // id, nome, bot, personagem
  number, number, number, number, number, number, // pos, vel
  number, number, number, number, number, // bodyYaw, aimYaw, aimPitch, grounded, moveState
  number, number, number, number, number, // vida, abates, mortes, xp, mobs
  number, number, number, // lento, proteção, volta
  string, number, number, number, number, number, number, // arco: id, puxando, tempo, dispersão, swayY, swayP, recarga
  string | null, // último atacante
];
type ArrowRow = [number, string, number, number, number, number, number, number, Rarity, BowEffect | null, 'normal' | 'magic'];
type MobRow = [string, string, number, number, number, number, number, number, number, number, number, string | null, number];
type LootRow = [number, string, number, number, number];

export interface Snapshot {
  m: [number, number]; // tempo restante, terminou
  c: CharRow[];
  a: ArrowRow[]; // só flechas em voo
  o: MobRow[];
  l: LootRow[];
  g: [number, number][]; // alvos: vida, tempo para voltar
}

export function encodeSnapshot(s: GameState): Snapshot {
  return {
    m: [r(s.match.timeLeft, 10), s.match.ended ? 1 : 0],
    c: s.characters.map((c): CharRow => [
      c.id, c.name, c.isBot ? 1 : 0, c.characterId,
      r(c.position.x), r(c.position.y), r(c.position.z), r(c.velocity.x), r(c.velocity.y), r(c.velocity.z),
      r(c.bodyYaw, 1000), r(c.aimYaw, 1000), r(c.aimPitch, 1000), c.grounded ? 1 : 0, MOVE_STATES.indexOf(c.moveState),
      Math.round(c.health), c.kills, c.deaths, c.matchXp, c.mobKills,
      r(c.slowTimer), r(c.protection), r(c.respawnTimer),
      c.bow.bowId, c.bow.drawing ? 1 : 0, r(c.bow.drawTime), r(c.bow.spread, 10000), r(c.bow.swayYaw, 1000), r(c.bow.swayPitch, 1000), r(c.bow.cooldown),
      c.lastAttackerId,
    ]),
    a: s.arrows.filter((a) => !a.stuck).map((a): ArrowRow => [
      a.id, a.ownerId, r(a.position.x), r(a.position.y), r(a.position.z), r(a.velocity.x), r(a.velocity.y), r(a.velocity.z), a.rarity, a.effect, a.trail,
    ]),
    o: s.mobs.map((m): MobRow => [
      m.id, m.typeId, r(m.position.x), r(m.position.y), r(m.position.z), r(m.velocity.x), r(m.velocity.z), r(m.yaw, 1000),
      Math.round(m.health), MOB_MODES.indexOf(m.mode), r(m.timer), m.targetId, r(m.slowTimer),
    ]),
    l: s.loot.map((l): LootRow => [l.id, l.bowId, r(l.position.x), r(l.position.y), r(l.position.z)]),
    g: s.targets.map((t) => [Math.round(t.health), r(t.respawnTimer)]),
  };
}

/** Aplica um snapshot ao estado do cliente, reaproveitando os objetos existentes. */
export function applySnapshot(state: GameState, snap: Snapshot): void {
  state.match.timeLeft = snap.m[0];
  state.match.ended = snap.m[1] === 1;

  const chars = new Map(state.characters.map((c) => [c.id, c]));
  state.characters = snap.c.map((row) => {
    const [id, name, bot, characterId, x, y, z, vx, vy, vz, by, ay, ap, g, ms, h, k, d, xp, mk, slow, prot, resp, bowId, dr, dt, sp, sy, spi, cd, last] = row;
    const c: CharacterState = chars.get(id) ?? newCharacter(id);
    Object.assign(c, {
      name, isBot: bot === 1, characterId, bodyYaw: by, aimYaw: ay, aimPitch: ap, grounded: g === 1, moveState: MOVE_STATES[ms] ?? 'idle',
      health: h, kills: k, deaths: d, matchXp: xp, mobKills: mk, slowTimer: slow, protection: prot, respawnTimer: resp, lastAttackerId: last,
    });
    c.position = { x, y, z };
    c.velocity = { x: vx, y: vy, z: vz };
    Object.assign(c.bow, { bowId, drawing: dr === 1, drawTime: dt, spread: sp, swayYaw: sy, swayPitch: spi, cooldown: cd });
    return c;
  });

  state.arrows = snap.a.map(([id, ownerId, x, y, z, vx, vy, vz, rarity, effect, trail]): ArrowState => ({
    id, ownerId, position: { x, y, z }, velocity: { x: vx, y: vy, z: vz }, damage: 0, rarity, age: 0, stuck: false,
    stuckDir: null, stuckToTarget: null, effect, trail, path: [], endStick: false,
  }));

  const mobs = new Map(state.mobs.map((m) => [m.id, m]));
  state.mobs = snap.o.map(([id, typeId, x, y, z, vx, vz, yaw, health, mode, timer, targetId, slow]) => {
    const m: MobState = mobs.get(id) ?? {
      id, typeId, position: { x, y, z }, velocity: { x: 0, y: 0, z: 0 }, yaw, health, mode: 'idle', targetId: null, spawnIndex: 0,
      home: { x, z }, wanderTo: null, timer: 0, attackCooldown: 0, grounded: true, lastAttackerId: null, slowTimer: 0,
    };
    m.typeId = typeId;
    m.position = { x, y, z };
    m.velocity = { x: vx, y: 0, z: vz };
    Object.assign(m, { yaw, health, mode: MOB_MODES[mode] ?? 'idle', timer, targetId, slowTimer: slow });
    return m;
  });

  state.loot = snap.l.map(([id, bowId, x, y, z]): LootState => ({ id, bowId, position: { x, y, z }, age: 0 }));
  snap.g.forEach(([health, resp], i) => {
    const t = state.targets[i];
    if (t) {
      t.health = health;
      t.respawnTimer = resp;
    }
  });
}

function newCharacter(id: string): CharacterState {
  return {
    id, name: '', isBot: false, characterId: 'hunter', position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
    bodyYaw: 0, aimYaw: 0, aimPitch: 0, grounded: true, airTime: 0, jumpBuffer: 0, moveState: 'idle', health: 100,
    bow: { bowId: 'hunting', drawing: false, drawTime: 0, cooldown: 0, spread: 0, swayYaw: 0, swayPitch: 0, waitRelease: false },
    respawnTimer: 0, protection: 0, kills: 0, deaths: 0, lastAttackerId: null, matchXp: 0, mobKills: 0, slowTimer: 0, sinceHit: 99,
  };
}

/** Limpa um comando vindo da rede (nunca confie no cliente). */
export function sanitizeCommand(raw: unknown): InputCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0);
  return {
    forward: num(c.forward, -1, 1),
    right: num(c.right, -1, 1),
    sprint: c.sprint === true,
    jump: c.jump === true,
    aimYaw: num(c.aimYaw, -1e6, 1e6),
    aimPitch: num(c.aimPitch, -1.6, 1.6),
    primary: c.primary === true,
    secondary: c.secondary === true,
    equipBowId: typeof c.equipBowId === 'string' && c.equipBowId.length < 40 ? c.equipBowId : null,
    aimAssist: c.aimAssist === true,
  };
}
