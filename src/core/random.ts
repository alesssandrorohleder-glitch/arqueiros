// Gerador pseudoaleatório com semente: o mapa sai igual em toda execução
// (importante para o multiplayer, onde todos precisam ver o mesmo mapa).
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Número em [0, 1). Algoritmo mulberry32. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

/** Ruído suave determinístico (soma de senos), barato e sem tabelas. */
export function smoothNoise(x: number, z: number): number {
  return (
    Math.sin(x * 1.0 + 1.7) * Math.cos(z * 0.9 - 0.4) * 0.5 +
    Math.sin(x * 2.3 - z * 1.7 + 3.1) * 0.25 +
    Math.cos(x * 4.1 + z * 3.7 + 0.7) * 0.125 +
    Math.sin(x * 7.9 - z * 8.3 + 2.2) * 0.0625
  ) / 0.9375;
}

/** Ruído "pixelado" por coordenada inteira, em [0, 1). */
export function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
