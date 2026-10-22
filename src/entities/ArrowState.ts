// Estado puro de uma flecha em voo ou cravada.
import type { ArrowTrail } from '../data/characters';
import type { Vec3 } from '../core/math';
import type { BowEffect } from '../data/bows';
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
  /** Rastro do personagem que atirou (o mago tem rastro mágico). */
  trail: ArrowTrail;
  /** Efeito especial do arco que atirou. */
  effect: BowEffect | null;
  /**
   * Caminho que a flecha visual percorre (pontos já calculados pelo tiro
   * instantâneo). Vazio = chegou. O dano já foi aplicado no disparo.
   */
  path: Vec3[];
  /** Ao chegar no fim do caminho: crava (cenário/alvo/mob) ou some. */
  endStick: boolean;
}
