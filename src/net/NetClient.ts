// Conexão do jogo com o servidor online: entra numa sala, manda um comando
// por tick e guarda os snapshots que chegam para o Game aplicar.
import type { InputCommand } from '../entities/InputCommand';
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from './protocol';

export type NetStatus = 'connecting' | 'online' | 'closed';
type Snap = Extract<ServerMessage, { t: 'snap' }>;

/** Endereço do servidor: ?server=..., ou VITE_GAME_SERVER_URL ("same" = o próprio site). */
export function gameServerUrl(override?: string | null): string | null {
  const raw = override || (import.meta.env.VITE_GAME_SERVER_URL as string | undefined) || '';
  if (!raw) return null;
  if (raw === 'same') {
    if (!/^https?:$/.test(location.protocol)) return null;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }
  return raw;
}

export class NetClient {
  status: NetStatus = 'connecting';
  /** Id do jogador nesta sala (chega no "welcome"). */
  id: string | null = null;
  room = '';
  error = '';
  /** Ida e volta até o servidor (ms). */
  ping = 0;
  /** Comandos enviados que o servidor ainda não confirmou (para a previsão). */
  readonly pending: { seq: number; cmd: InputCommand }[] = [];
  private readonly inbox: Snap[] = [];
  private readonly ws: WebSocket;
  private seq = 0;
  private pingTimer = 0;

  constructor(url: string, join: { name: string; characterId: string; bowId: string }, private readonly onClose: (reason: string) => void) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener('open', () => {
      this.send({ t: 'join', v: PROTOCOL_VERSION, ...join });
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping', time: performance.now() }), 2000);
    });
    this.ws.addEventListener('message', (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.t === 'welcome') {
        this.id = msg.id;
        this.room = msg.room;
        this.status = 'online';
      } else if (msg.t === 'snap') {
        this.inbox.push(msg);
      } else if (msg.t === 'pong') {
        this.ping = Math.round(performance.now() - msg.time);
      } else if (msg.t === 'error') {
        this.error = msg.message;
      }
    });
    this.ws.addEventListener('close', () => {
      window.clearInterval(this.pingTimer);
      const was = this.status;
      this.status = 'closed';
      this.onClose(this.error || (was === 'connecting' ? 'Não foi possível conectar ao servidor.' : 'A conexão com o servidor caiu.'));
    });
  }

  sendInput(cmd: InputCommand): void {
    if (this.status !== 'online') return;
    const seq = ++this.seq;
    this.pending.push({ seq, cmd });
    if (this.pending.length > 120) this.pending.shift();
    this.send({ t: 'input', seq, cmd });
  }

  sendProfile(characterId: string, bowId: string): void {
    this.send({ t: 'profile', characterId, bowId });
  }

  /** Snapshots recebidos desde a última chamada. */
  drain(): Snap[] {
    return this.inbox.splice(0);
  }

  /** Descarta comandos já confirmados pelo servidor. */
  acknowledge(ack: number): void {
    while (this.pending.length && this.pending[0].seq <= ack) this.pending.shift();
  }

  close(): void {
    this.ws.close();
  }

  private send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
