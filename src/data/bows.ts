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
  short: {
    id: 'short',
    name: 'Arco curto',
    rarity: 'common',
    damage: 32,
    minDamageFraction: 0.3,
    drawTime: 0.7,
    minArrowSpeed: 24,
    maxArrowSpeed: 64,
    stability: 0.55,
    holdTime: 3.0,
    cooldown: 0.28,
  },
  yew: {
    id: 'yew',
    name: 'Arco de teixo',
    rarity: 'uncommon',
    damage: 45,
    minDamageFraction: 0.25,
    drawTime: 1.0,
    minArrowSpeed: 26,
    maxArrowSpeed: 78,
    stability: 0.55,
    holdTime: 2.6,
    cooldown: 0.33,
  },
  recurve: {
    id: 'recurve',
    name: 'Arco recurvo',
    rarity: 'uncommon',
    damage: 40,
    minDamageFraction: 0.3,
    drawTime: 0.8,
    minArrowSpeed: 26,
    maxArrowSpeed: 76,
    stability: 0.6,
    holdTime: 2.8,
    cooldown: 0.3,
  },
  elvenLong: {
    id: 'elvenLong',
    name: 'Arco longo élfico',
    rarity: 'rare',
    damage: 52,
    minDamageFraction: 0.25,
    drawTime: 1.1,
    minArrowSpeed: 28,
    maxArrowSpeed: 88,
    stability: 0.72,
    holdTime: 3.0,
    cooldown: 0.33,
  },
  composite: {
    id: 'composite',
    name: 'Arco composto',
    rarity: 'rare',
    damage: 48,
    minDamageFraction: 0.35,
    drawTime: 0.85,
    minArrowSpeed: 28,
    maxArrowSpeed: 82,
    stability: 0.65,
    holdTime: 2.8,
    cooldown: 0.3,
  },
  storm: {
    id: 'storm',
    name: 'Arco da tempestade',
    rarity: 'epic',
    damage: 50,
    minDamageFraction: 0.3,
    drawTime: 1.0,
    minArrowSpeed: 30,
    maxArrowSpeed: 86,
    stability: 0.7,
    holdTime: 3.0,
    cooldown: 0.35,
    effect: 'multishot',
  },
  frost: {
    id: 'frost',
    name: 'Arco da geada',
    rarity: 'epic',
    damage: 50,
    minDamageFraction: 0.3,
    drawTime: 0.95,
    minArrowSpeed: 30,
    maxArrowSpeed: 84,
    stability: 0.7,
    holdTime: 3.0,
    cooldown: 0.33,
    effect: 'frost',
  },
  sun: {
    id: 'sun',
    name: 'Arco do Sol',
    rarity: 'legendary',
    damage: 60,
    minDamageFraction: 0.3,
    drawTime: 1.0,
    minArrowSpeed: 32,
    maxArrowSpeed: 92,
    stability: 0.8,
    holdTime: 3.5,
    cooldown: 0.35,
    effect: 'explosive',
  },
};

export const DEFAULT_BOW_ID = 'hunting';

export function getBow(id: string): BowDef {
  return BOWS[id] ?? BOWS[DEFAULT_BOW_ID];
}
