// Arcos. Todo o balanceamento de cada arco fica aqui.
import type { Rarity } from './rarities';

/** Efeitos especiais a partir do épico (implementados na etapa 5). */
export type BowEffect = 'explosive' | 'piercing' | 'frost' | 'ricochet' | 'multishot';

export interface BowDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Dano no corpo com a corda totalmente puxada. */
  damage: number;
  /** Fração do dano com o mínimo de carga (0 a 1). */
  minDamageFraction: number;
  /** Tempo para puxar a corda até o máximo (s). */
  drawTime: number;
  /** Velocidade da flecha com carga mínima e máxima (m/s). */
  minArrowSpeed: number;
  maxArrowSpeed: number;
  /** Estabilidade da mira, 0 a 1: menos dispersão e menos tremor. */
  stability: number;
  /** Quanto tempo dá para segurar puxado ao máximo antes do braço cansar (s). */
  holdTime: number;
  /** Tempo para colocar outra flecha depois de atirar (s). */
  cooldown: number;
  effect?: BowEffect;
}

export const BOWS: Record<string, BowDef> = {
  hunting: {
    id: 'hunting',
    name: 'Arco de caça',
    rarity: 'common',
    damage: 40,
    minDamageFraction: 0.25,
    drawTime: 1.0,
    minArrowSpeed: 24,
    maxArrowSpeed: 72,
    stability: 0.5,
    holdTime: 2.5,
    cooldown: 0.35,
  },
};

export const DEFAULT_BOW_ID = 'hunting';

export function getBow(id: string): BowDef {
  return BOWS[id] ?? BOWS[DEFAULT_BOW_ID];
}
