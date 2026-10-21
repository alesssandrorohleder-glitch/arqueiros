// Utilidades matemáticas sem dependência do Three.js (usadas na simulação).

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Normaliza um ângulo para o intervalo (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

/** Aproxima o ângulo `from` de `to` em no máximo `maxDelta`, pelo caminho mais curto. */
export function approachAngle(from: number, to: number, maxDelta: number): number {
  const diff = wrapAngle(to - from);
  if (Math.abs(diff) <= maxDelta) return to;
  return from + Math.sign(diff) * maxDelta;
}

/** Suavização exponencial independente de FPS. */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

/** Distância de um ponto a um segmento no plano XZ. */
export function distToSegment2D(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1) : 0;
  const cx = ax + dx * t - px;
  const cz = az + dz * t - pz;
  return Math.sqrt(cx * cx + cz * cz);
}
