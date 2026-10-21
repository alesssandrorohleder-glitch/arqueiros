// O que bots e mobs precisam saber de um alvo: personagem ou mob.
import type { Vec3 } from '../core/math';

export interface Combatant {
  id: string;
  position: Vec3;
  velocity: Vec3;
  health: number;
}
