// "Plantas" das ruínas, em coordenadas locais (y = 0 é o chão aplainado).
// Cada peça vira malha e colisor ao ser posicionada no mapa (world/Arena.ts).
import type { Random } from '../core/random';
import type { RuinKind } from '../data/maps/arena';

export type RuinPiece =
  | { kind: 'block'; x: number; y: number; z: number; w: number; h: number; d: number; rot?: number; collide?: boolean }
  | { kind: 'column'; x: number; y: number; z: number; radius: number; height: number }
  | { kind: 'fallenColumn'; x: number; y: number; z: number; radius: number; length: number; rot: number };

const block = (x: number, y: number, z: number, w: number, h: number, d: number, rot = 0): RuinPiece =>
  ({ kind: 'block', x, y, z, w, h, d, rot });

function temple(rng: Random): RuinPiece[] {
  const p: RuinPiece[] = [];
  // Plataforma em dois níveis (degraus de 0,4 m: dá para subir andando).
  p.push(block(0, 0, 0, 18, 0.4, 18));
  p.push(block(0, 0.4, 0, 11, 0.4, 11));
  p.push(block(0, 0.8, 0, 1.8, 1.0, 1.1)); // altar

  // Anel de colunas, com entradas ao norte e ao sul.
  const full = 4.6;
  const coords = [-7.5, -3.75, 0, 3.75, 7.5];
  const ring: { x: number; z: number }[] = [];
  for (const c of coords) {
    ring.push({ x: c, z: -7.5 }, { x: c, z: 7.5 });
    if (Math.abs(c) < 7.5) ring.push({ x: -7.5, z: c }, { x: 7.5, z: c });
  }
  const tall = new Set<string>();
  for (const { x, z } of ring) {
    if (x === 0 && Math.abs(z) === 7.5) continue; // entradas
    const isTall = rng.chance(0.55);
    const height = isTall ? full : rng.range(0.9, 3.0);
    p.push({ kind: 'column', x, y: 0.4, z, radius: 0.45, height });
    if (isTall) {
      tall.add(`${x},${z}`);
      p.push(block(x, 0.4 + full, z, 1.2, 0.35, 1.2)); // capitel
    }
  }
  // Vigas sobre pares de colunas inteiras vizinhas.
  for (const { x, z } of ring) {
    if (!tall.has(`${x},${z}`)) continue;
    const top = 0.4 + full + 0.35;
    if (Math.abs(z) === 7.5 && tall.has(`${x + 3.75},${z}`)) p.push(block(x + 1.875, top, z, 4.9, 0.6, 1.0));
    if (Math.abs(x) === 7.5 && tall.has(`${x},${z + 3.75}`)) p.push(block(x, top, z + 1.875, 1.0, 0.6, 4.9));
  }
  // Colunas caídas e pedaços soltos.
  p.push({ kind: 'fallenColumn', x: -10.5, y: 0, z: 4, radius: 0.45, length: 4.2, rot: 0.4 });
  p.push({ kind: 'fallenColumn', x: 11, y: 0, z: -6, radius: 0.45, length: 3.4, rot: -1.1 });
  p.push(block(10.5, 0, 5, 1.2, 0.8, 1.0, 0.5));
  p.push(block(-4, 0.8, -3.5, 1.0, 0.5, 0.8, 0.9));
  return p;
}

function tower(): RuinPiece[] {
  const p: RuinPiece[] = [];
  const top = 4.2;
  p.push(block(0, 0, 0, 6, top, 6)); // base maciça
  // Escada externa no lado leste: 10 degraus de 0,42 m.
  const steps = 10;
  for (let k = 0; k < steps; k++) {
    p.push(block(3.7, 0, 3 - 0.3 - k * 0.6, 1.4, ((k + 1) * top) / steps, 0.6));
  }
  // Ameias no topo (com uma passagem no canto nordeste, onde a escada chega).
  for (let k = -2.5; k <= 2.5; k += 1.25) {
    if (k < 2.5) p.push(block(k, top, -2.6, 0.8, 0.9, 0.8));
    p.push(block(k, top, 2.6, 0.8, 0.9, 0.8));
    p.push(block(-2.6, top, k, 0.8, 0.9, 0.8));
    if (k > 0) p.push(block(2.6, top, k, 0.8, 0.9, 0.8));
  }
  return p;
}

function wall(rng: Random): RuinPiece[] {
  const p: RuinPiece[] = [];
  const t = 0.8;
  // Muro principal com uma abertura (porta) e topo quebrado.
  for (let i = 0; i < 6; i++) {
    if (i === 2) continue;
    const h = i === 1 || i === 3 ? 3.2 : rng.range(1.3, 3.0);
    p.push(block(-5 + i * 2 + 1, 0, 0, 2, h, t));
  }
  p.push(block(-2, 2.4, 0, 2, 0.8, t)); // verga sobre a porta
  // Muro perpendicular, mais baixo.
  for (let i = 0; i < 3; i++) {
    p.push(block(-5 + t / 2, 0, t / 2 + 1 + i * 2, t, rng.range(1.1, 2.4), 2));
  }
  // Entulho.
  p.push(block(1.5, 0, 2.2, 1.2, 0.6, 0.9, 0.6));
  p.push(block(3.4, 0, -1.8, 0.9, 0.5, 0.9, 1.2));
  return p;
}

function arch(): RuinPiece[] {
  return [
    block(-2.3, 0, 0, 1.2, 4.2, 1.2),
    block(2.3, 0, 0, 1.2, 4.2, 1.2),
    block(0, 4.2, 0, 6.0, 0.8, 1.4),
    block(-3.6, 0, 1.2, 1.0, 0.7, 1.0, 0.4),
  ];
}

function rubble(rng: Random): RuinPiece[] {
  const p: RuinPiece[] = [];
  p.push(block(0, 0, 0, 4.5, 1.6, 0.8));
  p.push(block(-1.8, 0, 2.2, 0.8, 1.1, 3.2));
  p.push({ kind: 'column', x: 2.8, y: 0, z: 2.6, radius: 0.45, height: rng.range(1.5, 2.6) });
  p.push({ kind: 'fallenColumn', x: 1.2, y: 0, z: 4.2, radius: 0.42, length: 3.2, rot: 1.3 });
  for (let i = 0; i < 4; i++) {
    const s = rng.range(0.5, 1.0);
    p.push(block(rng.range(-3, 3), 0, rng.range(-2.5, 5), s, s * 0.7, s, rng.range(0, 3)));
  }
  return p;
}

export function buildRuin(kind: RuinKind, rng: Random): RuinPiece[] {
  switch (kind) {
    case 'temple': return temple(rng);
    case 'tower': return tower();
    case 'wall': return wall(rng);
    case 'arch': return arch();
    case 'rubble': return rubble(rng);
  }
}
