// Uma sala = uma partida rodando no servidor. Usa a mesma Simulation do jogo
// offline (autoritativa): os clientes mandam comandos, a sala aplica e manda
// snapshots. Bots completam a sala enquanto houver poucos jogadores.
import type { WebSocket } from 'ws';
import type { GameEvent } from '../src/core/events';
import { Simulation } from '../src/core/Simulation';
import { BOT_ROSTER } from '../src/data/bots';
import { characterBowId, DEFAULT_BOW_ID } from '../src/data/bows';
import { getSkin } from '../src/data/skins';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../src/data/characters';
import type { MapDef } from '../src/data/maps/arena';
import type { InputCommand } from '../src/entities/InputCommand';
import type { CollisionWorld } from '../src/systems/collision';
import { stepCharacter } from '../src/systems/movement';
import type { Hitbox } from '../src/systems/hitboxes';
import { encodeSnapshot, SNAPSHOT_RATE, type ServerMessage } from '../src/net/protocol';

/**
 * Skin pedida pelo cliente, se existir e for do personagem. (Por enquanto todas
 * estão liberadas; quando forem pagas, conferir aqui a posse confirmada no servidor.)
 */
function validSkin(characterId: string, skin: string): string | undefined {
  const s = getSkin(skin);
  return s && s.characterId === characterId ? s.id : undefined;
}

export const MAX_PLAYERS = 8;
/** Total de participantes (jogadores + bots) que a sala tenta manter. */
const TARGET_PARTICIPANTS = 6;
/** Tempo mostrando o placar antes da próxima partida (s). */
const INTERMISSION = 12;
const TICK_RATE = 60;
/** Fila máxima de comandos por jogador (proteção: acima disso descarta os velhos). */
const MAX_QUEUE = 60;
/**
 * Comandos que podem ficar esperando. Se juntar mais (servidor atrasou ou a rede
 * entregou em rajada), o movimento dos extras é aplicado já neste tick — antes eles
 * eram descartados, o servidor andava menos que o aparelho previu e puxava o boneco
 * para trás o tempo todo (o "tremendo como se tivesse dois corpos").
 */
const MAX_BACKLOG = 8;
/**
 * Compensação de atraso: até quantos ticks (~0,4 s) o tiro de um jogador pode
 * "voltar no tempo". O aparelho mostra os outros um pouco no passado (rede +
 * suavização); o tiro é conferido contra onde os alvos estavam naquela tela.
 */
const MAX_REWIND = 24;

interface Player {
  id: string;
  ws: WebSocket;
  queue: { seq: number; cmd: InputCommand }[];
  ack: number;
}

export class Room {
  readonly sim: Simulation;
  readonly players = new Map<string, Player>();
  private nextPlayer = 1;
  private intermission = 0;
  private eventBuffer: GameEvent[] = [];
  private ticksPerSnapshot = Math.round(TICK_RATE / SNAPSHOT_RATE);

  /** Hitboxes de personagens e criaturas nos últimos ticks (compensação de atraso). */
  private readonly history: { tick: number; boxes: Map<string, Hitbox> }[] = [];
  /** Tick que cada jogador via na tela no último comando. */
  private readonly viewTicks = new Map<string, number>();

  /** Sala privada vazia desde (ms); some depois de um tempo sem ninguém. */
  emptySince = 0;

  /** isPrivate: só entra quem tem o código (o id da sala). */
  constructor(readonly id: string, world: CollisionWorld, readonly map: MapDef, readonly isPrivate = false) {
    this.sim = new Simulation(world, map);
    this.sim.shotHitboxProvider = (id) => this.rewoundHitboxes(id);
    this.sim.addBots(DEFAULT_BOW_ID, TARGET_PARTICIPANTS);
  }

  get full(): boolean {
    return this.players.size >= MAX_PLAYERS;
  }

  join(ws: WebSocket, name: string, characterId: string, skin: string): string {
    const id = `p${this.nextPlayer++}`;
    const cleanName = name.replace(/[^\p{L}\p{N}_ ]/gu, '').trim().slice(0, 16) || `Arqueiro${this.nextPlayer}`;
    // Abre espaço tirando um bot (do fim da lista).
    if (this.sim.state.characters.length >= TARGET_PARTICIPANTS) {
      const bot = [...this.sim.state.characters].reverse().find((c) => c.isBot);
      if (bot) this.sim.removeCharacter(bot.id);
    }
    // O arco é sempre o do personagem (o cliente não escolhe arco).
    this.sim.addCharacter(id, cleanName, CHARACTERS[characterId] ? characterId : DEFAULT_CHARACTER_ID, DEFAULT_BOW_ID, this.sim.pickSpawn(id));
    const c = this.sim.getCharacter(id)!;
    c.skin = validSkin(c.characterId, skin);
    c.protection = 1.5;
    this.players.set(id, { id, ws, queue: [], ack: 0 });
    this.emptySince = 0;
    this.send(ws, { t: 'welcome', id, room: this.id, seed: this.map.seed, priv: this.isPrivate || undefined });
    return id;
  }

  leave(id: string): void {
    this.players.delete(id);
    this.viewTicks.delete(id);
    this.sim.removeCharacter(id);
    // Volta um bot para completar a sala.
    for (let i = 0; i < BOT_ROSTER.length && this.sim.state.characters.length < TARGET_PARTICIPANTS; i++) {
      this.sim.addBot(i, DEFAULT_BOW_ID, this.sim.pickSpawn(`bot-${i}`));
    }
  }

  input(id: string, seq: number, cmd: InputCommand): void {
    const p = this.players.get(id);
    if (!p || seq <= p.ack) return;
    p.queue.push({ seq, cmd });
    if (p.queue.length > MAX_QUEUE) p.queue.splice(0, p.queue.length - MAX_QUEUE);
  }

  /** Troca de personagem/skin vinda do menu do cliente (o arco acompanha o personagem). */
  profile(id: string, characterId: string, skin: string): void {
    const c = this.sim.getCharacter(id);
    if (!c) return;
    if (CHARACTERS[characterId] && !c.bow.drawing) {
      c.characterId = characterId;
      c.bow.bowId = characterBowId(characterId);
    }
    c.skin = validSkin(c.characterId, skin);
  }

  /** Um tick de simulação (1/60 s). */
  tick(): void {
    const dt = 1 / TICK_RATE;
    const commands = new Map<string, InputCommand>();
    for (const p of this.players.values()) {
      while (p.queue.length > MAX_BACKLOG) {
        const extra = p.queue.shift()!;
        p.ack = extra.seq;
        const c = this.sim.getCharacter(p.id);
        if (c && c.health > 0) stepCharacter(c, extra.cmd, this.sim.world, dt);
        // Pulo e habilidade apertados no comando adiantado não se perdem.
        if (extra.cmd.jump) p.queue[0].cmd.jump = true;
        if (extra.cmd.ability) p.queue[0].cmd.ability = true;
      }
      // Sem comando novo (rede atrasou): o personagem espera parado neste tick, sem
      // repetir o último comando. Assim o servidor faz exatamente os mesmos passos que
      // o aparelho previu e não precisa corrigir a posição depois.
      const next = p.queue.shift();
      if (next) {
        p.ack = next.seq;
        commands.set(p.id, next.cmd);
        if (next.cmd.viewTick !== undefined) this.viewTicks.set(p.id, next.cmd.viewTick);
      }
    }
    this.sim.step(commands, dt);
    this.recordHistory();
    this.eventBuffer.push(...this.sim.events);

    // Fim de partida: placar por alguns segundos e começa outra.
    if (this.sim.state.match.ended) {
      this.intermission += dt;
      if (this.intermission >= INTERMISSION) {
        this.intermission = 0;
        this.sim.resetMatch();
      }
    }

    if (this.sim.state.tick % this.ticksPerSnapshot === 0) this.broadcast();
  }

  private recordHistory(): void {
    const boxes = new Map<string, Hitbox>();
    for (const hb of this.sim.hitboxes()) if (hb.kind === 'character' || hb.kind === 'mob') boxes.set(hb.id, hb);
    this.history.push({ tick: this.sim.state.tick, boxes });
    if (this.history.length > MAX_REWIND + 2) this.history.shift();
  }

  /** Hitboxes como o jogador `id` via na tela (personagens e criaturas no passado; o resto como está). */
  private rewoundHitboxes(id: string): Hitbox[] | null {
    const view = this.viewTicks.get(id);
    if (view === undefined || !this.players.has(id)) return null;
    const back = Math.min(MAX_REWIND, this.sim.state.tick - view);
    if (back < 1) return null;
    const past = this.history.find((h) => h.tick === this.sim.state.tick - back);
    if (!past) return null;
    // Só quem ainda está vivo agora pode ser atingido (no lugar onde estava).
    return this.sim.hitboxes().map((hb) => past.boxes.get(hb.id) ?? hb);
  }

  private broadcast(): void {
    const s = encodeSnapshot(this.sim.state);
    const e = this.eventBuffer;
    this.eventBuffer = [];
    for (const p of this.players.values()) {
      this.send(p.ws, { t: 'snap', tick: this.sim.state.tick, ack: p.ack, s, e });
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }
}
