// Arcos. Todo o balanceamento de cada arco fica aqui.
import type { Rarity } from './rarities';

/** Efeitos especiais a partir do épico (implementados na etapa 5). */
export type BowEffect = 'explosive' | 'piercing' | 'frost' | 'ricochet' | 'multishot';

/** Formato/visual do arco (ver entities/bowModels.ts). */
export type BowShape = 'simple' | 'short' | 'long' | 'recurve' | 'elven' | 'composite' | 'storm' | 'crystal' | 'blade' | 'echo' | 'sun';

/** Aparência: quanto mais raro, maior e mais enfeitado. */
export interface BowLook {
  shape: BowShape;
  /** Meia altura do arco (m, num corpo de 1,8 m): da empunhadura até a ponta. */
  size: number;
  /** Cor principal (madeira/metal/cristal) e cor dos detalhes. */
  main: number;
  accent: number;
  /** Cor do brilho (épicos e lendários). */
  glow?: number;
}

export interface BowDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Dano base do arco. Cada flecha causa dano × COMBAT.shotDamageFraction. */
  damage: number;
  /** Tempo entre flechas segurando o botão (s). Menor = atira mais rápido. */
  fireInterval: number;
  effect?: BowEffect;
  look: BowLook;
}

export const BOWS: Record<string, BowDef> = {
  hunting: {
    id: 'hunting',
    name: 'Arco de caça',
    rarity: 'common',
    fireInterval: 0.38,
    damage: 40,
    look: { shape: 'simple', size: 0.72, main: 0x8a5a2b, accent: 0x3a2a1e },
  },
  short: {
    id: 'short',
    name: 'Arco curto',
    rarity: 'common',
    fireInterval: 0.28,
    damage: 32,
    look: { shape: 'short', size: 0.66, main: 0x5e3b1e, accent: 0xc9b48a },
  },
  yew: {
    id: 'yew',
    name: 'Arco de teixo',
    rarity: 'uncommon',
    fireInterval: 0.38,
    damage: 45,
    look: { shape: 'long', size: 0.86, main: 0x8b3f1f, accent: 0x2f7a3e },
  },
  recurve: {
    id: 'recurve',
    name: 'Arco recurvo',
    rarity: 'uncommon',
    fireInterval: 0.32,
    damage: 40,
    look: { shape: 'recurve', size: 0.8, main: 0x3b2618, accent: 0xc8a040 },
  },
  elvenLong: {
    id: 'elvenLong',
    name: 'Arco longo élfico',
    rarity: 'rare',
    fireInterval: 0.42,
    damage: 52,
    look: { shape: 'elven', size: 0.98, main: 0xeae3d0, accent: 0xd4af37, glow: 0x2bd97a },
  },
  composite: {
    id: 'composite',
    name: 'Arco composto',
    rarity: 'rare',
    fireInterval: 0.33,
    damage: 48,
    look: { shape: 'composite', size: 0.86, main: 0x6a4428, accent: 0xb9c2cc, glow: 0x3a7aff },
  },
  storm: {
    id: 'storm',
    name: 'Arco da tempestade',
    rarity: 'epic',
    fireInterval: 0.48,
    damage: 50,
    effect: 'multishot',
    look: { shape: 'storm', size: 0.95, main: 0x2c2f3a, accent: 0x9aa4b4, glow: 0x8a6bff },
  },
  frost: {
    id: 'frost',
    name: 'Arco da geada',
    rarity: 'epic',
    fireInterval: 0.36,
    damage: 50,
    effect: 'frost',
    look: { shape: 'crystal', size: 0.95, main: 0xa8ecff, accent: 0xe8fbff, glow: 0x3ab0ff },
  },
  piercer: {
    id: 'piercer',
    name: 'Arco perfurante',
    rarity: 'epic',
    fireInterval: 0.42,
    damage: 52,
    effect: 'piercing',
    look: { shape: 'blade', size: 0.95, main: 0x1b1b20, accent: 0x6a6f78, glow: 0xff2a2a },
  },
  echo: {
    id: 'echo',
    name: 'Arco dos ecos',
    rarity: 'legendary',
    fireInterval: 0.36,
    damage: 55,
    effect: 'ricochet',
    look: { shape: 'echo', size: 1.08, main: 0xb18cff, accent: 0xf0e6ff, glow: 0xc45bff },
  },
  sun: {
    id: 'sun',
    name: 'Arco do Sol',
    rarity: 'legendary',
    fireInterval: 0.6,
    damage: 60,
    effect: 'explosive',
    look: { shape: 'sun', size: 1.12, main: 0xffc94a, accent: 0xfff1b0, glow: 0xff8a1a },
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
