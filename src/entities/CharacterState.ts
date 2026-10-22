// Estado puro de um personagem (jogador ou bot). Nada de Three.js aqui:
// é isto que será sincronizado pela rede no multiplayer.
import { vec3, type Vec3 } from '../core/math';
import type { CharacterDef } from '../data/characters';
import type { Team } from '../data/objectives';

export type MoveState = 'idle' | 'walk' | 'run' | 'air';

/** Estado do arco de um personagem. */
export interface BowState {
  bowId: string;
  /** Está com a corda puxada. */
  drawing: boolean;
  /** Tempo segurando a corda (s). */
  drawTime: number;
  /** Tempo restante até poder puxar de novo (s). */
  cooldown: number;
  /** Raio atual do cone de dispersão (rad). */
  spread: number;
  /** Tremor atual da mira por cansaço (rad), somado à direção do tiro. */
  swayYaw: number;
  swayPitch: number;
  /** Depois de cancelar, só volta a puxar quando soltar o botão. */
  waitRelease: boolean;
}

export interface CharacterState {
  id: string;
  /** Nome no placar. */
  name: string;
  isBot: boolean;
  /** Time (modo Gigantes): 0 = Azul (sul), 1 = Vermelho (norte). */
  team: Team;
  characterId: string;
  /** Skin (data/skins.ts): só visual, não muda nada no jogo. */
  skin?: string;
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
  bow: BowState;
  /** > 0 enquanto eliminado, contando até voltar (s). */
  respawnTimer: number;
  /** > 0 enquanto protegido depois de voltar (s). */
  protection: number;
  kills: number;
  deaths: number;
  /** Último que causou dano (leva o abate). */
  lastAttackerId: string | null;
  /** XP ganho nesta partida (mobs etc.), somado ao perfil no fim. */
  matchXp: number;
  mobKills: number;
  /** > 0 enquanto congelado (mais lento), s. */
  slowTimer: number;
  /** > 0 enquanto em Fúria (tiro rápido), s. */
  frenzy: number;
  /** > 0 enquanto com Velocidade (corre mais), s. */
  haste: number;
  /** Tempo desde o último dano (para a vida regenerar), s. */
  sinceHit: number;
  // --- Habilidade (data/abilities.ts) ---
  /** Recarga restante (s). */
  abilityCooldown: number;
  /** Efeito ativo restante (s). */
  abilityActive: number;
  /** Escudo arcano restante (pontos de dano). */
  shield: number;
  /** Arrancada/investida: tempo restante e velocidade horizontal forçada. */
  dashTime: number;
  dashVel: { x: number; z: number };
  /** A investida já mordeu alguém. */
  dashHit: boolean;
  /** Planando (gravidade reduzida), s. */
  glide: number;
}

export const isAlive = (c: CharacterState) => c.health > 0;

export function createCharacterState(id: string, name: string, isBot: boolean, def: CharacterDef, bowId: string, x: number, y: number, z: number, yaw: number, team: Team = 0): CharacterState {
  return {
    id,
    name,
    isBot,
    team,
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
    bow: { bowId, drawing: false, drawTime: 0, cooldown: 0, spread: 0, swayYaw: 0, swayPitch: 0, waitRelease: false },
    respawnTimer: 0,
    protection: 0,
    kills: 0,
    deaths: 0,
    lastAttackerId: null,
    matchXp: 0,
    mobKills: 0,
    slowTimer: 0,
    frenzy: 0,
    haste: 0,
    sinceHit: 99,
    abilityCooldown: 0,
    abilityActive: 0,
    shield: 0,
    dashTime: 0,
    dashVel: { x: 0, z: 0 },
    dashHit: false,
    glide: 0,
  };
}
