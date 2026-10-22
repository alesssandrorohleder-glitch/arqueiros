// "Plantas" das ruínas, em coordenadas locais (y = 0 é o chão aplainado).
// Cada peça vira malha e colisor ao ser posicionada no mapa (world/Arena.ts).
import type { Random } from '../core/random';
import type { RuinKind } from '../data/maps/arena';

export type RuinPiece =
  | { kind: 'block'; x: number; y: number; z: number; w: number; h: number; d: number; rot?: number; collide?: boolean; wood?: boolean }
  /** Viga/tábua inclinada, só visual (sem colisão). (x, y, z) = centro. */
  | { kind: 'beam'; x: number; y: number; z: number; w: number; h: number; d: number; rx: number; ry: number; rz: number; wood?: boolean }
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

const wood = (x: number, y: number, z: number, w: number, h: number, d: number, rot = 0): RuinPiece =>
  ({ kind: 'block', x, y, z, w, h, d, rot, wood: true });
const beam = (x: number, y: number, z: number, w: number, h: number, d: number, rx: number, ry = 0, rz = 0, isWood = true): RuinPiece =>
  ({ kind: 'beam', x, y, z, w, h, d, rx, ry, rz, wood: isWood });

/**
 * Casa meio destruída: paredes de pedra com o topo quebrado, porta e janelas,
 * uma parede desmoronada, chaminé, metade do telhado de vigas e entulho.
 * Dá para entrar (cobertura) e subir na parede baixa pulando.
 */
function house(rng: Random): RuinPiece[] {
  const p: RuinPiece[] = [];
  const W = 7;
  const D = 5.6;
  const T = 0.4;
  const H = 3.0;
  const chunk = 0.7;
  // Qual parede desmoronou (0 = fundo, 1 = esquerda, 2 = direita).
  const broken = rng.int(0, 2);
  type Hole = { a0: number; a1: number; y0: number; y1: number };
  /** Parede de `from` a `to` ao longo de X (axis 'x', em z fixo) ou de Z (axis 'z', em x fixo). */
  const wallRun = (axis: 'x' | 'z', fixed: number, from: number, to: number, height: (t: number) => number, holes: Hole[]) => {
    const n = Math.round((to - from) / chunk);
    const step = (to - from) / n;
    for (let i = 0; i < n; i++) {
      const a = from + (i + 0.5) * step;
      const h = Math.max(0.3, height(i / (n - 1)));
      const hole = holes.find((o) => a > o.a0 && a < o.a1);
      const parts: [number, number][] = hole ? [[0, hole.y0], [hole.y1, h]] : [[0, h]];
      for (const [y0, y1] of parts) {
        if (y1 - y0 < 0.15) continue;
        if (axis === 'x') p.push(block(a, y0, fixed, step + 0.02, y1 - y0, T));
        else p.push(block(fixed, y0, a, T, y1 - y0, step + 0.02));
      }
    }
  };
  const jagged = () => H - rng.range(0, 0.7);
  const intact = (t: number) => (t === 0 || t === 1 ? H : jagged());
  const collapse = (t: number) => 0.5 + (H - 0.5) * Math.max(0, 1 - t * 1.4) * rng.range(0.7, 1);
  // Frente (porta e janela).
  wallRun('x', -D / 2, -W / 2, W / 2, intact, [{ a0: -0.7, a1: 0.7, y0: 0, y1: 2.2 }, { a0: 1.5, a1: 2.7, y0: 1.0, y1: 2.0 }]);
  // Fundo.
  wallRun('x', D / 2, -W / 2, W / 2, broken === 0 ? collapse : intact, [{ a0: -2.6, a1: -1.4, y0: 1.0, y1: 2.0 }]);
  // Laterais (entre a frente e o fundo).
  wallRun('z', -W / 2 + T / 2, -D / 2 + T, D / 2 - T, broken === 1 ? collapse : intact, [{ a0: -0.6, a1: 0.6, y0: 1.0, y1: 2.0 }]);
  wallRun('z', W / 2 - T / 2, -D / 2 + T, D / 2 - T, broken === 2 ? collapse : intact, []);
  // Piso de tábuas e chaminé de pedra (quebrada no alto).
  p.push(wood(0, 0, 0, W - 2 * T, 0.1, D - 2 * T));
  p.push(block(-W / 2 - 0.45, 0, 1.2, 0.9, rng.range(3.6, 4.6), 1.0));

  // Telhado: cumeeira e caibros só na metade que ficou de pé; tábuas por cima de parte dela.
  const ridgeY = H + 1.4;
  const slope = Math.atan2(1.4, D / 2);
  const rafterLen = Math.hypot(1.4, D / 2) + 0.3;
  const roofEnd = rng.range(-0.6, 0.8);
  p.push(beam((-W / 2 - 0.2 + roofEnd) / 2, ridgeY, 0, roofEnd + W / 2 + 0.2, 0.2, 0.2, 0));
  for (let x = -W / 2 + 0.2; x <= roofEnd; x += 0.85) {
    for (const side of [-1, 1]) p.push(beam(x, H + 0.7, (side * D) / 4, 0.14, 0.14, rafterLen, side * slope));
  }
  const boardsEnd = roofEnd - 1.2;
  if (boardsEnd > -W / 2 + 0.5) {
    for (const side of [-1, 1]) {
      const len = boardsEnd + W / 2 + 0.2;
      p.push(beam(-W / 2 - 0.2 + len / 2, H + 0.78, (side * D) / 4, len, 0.06, rafterLen - 0.1, side * slope));
    }
  }
  // Viga caída apoiada na parede, tábuas e pedras no chão.
  p.push(beam(roofEnd + 1.6, 1.2, 0.6, 0.18, 0.18, 3.4, 0.7, 0.4, 0.2));
  p.push(beam(1.8, 0.12, -0.8, 1.6, 0.05, 0.3, 0, 0.6, 0.05));
  p.push(beam(-1.5, 0.12, 1.4, 1.2, 0.05, 0.25, 0, -0.9, -0.04));
  // Porta caída do lado de fora.
  p.push(beam(0.3, 0.08, -D / 2 - 1.0, 1.1, 0.07, 1.9, 0, 0.3, 0));
  for (let i = 0; i < 5; i++) {
    const s = rng.range(0.4, 0.8);
    const side = broken === 0 ? D / 2 + rng.range(0.4, 1.8) : rng.range(-1.5, 1.5);
    const along = broken === 0 ? rng.range(-W / 2, W / 2) : (broken === 1 ? -1 : 1) * (W / 2 + rng.range(0.4, 1.6));
    p.push(block(along, 0, side, s, s * 0.6, s, rng.range(0, 3)));
  }
  return p;
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
    case 'house': return house(rng);
  }
}
