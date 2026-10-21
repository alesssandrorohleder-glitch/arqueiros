// Eventos gerados pela simulação a cada tick. A renderização e o HUD reagem
// a eles (números de dano, marcador de acerto). No multiplayer, o servidor
// envia estes mesmos eventos aos clientes.
import type { Vec3 } from './math';

export type GameEvent =
  | { type: 'shot'; ownerId: string; arrowId: number; charge: number }
  | { type: 'hit'; ownerId: string; targetId: string; damage: number; headshot: boolean; position: Vec3 }
  | { type: 'kill'; ownerId: string; targetId: string }
  | { type: 'arrowStuck'; arrowId: number; position: Vec3 }
  | { type: 'respawn'; targetId: string };
