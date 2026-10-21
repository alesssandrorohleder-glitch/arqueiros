// Alvos de treino (bonecos de palha). Têm vida, caem e voltam.
import type { Vec3 } from '../core/math';

export interface TargetState {
  id: string;
  position: Vec3;
  /** Para onde o boneco está virado (rad). */
  yaw: number;
  health: number;
  maxHealth: number;
  /** > 0 enquanto está caído, contando até voltar (s). */
  respawnTimer: number;
}

/** Medidas da hitbox do boneco (m, a partir da base). */
export const DUMMY_HITBOX = {
  bodyRadius: 0.32,
  bodyBottom: 0.55,
  bodyTop: 1.45,
  headRadius: 0.2,
  headY: 1.68,
};
