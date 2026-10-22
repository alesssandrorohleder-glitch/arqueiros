// Simulação da partida: estado puro + passo fixo. Não conhece Three.js nem o
// DOM, então pode rodar igual num servidor no futuro. Os bots também vivem
// aqui: geram InputCommands como se fossem jogadores.
import { BOT_ROSTER, botDifficultyFor, type BotLevel } from '../data/bots';
import { getCharacter } from '../data/characters';
import { COMBAT } from '../data/combat';
import type { MapDef } from '../data/maps/arena';
import { MATCH } from '../data/match';
import type { ArrowState } from '../entities/ArrowState';
import { createCharacterState, isAlive, type CharacterState } from '../entities/CharacterState';
import type { InputCommand } from '../entities/InputCommand';
import type { TargetState } from '../entities/TargetState';
import { BotBrain } from '../systems/ai/BotBrain';
import { stepBow } from '../systems/bow';
import type { CollisionWorld } from '../systems/collision';
import { stepCharacterLife, stepTargets } from '../systems/combat';
import { MOB_SPAWNING, MOBS } from '../data/mobs';
import type { Combatant } from '../entities/Combatant';
import type { LootState, MobState } from '../entities/MobState';
import { characterHitbox, mobHitbox, targetHitbox, type Hitbox } from '../systems/hitboxes';
import { stepLoot } from '../systems/loot';
import { stepMobs, stepMobSpawning } from '../systems/mobs';
import { stepCharacter } from '../systems/movement';
import { stepArrows } from '../systems/projectiles';
import type { GameEvent } from './events';
import { Random } from './random';

export interface MatchState {
  /** Tempo restante (s). */
  timeLeft: number;
  ended: boolean;
}

export interface GameState {
  tick: number;
  characters: CharacterState[];
  arrows: ArrowState[];
  targets: TargetState[];
  mobs: MobState[];
  loot: LootState[];
  match: MatchState;
}

export interface SpawnPoint { x: number; z: number; yaw: number }

export class Simulation {
  readonly state: GameState = { tick: 0, characters: [], arrows: [], targets: [], mobs: [], loot: [], match: { timeLeft: MATCH.duration, ended: false } };
  /** Tempo até o próximo surgimento em cada ponto de spawn de mobs. */
  readonly mobSpawnTimers: number[];
  /** Eventos do último tick. */
  events: GameEvent[] = [];
  readonly rng: Random;
  readonly bots = new Map<string, BotBrain>();
  readonly spawns: SpawnPoint[];
  private nextArrowId = 1;

  constructor(readonly world: CollisionWorld, readonly map: MapDef) {
    this.rng = new Random(map.seed ^ 0xa770);
    const sp = map.playerSpawn;
    map.targets.forEach((t, i) => {
      this.state.targets.push({
        id: `dummy-${i}`,
        position: { x: t.x, y: world.terrain.sample(t.x, t.z), z: t.z },
        yaw: Math.atan2(-(sp.x - t.x), -(sp.z - t.z)),
        health: COMBAT.dummyHealth,
        maxHealth: COMBAT.dummyHealth,
        respawnTimer: 0,
      });
    });
    this.mobSpawnTimers = map.mobSpawns.map((_, i) => MOB_SPAWNING.firstDelay + i * 1.5);
    // Pontos de nascimento: todos olhando para o centro do mapa.
    this.spawns = [sp, ...map.botSpawns].map((p) => ({ x: p.x, z: p.z, yaw: Math.atan2(p.x, p.z) }));
  }

  addCharacter(id: string, name: string, characterId: string, bowId: string, spawn: SpawnPoint, isBot = false): CharacterState {
    const c = createCharacterState(id, name, isBot, getCharacter(characterId), bowId, spawn.x, this.world.terrain.sample(spawn.x, spawn.z), spawn.z, spawn.yaw);
    this.state.characters.push(c);
    return c;
  }

  /** Coloca os bots da lista `BOT_ROSTER` nos pontos de nascimento. */
  addBots(bowId: string, count = BOT_ROSTER.length): void {
    for (let i = 0; i < count && i < BOT_ROSTER.length; i++) this.addBot(i, bowId);
  }

  /** Nível dos bots (Configurações → Dificuldade dos bots). */
  botLevel: BotLevel = 'normal';

  /** Adiciona o bot `index` da lista (se ainda não estiver na partida). */
  addBot(index: number, bowId: string, spawn?: SpawnPoint): CharacterState | null {
    const slot = BOT_ROSTER[index];
    const id = `bot-${index}`;
    if (!slot || this.getCharacter(id)) return null;
    const c = this.addCharacter(id, slot.name, slot.characterId, slot.bowId ?? bowId, spawn ?? this.spawns[(index + 1) % this.spawns.length], true);
    const brain = new BotBrain(id, botDifficultyFor(slot, this.botLevel), new Random(this.map.seed + index * 7919));
    brain.reset(c);
    this.bots.set(id, brain);
    return c;
  }

  /** Tira um personagem da partida (jogador que saiu ou bot que deu lugar). */
  removeCharacter(id: string): void {
    this.state.characters = this.state.characters.filter((c) => c.id !== id);
    this.bots.delete(id);
    this.invalidateHitboxes();
    for (const m of this.state.mobs) if (m.targetId === id) m.targetId = null;
  }

  getCharacter(id: string): CharacterState | undefined {
    return this.state.characters.find((c) => c.id === id);
  }

  allocArrowId(): number {
    return this.nextArrowId++;
  }

  /** Id numérico único (flechas, itens, mobs). */
  allocId(): number {
    return this.nextArrowId++;
  }

  /** Personagem ou mob com esse id. */
  getCombatant(id: string): Combatant | undefined {
    return this.getCharacter(id) ?? this.state.mobs.find((m) => m.id === id && m.mode !== 'dead');
  }

  /** Nome para mostrar (placar, lista de abates). */
  nameOf(id: string): string {
    const c = this.getCharacter(id);
    if (c) return c.name;
    const m = this.state.mobs.find((x) => x.id === id);
    return m ? MOBS[m.typeId].name : '?';
  }

  private hitboxCache: Hitbox[] | null = null;

  /** Tudo que pode ser atingido agora (calculado no máximo uma vez por fase do tick). */
  hitboxes(): Hitbox[] {
    if (this.hitboxCache) return this.hitboxCache;
    const list: Hitbox[] = [];
    for (const t of this.state.targets) if (t.respawnTimer <= 0) list.push(targetHitbox(t));
    for (const c of this.state.characters) if (isAlive(c)) list.push(characterHitbox(c));
    for (const m of this.state.mobs) if (m.mode !== 'dead') list.push(mobHitbox(m));
    this.hitboxCache = list;
    return list;
  }

  /** Posições/vidas mudaram: as hitboxes precisam ser recalculadas. */
  invalidateHitboxes(): void {
    this.hitboxCache = null;
  }

  /** Ponto de nascimento mais longe dos personagens vivos (com um pouco de sorte). */
  pickSpawn(forId: string): SpawnPoint {
    let best = this.spawns[0];
    let bestScore = -Infinity;
    for (const s of this.spawns) {
      let nearest = Infinity;
      for (const c of this.state.characters) {
        if (c.id === forId || !isAlive(c)) continue;
        nearest = Math.min(nearest, Math.hypot(c.position.x - s.x, c.position.z - s.z));
      }
      const score = nearest + this.rng.range(0, 15);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  /** Recomeça a partida: todos voltam aos pontos de nascimento, placar zerado. */
  resetMatch(): void {
    this.state.arrows = [];
    this.state.mobs = [];
    this.state.loot = [];
    this.map.mobSpawns.forEach((_, i) => (this.mobSpawnTimers[i] = MOB_SPAWNING.firstDelay + i * 1.5));
    this.state.match = { timeLeft: MATCH.duration, ended: false };
    this.state.characters.forEach((c, i) => {
      const sp = this.spawns[i % this.spawns.length];
      c.position = { x: sp.x, y: this.world.terrain.sample(sp.x, sp.z), z: sp.z };
      c.velocity = { x: 0, y: 0, z: 0 };
      c.bodyYaw = c.aimYaw = sp.yaw;
      c.aimPitch = 0;
      c.health = getCharacter(c.characterId).maxHealth;
      c.kills = c.deaths = 0;
      c.matchXp = c.mobKills = 0;
      c.respawnTimer = 0;
      c.protection = MATCH.spawnProtection;
      c.lastAttackerId = null;
      c.bow.drawing = false;
      c.bow.drawTime = 0;
      c.bow.cooldown = 0;
      this.bots.get(c.id)?.reset(c);
    });
    for (const t of this.state.targets) {
      t.health = t.maxHealth;
      t.respawnTimer = 0;
    }
  }

  notifyDamaged(c: CharacterState, attackerId: string): void {
    this.bots.get(c.id)?.onDamaged(this, c, attackerId);
  }

  emit(e: GameEvent): void {
    this.events.push(e);
  }

  step(commands: Map<string, InputCommand>, dt: number): void {
    this.events = [];
    this.invalidateHitboxes();
    const match = this.state.match;
    for (const c of this.state.characters) {
      const brain = this.bots.get(c.id);
      const cmd = brain ? brain.command(this, c, dt) : commands.get(c.id);
      if (!cmd || !isAlive(c)) continue;
      if (match.ended) {
        cmd.primary = false;
        cmd.forward = cmd.right = 0;
      }
      stepBow(this, c, cmd, dt);
      stepCharacter(c, cmd, this.world, dt);
    }
    stepMobs(this, dt);
    this.invalidateHitboxes();
    stepArrows(this, dt);
    this.invalidateHitboxes();
    stepTargets(this, dt);
    stepLoot(this, dt);
    if (!match.ended) stepMobSpawning(this, dt);
    const before = new Set(this.state.characters.filter((c) => !isAlive(c)).map((c) => c.id));
    stepCharacterLife(this, dt);
    for (const id of before) {
      const c = this.getCharacter(id)!;
      if (isAlive(c)) this.bots.get(id)?.reset(c);
    }

    if (!match.ended) {
      match.timeLeft = Math.max(0, match.timeLeft - dt);
      if (match.timeLeft === 0) {
        match.ended = true;
        this.emit({ type: 'matchEnd' });
      }
    }
    this.state.tick++;
  }
}
