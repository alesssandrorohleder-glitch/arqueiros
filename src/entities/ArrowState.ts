// Estado puro de uma flecha em voo ou cravada.
import type { Vec3 } from '../core/math';
import type { Rarity } from '../data/rarities';

export interface ArrowState {
  id: number;
  ownerId: string;
  position: Vec3;
  velocity: Vec3;
  /** Dano no corpo (já com a carga aplicada). */
  damage: number;
  rarity: Rarity;
  /** Tempo de voo ou, se cravada, tempo cravada (s). */
  age: number;
  /** Cravada em algo (não se move mais). */
  stuck: boolean;
  /** Direção em que ficou cravada (para o visual). */
  stuckDir: Vec3 | null;
  /** Se cravou num alvo, o id dele (some quando o alvo cai). */
  stuckToTarget: string | null;
}
