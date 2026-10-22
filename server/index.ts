// Servidor do Arqueiros: entrega o site (pasta dist/) e roda as partidas
// online por WebSocket em /ws. Rodar: npm run build:online && npm start
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { ARENA } from '../src/data/maps/arena';
import { PROTOCOL_VERSION, sanitizeCommand, type ClientMessage } from '../src/net/protocol';
import { buildArena } from '../src/world/Arena';
import { Room } from './Room';

const PORT = Number(process.env.PORT ?? 8080);
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist');
const TICK_MS = 1000 / 60;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// O mapa (colisão) é o mesmo para todas as salas: gera uma vez.
// Sem texturas no servidor (só a colisão importa).
const arena = buildArena(ARENA, new Proxy({}, { get: () => null }) as never);
const rooms: Room[] = [];
let roomCounter = 1;

function roomWithSpace(): Room {
  let room = rooms.find((r) => !r.full);
  if (!room) {
    room = new Room(`sala-${roomCounter++}`, arena.collision, ARENA);
    rooms.push(room);
    console.log(`[sala] criada ${room.id}`);
  }
  return room;
}

// ------------------------------------------------------------- HTTP (site)
const http = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.length, players: rooms.reduce((n, r) => n + r.players.size, 0) }));
    return;
  }
  // Evita sair da pasta do site (../).
  let file = normalize(join(STATIC_DIR, decodeURIComponent(url.pathname)));
  if (!file.startsWith(STATIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end('Site não encontrado: rode "npm run build:online" antes.');
    return;
  }
  const cache = file.includes(`${'/'}assets${'/'}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': cache });
  createReadStream(file).pipe(res);
});

// ------------------------------------------------------------- WebSocket (jogo)
const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (ws: WebSocket) => {
  let room: Room | null = null;
  let playerId: string | null = null;

  ws.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (msg.t === 'join' && !room) {
      if (msg.v !== PROTOCOL_VERSION) {
        ws.send(JSON.stringify({ t: 'error', message: 'Versão do jogo desatualizada. Recarregue a página.' }));
        ws.close();
        return;
      }
      room = roomWithSpace();
      playerId = room.join(ws, String(msg.name ?? ''), String(msg.characterId ?? ''), String(msg.bowId ?? ''));
      console.log(`[sala] ${playerId} entrou em ${room.id} (${room.players.size} jogadores)`);
    } else if (msg.t === 'input' && room && playerId) {
      const cmd = sanitizeCommand(msg.cmd);
      if (cmd && Number.isInteger(msg.seq)) room.input(playerId, msg.seq, cmd);
    } else if (msg.t === 'profile' && room && playerId) {
      room.profile(playerId, String(msg.characterId), String(msg.bowId));
    } else if (msg.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong', time: msg.time }));
    }
  });

  ws.on('close', () => {
    if (room && playerId) {
      room.leave(playerId);
      console.log(`[sala] ${playerId} saiu de ${room.id} (${room.players.size} jogadores)`);
      // Sala vazia: fecha.
      if (room.players.size === 0) rooms.splice(rooms.indexOf(room), 1);
    }
  });
});

// ------------------------------------------------------------- relógio das partidas
let last = performance.now();
let acc = 0;
setInterval(() => {
  const now = performance.now();
  acc = Math.min(acc + (now - last), 250);
  last = now;
  while (acc >= TICK_MS) {
    for (const r of rooms) r.tick();
    acc -= TICK_MS;
  }
}, 5);

http.listen(PORT, () => console.log(`Arqueiros: http://localhost:${PORT} (jogo online em /ws)`));
