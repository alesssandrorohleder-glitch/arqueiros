// Matemática de tiro balístico: com que ângulo atirar para acertar um ponto
// considerando a gravidade, e onde o alvo vai estar quando a flecha chegar.
import type { Vec3 } from '../../core/math';

/**
 * Ângulo de elevação (rad) para acertar um ponto a `dist` metros na horizontal
 * e `height` metros acima, com velocidade `v` e gravidade `g`. Usa a trajetória
 * baixa. Se o alvo estiver fora do alcance, devolve 45° (alcance máximo).
 */
export function launchAngle(dist: number, height: number, v: number, g: number): number {
  if (dist < 0.01) return height >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * dist * dist + 2 * height * v2);
  if (disc < 0) return Math.PI / 4;
  return Math.atan((v2 - Math.sqrt(disc)) / (g * dist));
}

/** Direção (yaw, pitch) e tempo de voo para acertar `target` saindo de `from`. */
export function solveShot(from: Vec3, target: Vec3, v: number, g: number): { yaw: number; pitch: number; time: number } {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const dist = Math.hypot(dx, dz);
  const pitch = launchAngle(dist, target.y - from.y, v, g);
  // yaw 0 = -Z (norte); frente = (-sen, -cos).
  const yaw = Math.atan2(-dx, -dz);
  const time = dist / Math.max(0.1, v * Math.cos(pitch));
  return { yaw, pitch, time };
}
