// Modos de jogo (escolhidos no menu antes da partida).
import type { MapDef } from './maps/arena';
import { ARENA } from './maps/arena';
import { GIANTS_VALLEY } from './maps/giants';

export type ModeId = 'ffa' | 'giants';

export interface ModeDef {
  id: ModeId;
  name: string;
  description: string;
  map: MapDef;
  /** Quantos bots entram (da lista BOT_ROSTER, na ordem). */
  bots: number;
  /** Times e objetivos (torres, gigantes, tropas). */
  teams: boolean;
}

export const MODES: Record<ModeId, ModeDef> = {
  ffa: {
    id: 'ffa',
    name: 'Todos contra todos',
    description: 'Cada um por si nas Ruínas da Clareira. 5 minutos: quem tiver mais abates vence.',
    map: ARENA,
    bots: 5,
    teams: false,
  },
  giants: {
    id: 'giants',
    name: 'Gigantes',
    description: '5 contra 5 no Vale dos Gigantes. Derrube as 2 torres e depois o gigante inimigo. Tropas de mini golems ajudam a avançar. Sem limite de tempo.',
    map: GIANTS_VALLEY,
    bots: 9,
    teams: true,
  },
};

export const DEFAULT_MODE: ModeId = 'ffa';

export function getMode(id: string | null | undefined): ModeDef {
  return MODES[id as ModeId] ?? MODES[DEFAULT_MODE];
}
