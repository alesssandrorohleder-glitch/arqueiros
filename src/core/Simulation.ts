// Simulação da partida: estado puro + passo fixo. Não conhece Three.js nem o
// DOM, então pode rodar igual num servidor no futuro. Os bots também vivem
// aqui: geram InputCommands como se fossem jogadores.
import { stepAbility } from '../systems/abilities';
import { ancientTreeBase, ancientTreeClimbPath } from '../world/ancientTree';
import { BOT_ROSTER, botDifficultyFor, botTeam, type BotLevel } from '../data/bots';
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
import type { Collider, CollisionWorld } from '../systems/collision';
import { stepCharacterLife, stepTargets } from '../systems/combat';
import { MOB_SPAWNING, MOBS, SPECIAL_MOBS } from '../data/mobs';
import type { Combatant } from '../entities/Combatant';
import type { LootState, MobState } from '../entities/MobState';
import { characterHitbox, mobHitbox, targetHitbox, type Hitbox } from '../systems/hitboxes';
import { stepLoot } from '../systems/loot';
import { stepMobs, stepMobSpawning } from '../systems/mobs';
import { stepCharacter } from '../systems/movement';
import { stepArrows } from '../systems/projectiles';
import { STRUCTURES, type Team } from '../data/objectives';
import type { StructureState } from '../entities/StructureState';
import { stepObjectives, structureHitbox, type SurrenderVote } from '../systems/objectives';
import { newZone, stepRoyale, type ZoneState } from '../systems/zone';
import { ROYALE } from '../data/royale';
import type { GameEvent } from './events';
import { Random } from './random';

export interface MatchState {
  /** Tempo de partida (s), contando para cima. */
  elapsed: number;
  ended: boolean;
  /** Time vencedor (quando acaba). */
  winner: Team | null;
  /** Como acabou: gigante derrubado ou time desistiu. */
  reason: 'giant' | 'surrender' | null;
  /** Votação de desistência em andamento (uma por vez). */
  surrender: SurrenderVote | null;
  /** Tempo até cada time poder pedir outra votação (s). */
  surrenderCooldown: [number, number];
  /** Tempo até a próxima onda de tropas (s). */
  nextWave: number;
  // --- Último de pé ---
  /** Zona que fecha (null fora desse modo). */
  zone: ZoneState | null;
  /** Eliminados, na ordem (o primeiro fica em último lugar). */
  out: string[];
  /** Último vivo (vencedor). */
  winnerId: string | null;
}

export function newMatch(): MatchState {
  return { elapsed: 0, ended: false, winner: null, reason: null, surrender: null, surrenderCooldown: [0, 0], nextWave: 0, zone: null, out: [], winnerId: null };
}

export interface GameState {
  tick: number;
  characters: CharacterState[];
  arrows: ArrowState[];
  targets: TargetState[];
  mobs: MobState[];
  loot: LootState[];
  /** Torres e gigantes (modo Gigantes). */
  structures: StructureState[];
  match: MatchState;
}

export interface SpawnPoint { x: number; z: number; yaw: number }

export class Simulation {
  readonly state: GameState = { tick: 0, characters: [], arrows: [], targets: [], mobs: [], loot: [], structures: [], match: newMatch() };
  /** Tempo até o próximo surgimento em cada ponto de spawn de mobs. */
  readonly mobSpawnTimers: number[];
  /** Tempo até nascer cada mob especial (data/mobs.ts → SPECIAL_MOBS). */
  readonly specialMobTimers = SPECIAL_MOBS.map((m) => m.firstDelay);
  /** Eventos do último tick. */
  events: GameEvent[] = [];
  readonly rng: Random;
  readonly bots = new Map<string, BotBrain>();
  /** Caminho de subida de cada árvore anciã (bots), em coordenadas do mundo. */
  readonly climbPaths: { x: number; y: number; z: number }[][];
  /** Centro de cada árvore anciã (mesma ordem de climbPaths). */
  readonly climbCenters: { x: number; z: number }[];
  readonly spawns: SpawnPoint[];
  /** Pontos de nascimento de cada time, olhando para o lado inimigo. */
  readonly teamSpawns: [SpawnPoint[], SpawnPoint[]];
  /** Tropas da onda atual que ainda vão sair (uma a uma). */
  readonly waveQueue: { team: Team; lane: number; delay: number }[] = [];
  /** Modo com times e objetivos (Gigantes); senão, todos contra todos. */
  readonly teams: boolean;
  private nextArrowId = 1;

  /** Último de pé: uma vida só, zona que fecha, vence o último vivo. */
  readonly royale: boolean;
  /** Sorteio da zona (semente nova a cada partida: o lugar do fim muda). */
  zoneRng = new Random((Date.now() ^ 0x5eed) >>> 0);

  constructor(readonly world: CollisionWorld, readonly map: MapDef, rules: { royale?: boolean } = {}) {
    this.royale = !!rules.royale;
    this.teams = map.structures.length > 0;
    this.climbCenters = map.climbTrees.map((t) => ({ x: t.x, z: t.z }));
    this.climbPaths = map.climbTrees.map((t) =>
      ancientTreeClimbPath(t.x, ancientTreeBase((x, z) => world.terrain.sample(x, z), t.x, t.z), t.z, t.rotation));
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
    // Último de pé: todos nascem num anel em volta do mapa, olhando para o centro.
    if (this.royale) {
      const n = BOT_ROSTER.length + 1;
      this.spawns = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + 0.3;
        const x = Math.cos(a) * ROYALE.spawnRing;
        const z = Math.sin(a) * ROYALE.spawnRing;
        return { x, z, yaw: Math.atan2(x, z) };
      });
      this.state.match.zone = newZone(this);
    }
    this.teamSpawns = [
      map.teamSpawns[0].map((p) => ({ x: p.x, z: p.z, yaw: 0 })),
      map.teamSpawns[1].map((p) => ({ x: p.x, z: p.z, yaw: Math.PI })),
    ];
    this.createStructures();
  }

  /** Colisor de cada estrutura (criado pelo mapa) e a altura original dele. */
  private readonly structureColliders = new Map<string, { collider: Collider; maxY: number }>();

  /** Estrutura derrubada: o colisor vira um toco de entulho (dá para subir). */
  onStructureDestroyed(s: StructureState): void {
    const sc = this.structureColliders.get(s.id);
    if (sc) sc.collider.maxY = sc.collider.minY + (s.kind === 'giant' ? 2.2 : 1.6);
  }

  /** Torres e gigantes do mapa, com vida cheia. */
  private createStructures(): void {
    this.state.structures = this.map.structures.map((d, i) => {
      const def = STRUCTURES[d.kind];
      return {
        id: `${d.kind}-${d.team}-${i}`,
        kind: d.kind,
        team: d.team,
        position: { x: d.x, y: this.world.terrain.sample(d.x, d.z), z: d.z },
        velocity: { x: 0, y: 0, z: 0 },
        // Olha para o lado inimigo (time 0 olha para o norte, -Z).
        yaw: d.team === 0 ? 0 : Math.PI,
        health: def.maxHealth,
        maxHealth: def.maxHealth,
        destroyed: false,
        vulnerable: d.kind === 'tower',
        targetId: null,
        windup: 0,
        cooldown: 0,
        lastAttackerId: null,
      };
    });
    // Liga cada estrutura ao colisor que o mapa criou no mesmo lugar (e o reergue).
    for (const st of this.state.structures) {
      let sc = this.structureColliders.get(st.id);
      if (!sc) {
        const collider = this.world.colliders.find((c) => c.kind === 'cylinder' && Math.abs(c.x - st.position.x) < 0.01 && Math.abs(c.z - st.position.z) < 0.01);
        if (!collider) continue;
        sc = { collider, maxY: collider.maxY };
        this.structureColliders.set(st.id, sc);
      }
      sc.collider.maxY = sc.maxY;
    }
  }

  /** Time de um personagem, tropa ou estrutura (null = neutro: criaturas da selva, bonecos). */
  teamOf(id: string): Team | null {
    if (!this.teams) return null;
    const c = this.getCharacter(id);
    if (c) return c.team;
    const m = this.state.mobs.find((x) => x.id === id);
    if (m) return m.team ?? null;
    const s = this.state.structures.find((x) => x.id === id);
    return s ? s.team : null;
  }

  /** Mesmo time (aliados não se ferem). */
  sameTeam(a: string, b: string): boolean {
    if (a === b) return false;
    const ta = this.teamOf(a);
    return ta !== null && ta === this.teamOf(b);
  }

  getStructure(id: string): StructureState | undefined {
    return this.state.structures.find((s) => s.id === id);
  }

  addCharacter(id: string, name: string, characterId: string, bowId: string, spawn: SpawnPoint, isBot = false, team: Team = 0): CharacterState {
    const c = createCharacterState(id, name, isBot, getCharacter(characterId), bowId, spawn.x, this.world.terrain.sample(spawn.x, spawn.z), spawn.z, spawn.yaw, team);
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
    const team = botTeam(index);
    const c = this.addCharacter(id, slot.name, slot.characterId, slot.bowId ?? bowId, spawn ?? (this.teams ? this.teamSpawn(team, index + 1) : this.spawns[(index + 1) % this.spawns.length]), true, team);
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

  /** Personagem, mob ou estrutura (de pé) com esse id. */
  getCombatant(id: string): Combatant | undefined {
    return this.getCharacter(id) ?? this.state.mobs.find((m) => m.id === id && m.mode !== 'dead') ?? this.state.structures.find((s) => s.id === id && !s.destroyed);
  }

  /** Nome para mostrar (placar, lista de abates). */
  nameOf(id: string): string {
    const c = this.getCharacter(id);
    if (c) return c.name;
    const m = this.state.mobs.find((x) => x.id === id);
    if (m) return MOBS[m.typeId].name;
    if (id === 'zone') return 'Zona';
    const s = this.getStructure(id);
    return s ? `${STRUCTURES[s.kind].name} ${s.team === 0 ? 'azul' : 'vermelha'}`.replace('Gigante vermelha', 'Gigante vermelho') : '?';
  }

  private hitboxCache: Hitbox[] | null = null;

  /** Tudo que pode ser atingido agora (calculado no máximo uma vez por fase do tick). */
  hitboxes(): Hitbox[] {
    if (this.hitboxCache) return this.hitboxCache;
    const list: Hitbox[] = [];
    for (const t of this.state.targets) if (t.respawnTimer <= 0) list.push(targetHitbox(t));
    for (const c of this.state.characters) if (isAlive(c)) list.push(characterHitbox(c));
    for (const m of this.state.mobs) if (m.mode !== 'dead') list.push(mobHitbox(m));
    for (const s of this.state.structures) if (!s.destroyed) list.push(structureHitbox(s));
    this.hitboxCache = list;
    return list;
  }

  /** Posições/vidas mudaram: as hitboxes precisam ser recalculadas. */
  invalidateHitboxes(): void {
    this.hitboxCache = null;
  }

  /** Ponto `i` da base do time (repete se houver mais personagens que pontos). */
  teamSpawn(team: Team, i: number): SpawnPoint {
    const list = this.teamSpawns[team];
    return list[i % list.length];
  }

  /** Ponto de nascimento: na base do time; o mais livre de gente (com um pouco de sorte). */
  pickSpawn(forId: string): SpawnPoint {
    const me = this.getCharacter(forId);
    if (me && this.teams) {
      let best = this.teamSpawns[me.team][0];
      let bestScore = -Infinity;
      for (const s of this.teamSpawns[me.team]) {
        let nearest = 99;
        for (const c of this.state.characters) {
          if (c.id === forId || !isAlive(c)) continue;
          nearest = Math.min(nearest, Math.hypot(c.position.x - s.x, c.position.z - s.z));
        }
        const score = nearest + this.rng.range(0, 3);
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
      return best;
    }
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
    SPECIAL_MOBS.forEach((m, i) => (this.specialMobTimers[i] = m.firstDelay));
    this.state.match = newMatch();
    if (this.royale) {
      this.zoneRng = new Random((Date.now() ^ 0x5eed) >>> 0);
      this.state.match.zone = newZone(this);
    }
    this.waveQueue.length = 0;
    this.createStructures();
    const perTeam = [0, 0];
    this.state.characters.forEach((c, i) => {
      const sp = this.teams ? this.teamSpawn(c.team, perTeam[c.team]++) : this.spawns[i % this.spawns.length];
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
      stepAbility(this, c, cmd, dt);
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

    // Torres, gigantes, ondas de tropas, votação e fim da partida (systems/objectives.ts).
    if (this.royale) stepRoyale(this, dt);
    else stepObjectives(this, dt);
    if (!match.ended) match.elapsed += dt;
    this.state.tick++;
  }
}
