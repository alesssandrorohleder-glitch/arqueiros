// Eventos gerados pela simulação a cada tick. A renderização e o HUD reagem
// a eles (números de dano, marcador de acerto). No multiplayer, o servidor
// envia estes mesmos eventos aos clientes.
import type { ArrowTrail } from '../data/characters';
import type { BuffKind } from '../data/combat';
import type { Rarity } from '../data/rarities';
import type { Vec3 } from './math';

export type GameEvent =
  | { type: 'shot'; ownerId: string; arrowId: number; charge: number }
  | { type: 'hit'; ownerId: string; targetId: string; damage: number; headshot: boolean; position: Vec3 }
  | { type: 'buff'; ownerId: string; buff: BuffKind }
  | { type: 'kill'; ownerId: string; targetId: string; victimKind: 'target' | 'character' | 'mob'; headshot: boolean }
  | { type: 'arrowStuck'; arrowId: number; position: Vec3; dir: Vec3; targetId: string | null; rarity: Rarity; trail: ArrowTrail }
  | { type: 'respawn'; targetId: string }
  | { type: 'matchEnd' }
  | { type: 'xp'; ownerId: string; amount: number; position: Vec3 }
  | { type: 'mobAttack'; mobId: string }
  | { type: 'lootDrop'; lootId: number; bowId: string; position: Vec3 }
  | { type: 'explosion'; position: Vec3; radius: number }
  | { type: 'frost'; targetId: string; position: Vec3 }
  | { type: 'ricochet'; position: Vec3 }
  | { type: 'pickup'; ownerId: string; bowId: string; equipped: boolean };
