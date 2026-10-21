// Texturas geradas por código (canvas): grama, terra, rocha, pedra das ruínas,
// casca de árvore e folhas. Nada é baixado: o jogo fica leve e sem licenças.
import * as THREE from 'three';
import { Random } from '../core/random';

type RGB = [number, number, number];

/** Ruído de valor que "fecha" nas bordas (a textura repete sem emenda). */
class TileNoise {
  private readonly grids: Float32Array[] = [];
  constructor(private readonly base: number, private readonly octaves: number, rng: Random) {
    for (let o = 0; o < octaves; o++) {
      const n = base << o;
      const g = new Float32Array(n * n);
      for (let i = 0; i < g.length; i++) g[i] = rng.next();
      this.grids.push(g);
    }
  }

  /** u, v em [0, 1). Retorna ~[0, 1]. */
  sample(u: number, v: number): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < this.octaves; o++) {
      const n = this.base << o;
      const g = this.grids[o];
      const x = u * n;
      const y = v * n;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const i0 = ((x0 % n) + n) % n;
      const j0 = ((y0 % n) + n) % n;
      const i1 = (i0 + 1) % n;
      const j1 = (j0 + 1) % n;
      const a = g[j0 * n + i0] + (g[j0 * n + i1] - g[j0 * n + i0]) * sx;
      const b = g[j1 * n + i0] + (g[j1 * n + i1] - g[j1 * n + i0]) * sx;
      sum += (a + (b - a) * sy) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  }
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function toTexture(canvas: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Pinta pixel a pixel a partir de uma função de cor. */
function paintPixels(size: number, fn: (u: number, v: number) => RGB): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

export interface TextureSet {
  grass: THREE.Texture;
  dirt: THREE.Texture;
  rock: THREE.Texture;
  stone: THREE.Texture;
  bark: THREE.Texture;
  leaves: THREE.Texture;
  needles: THREE.Texture;
}

export function createTextures(seed: number, size = 512): TextureSet {
  const rng = new Random(seed);

  const gN = new TileNoise(8, 5, rng);
  const gFine = new TileNoise(64, 2, rng);
  const grass = paintPixels(size, (u, v) => {
    const n = gN.sample(u, v);
    const f = gFine.sample(u, v);
    let c = mix([62, 98, 38], [104, 136, 52], n);
    c = mix(c, [128, 128, 66], Math.max(0, f - 0.62) * 1.6); // pontas secas
    return shade(c, 0.82 + f * 0.3);
  });

  const dN = new TileNoise(6, 5, rng);
  const dFine = new TileNoise(96, 2, rng);
  const dirt = paintPixels(size, (u, v) => {
    const n = dN.sample(u, v);
    const f = dFine.sample(u, v);
    let c = mix([112, 86, 58], [150, 122, 86], n);
    if (f > 0.78) c = mix(c, [176, 168, 150], (f - 0.78) * 4); // pedrinhas
    return shade(c, 0.85 + f * 0.25);
  });

  const rN = new TileNoise(4, 6, rng);
  const rCrack = new TileNoise(10, 3, rng);
  const rock = paintPixels(size, (u, v) => {
    const n = rN.sample(u, v);
    const ridge = 1 - Math.abs(rCrack.sample(u, v) * 2 - 1);
    let c = mix([92, 90, 86], [150, 146, 138], n);
    c = shade(c, 0.75 + 0.3 * Math.pow(ridge, 0.5));
    if (ridge > 0.93) c = shade(c, 0.6); // rachaduras
    return c;
  });

  // Pedra das ruínas: blocos com rejunte, cada bloco com um tom.
  const sN = new TileNoise(16, 4, rng);
  const rows = 6;
  const blockTones = Array.from({ length: rows * 4 }, () => rng.range(0.85, 1.12));
  const stone = paintPixels(size, (u, v) => {
    const row = Math.floor(v * rows);
    const offset = row % 2 ? 0.125 : 0;
    const cols = 4;
    const uu = (u + offset) % 1;
    const col = Math.floor(uu * cols);
    const lu = uu * cols - col;
    const lv = v * rows - row;
    const mortar = Math.min(lu, 1 - lu, (lv * cols) / rows * 1.5, ((1 - lv) * cols) / rows * 1.5);
    const n = sN.sample(u, v);
    let c: RGB = mix([150, 142, 126], [196, 188, 170], n);
    c = shade(c, blockTones[(row * cols + col) % blockTones.length]);
    if (mortar < 0.035) c = mix([96, 90, 80], c, mortar / 0.035);
    return c;
  });

  const bN = new TileNoise(4, 4, rng);
  const bStreak = new TileNoise(32, 2, rng);
  const bark = paintPixels(256, (u, v) => {
    const streak = bStreak.sample(u, v * 0.08);
    const n = bN.sample(u, v);
    const c = mix([58, 42, 30], [104, 82, 60], n * 0.6 + streak * 0.4);
    return shade(c, streak > 0.6 ? 1.1 : 0.85);
  });

  return {
    grass: toTexture(grass),
    dirt: toTexture(dirt),
    rock: toTexture(rock),
    stone: toTexture(stone),
    bark: toTexture(bark),
    leaves: toTexture(leafCard(rng, false), false),
    needles: toTexture(leafCard(rng, true), false),
  };
}

/** Cartão de folhagem com transparência: folhas (frondosa) ou agulhas (pinheiro). */
function leafCard(rng: Random, needles: boolean): HTMLCanvasElement {
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  if (needles) {
    // Galho de pinheiro: ramos laterais cheios (massa escura) cobertos de agulhas finas.
    ctx.lineCap = 'round';
    const branches = 7;
    for (let b = 0; b < branches; b++) {
      const y = size * (0.9 - (b / branches) * 0.78);
      const len = size * 0.44 * (1 - (b / branches) * 0.5);
      for (const side of [-1, 1]) {
        const x0 = size / 2;
        const tipX = x0 + side * len;
        const tipY = y - len * 0.35;
        ctx.fillStyle = 'rgb(28, 52, 26)';
        ctx.beginPath();
        ctx.moveTo(x0, y - 9);
        ctx.quadraticCurveTo((x0 + tipX) / 2, y - len * 0.3, tipX, tipY);
        ctx.quadraticCurveTo((x0 + tipX) / 2, y + 2, x0, y + 9);
        ctx.fill();
        for (let k = 0; k < 70; k++) {
          const t = rng.next();
          const px = x0 + (tipX - x0) * t;
          const py = y + (tipY - y) * t + rng.range(-6, 6) * (1 - t * 0.6);
          const g = rng.int(70, 125);
          ctx.strokeStyle = `rgb(${g * 0.42}, ${g}, ${g * 0.48})`;
          ctx.lineWidth = rng.range(1, 1.8);
          const a = rng.range(-1.2, 1.2) + (side < 0 ? Math.PI : 0);
          const l = rng.range(6, 11) * (1 - t * 0.4);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l - 3);
          ctx.stroke();
        }
      }
    }
    ctx.strokeStyle = 'rgb(70, 52, 36)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(size / 2, size);
    ctx.lineTo(size / 2, size * 0.1);
    ctx.stroke();
  } else {
    // Monte de folhas ovais, mais densas no centro.
    for (let i = 0; i < 140; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * size * 0.4;
      const x = size / 2 + Math.cos(a) * d;
      const y = size / 2 + Math.sin(a) * d;
      const g = rng.int(85, 150);
      const light = rng.range(0.75, 1.15);
      ctx.fillStyle = `rgb(${g * 0.5 * light}, ${g * light}, ${g * 0.35 * light})`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng.range(0, Math.PI * 2));
      ctx.beginPath();
      ctx.ellipse(0, 0, rng.range(9, 15), rng.range(4, 7), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 60, 20, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  return c;
}
