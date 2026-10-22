// Estado puro de uma torre ou gigante (modo Gigantes).
import type { Vec3 } from '../core/math';
import type { StructureKind, Team } from '../data/objectives';

export interface StructureState {
  id: string;
  kind: StructureKind;
  team: Team;
  position: Vec3;
  /** Sempre parado (para servir de alvo como um Combatant). */
  velocity: Vec3;
  /** Para onde está virado (rad): o gigante olha para o lado inimigo. */
  yaw: number;
  health: number;
  maxHealth: number;
  /** Já foi derrubado. */
  destroyed: boolean;
  /** Pode levar dano (o gigante só depois das duas torres do time caírem). */
  vulnerable: boolean;
  /** Alvo atual do ataque. */
  targetId: string | null;
  /** > 0 enquanto prepara o golpe (gigante), s. */
  windup: number;
  /** Tempo até poder atacar de novo (s). */
  cooldown: number;
  lastAttackerId: string | null;
}
