// Eventos gerados pela simulação a cada tick. A renderização e o HUD reagem
// a eles (números de dano, marcador de acerto). No multiplayer, o servidor
// envia estes mesmos eventos aos clientes.
import type { ArrowTrail } from '../data/characters';
import type { BuffKind } from '../data/combat';
import type { Ability2Kind, AbilityKind } from '../data/abilities';
import type { StructureKind, Team } from '../data/objectives';
import type { Rarity } from '../data/rarities';
import type { Vec3 } from './math';

export type GameEvent =
  | { type: 'shot'; ownerId: string; arrowId: number; charge: number }
  | { type: 'hit'; ownerId: string; targetId: string; damage: number; headshot: boolean; position: Vec3 }
  // fromId: roubado de quem foi eliminado (senão, veio de um mob); seconds: duração.
  | { type: 'buff'; ownerId: string; buff: BuffKind; fromId?: string; seconds?: number }
  | { type: 'ability'; ownerId: string; kind: AbilityKind; from: Vec3; to: Vec3 }
  /** Segunda habilidade; points: saltos da Faísca em Cadeia. */
  | { type: 'ability2'; ownerId: string; kind: Ability2Kind; from: Vec3; to: Vec3; points?: Vec3[]; hit?: boolean }
  | { type: 'kill'; ownerId: string; targetId: string; victimKind: 'target' | 'character' | 'mob'; headshot: boolean; assists?: string[] }
  /** Subiu de nível na partida (data/levels.ts). */
  | { type: 'levelUp'; ownerId: string; level: number }
  | { type: 'arrowStuck'; arrowId: number; position: Vec3; dir: Vec3; targetId: string | null; rarity: Rarity; trail: ArrowTrail }
  | { type: 'respawn'; targetId: string }
  | { type: 'matchEnd' }
  | { type: 'xp'; ownerId: string; amount: number; position: Vec3 }
  | { type: 'mobAttack'; mobId: string }
  | { type: 'lootDrop'; lootId: number; bowId: string; position: Vec3 }
  | { type: 'explosion'; position: Vec3; radius: number }
  | { type: 'frost'; targetId: string; position: Vec3 }
  | { type: 'ricochet'; position: Vec3 }
  | { type: 'pickup'; ownerId: string; bowId: string; equipped: boolean }
  // --- Modo Gigantes ---
  | { type: 'towerShot'; ownerId: string; team: Team; from: Vec3; to: Vec3 }
  | { type: 'giantWindup'; ownerId: string }
  | { type: 'giantSlam'; ownerId: string; position: Vec3; radius: number }
  /** Acertou um gigante que ainda está protegido pelas torres. */
  | { type: 'shielded'; ownerId: string; targetId: string; position: Vec3 }
  /** Acertou uma torre/gigante de fora do círculo de ataque (sem dano). */
  | { type: 'outOfRange'; ownerId: string; targetId: string; position: Vec3 }
  | { type: 'structureDestroyed'; ownerId: string; targetId: string; kind: StructureKind; team: Team }
  | { type: 'wave' }
  // --- Último de pé ---
  /** A zona começou a fechar (fase `phase`). */
  | { type: 'zoneShrink'; phase: number }
  | { type: 'surrenderVote'; team: Team; byId: string }
  | { type: 'surrenderResult'; team: Team; passed: boolean; yes: number; no: number };
