// Estado puro de um mob.
import type { Vec3 } from '../core/math';

export type MobMode = 'idle' | 'wander' | 'chase' | 'attack' | 'return' | 'dead';

export interface MobState {
  id: string;
  typeId: string;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  health: number;
  mode: MobMode;
  /** Personagem que está perseguindo/atacando. */
  targetId: string | null;
  /** Índice do ponto de spawn de origem. */
  spawnIndex: number;
  /** Centro da área de origem (ponto de spawn). */
  home: { x: number; z: number };
  /** Ponto para onde está andando à toa. */
  wanderTo: { x: number; z: number } | null;
  /** Tempo restante no modo atual (espera, preparação do golpe, corpo no chão). */
  timer: number;
  /** Tempo até poder atacar de novo (s). */
  attackCooldown: number;
  grounded: boolean;
  lastAttackerId: string | null;
  /** > 0 enquanto congelado (mais lento), s. */
  slowTimer: number;
  /** Tropa do modo Gigantes: time, trilha (índice em map.lanes) e próximo ponto dela. */
  team?: 0 | 1;
  lane?: number;
  laneStep?: number;
}

/** Item no chão (por enquanto, só arcos). */
export interface LootState {
  id: number;
  bowId: string;
  position: Vec3;
  age: number;
}
