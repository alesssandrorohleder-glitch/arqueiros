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
/** Fila máxima de comandos por jogador (se o cliente adiantar, descarta os velhos). */
const MAX_QUEUE = 8;
/** Por quantos ticks repetir o último comando quando a rede atrasa (~0,1 s). */
const MAX_REPEAT_TICKS = 6;

interface Player {
  id: string;
  ws: WebSocket;
  queue: { seq: number; cmd: InputCommand }[];
  last: InputCommand | null;
  ack: number;
  /** Ticks seguidos sem comando novo. */
  missed: number;
}

export class Room {
  readonly sim: Simulation;
  readonly players = new Map<string, Player>();
  private nextPlayer = 1;
  private intermission = 0;
  private eventBuffer: GameEvent[] = [];
  private ticksPerSnapshot = Math.round(TICK_RATE / SNAPSHOT_RATE);

  constructor(readonly id: string, world: CollisionWorld, readonly map: MapDef) {
    this.sim = new Simulation(world, map);
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
    this.players.set(id, { id, ws, queue: [], last: null, ack: 0, missed: 0 });
    this.send(ws, { t: 'welcome', id, room: this.id, seed: this.map.seed });
    return id;
  }

  leave(id: string): void {
    this.players.delete(id);
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
      const next = p.queue.shift();
      if (next) {
        p.ack = next.seq;
        p.last = next.cmd;
        p.missed = 0;
        commands.set(p.id, next.cmd);
      } else if (p.last) {
        // Sem comando novo (rede atrasou): repete o último por pouco tempo;
        // depois disso o personagem para (não sai correndo sozinho).
        p.missed++;
        const stale = p.missed > MAX_REPEAT_TICKS;
        commands.set(p.id, { ...p.last, jump: false, equipBowId: null, ...(stale ? { forward: 0, right: 0, sprint: false } : {}) });
      }
    }
    this.sim.step(commands, dt);
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
