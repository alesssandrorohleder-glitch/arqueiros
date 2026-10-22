// Arcos. Todo o balanceamento de cada arco fica aqui.
import type { Rarity } from './rarities';

/** Efeitos especiais a partir do épico (implementados na etapa 5). */
export type BowEffect = 'explosive' | 'piercing' | 'frost' | 'ricochet' | 'multishot';

export interface BowDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Dano base do arco. Cada flecha causa dano × COMBAT.shotDamageFraction. */
  damage: number;
  /** Tempo entre flechas segurando o botão (s). Menor = atira mais rápido. */
  fireInterval: number;
  effect?: BowEffect;
}

export const BOWS: Record<string, BowDef> = {
  hunting: {
    id: 'hunting',
    name: 'Arco de caça',
    rarity: 'common',
    fireInterval: 0.38,
    damage: 40,
  },
  short: {
    id: 'short',
    name: 'Arco curto',
    rarity: 'common',
    fireInterval: 0.28,
    damage: 32,
  },
  yew: {
    id: 'yew',
    name: 'Arco de teixo',
    rarity: 'uncommon',
    fireInterval: 0.38,
    damage: 45,
  },
  recurve: {
    id: 'recurve',
    name: 'Arco recurvo',
    rarity: 'uncommon',
    fireInterval: 0.32,
    damage: 40,
  },
  elvenLong: {
    id: 'elvenLong',
    name: 'Arco longo élfico',
    rarity: 'rare',
    fireInterval: 0.42,
    damage: 52,
  },
  composite: {
    id: 'composite',
    name: 'Arco composto',
    rarity: 'rare',
    fireInterval: 0.33,
    damage: 48,
  },
  storm: {
    id: 'storm',
    name: 'Arco da tempestade',
    rarity: 'epic',
    fireInterval: 0.48,
    damage: 50,
    effect: 'multishot',
  },
  frost: {
    id: 'frost',
    name: 'Arco da geada',
    rarity: 'epic',
    fireInterval: 0.36,
    damage: 50,
    effect: 'frost',
  },
  piercer: {
    id: 'piercer',
    name: 'Arco perfurante',
    rarity: 'epic',
    fireInterval: 0.42,
    damage: 52,
    effect: 'piercing',
  },
  echo: {
    id: 'echo',
    name: 'Arco dos ecos',
    rarity: 'legendary',
    fireInterval: 0.36,
    damage: 55,
    effect: 'ricochet',
  },
  sun: {
    id: 'sun',
    name: 'Arco do Sol',
    rarity: 'legendary',
    fireInterval: 0.6,
    damage: 60,
    effect: 'explosive',
  },
};

/** Nome e descrição curta de cada efeito (HUD e menus). */
export const EFFECT_INFO: Record<BowEffect, { name: string; description: string }> = {
  multishot: { name: 'Múltiplas flechas', description: 'Dispara 3 flechas em leque.' },
  frost: { name: 'Gelo', description: 'Deixa o alvo mais lento por alguns segundos.' },
  piercing: { name: 'Perfurante', description: 'Atravessa até 2 alvos.' },
  ricochet: { name: 'Ricochete', description: 'Quica em superfícies até 2 vezes.' },
  explosive: { name: 'Explosiva', description: 'Explode no impacto, com dano em área.' },
};

export const DEFAULT_BOW_ID = 'hunting';

export function getBow(id: string): BowDef {
  return BOWS[id] ?? BOWS[DEFAULT_BOW_ID];
}
