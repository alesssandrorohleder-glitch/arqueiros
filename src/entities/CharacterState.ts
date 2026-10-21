// Estado puro de um personagem (jogador ou bot). Nada de Three.js aqui:
// é isto que será sincronizado pela rede no multiplayer.
import { vec3, type Vec3 } from '../core/math';
import type { CharacterDef } from '../data/characters';

export type MoveState = 'idle' | 'walk' | 'run' | 'air';

export interface CharacterState {
  id: string;
  characterId: string;
  position: Vec3;
  velocity: Vec3;
  /** Para onde o corpo está virado (rad). */
  bodyYaw: number;
  aimYaw: number;
  aimPitch: number;
  grounded: boolean;
  /** Tempo desde que saiu do chão (para o coyote time). */
  airTime: number;
  /** Tempo restante do pulo "guardado" (jump buffer). */
  jumpBuffer: number;
  moveState: MoveState;
  health: number;
}

export function createCharacterState(id: string, def: CharacterDef, x: number, y: number, z: number, yaw: number): CharacterState {
  return {
    id,
    characterId: def.id,
    position: vec3(x, y, z),
    velocity: vec3(),
    bodyYaw: yaw,
    aimYaw: yaw,
    aimPitch: 0,
    grounded: false,
    airTime: 0,
    jumpBuffer: 0,
    moveState: 'idle',
    health: def.maxHealth,
  };
}
