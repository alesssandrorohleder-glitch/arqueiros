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
  /** Acabamento entalhado: veios no material, anéis e ponteiras de ouro, empunhadura trançada. */
  carved?: boolean;
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

/**
 * Arco próprio de cada personagem (não há mais arcos no chão nem troca de
 * arco): cada um tem visual nas cores do personagem e um estilo de tiro.
 * Poder parecido entre eles; quem tem efeito forte atira mais devagar.
 */
export const SIGNATURE_BOWS: Record<string, BowDef> = {
  kaelBow: {
    id: 'kaelBow',
    name: 'Arco Rubro',
    rarity: 'epic',
    fireInterval: 0.42,
    damage: 46,
    effect: 'piercing',
    look: { shape: 'blade', size: 0.95, main: 0x16141a, accent: 0xc9a04a, glow: 0xff2030 },
  },
  sylwenBow: {
    id: 'sylwenBow',
    name: 'Folha de Lethariel',
    rarity: 'rare',
    fireInterval: 0.34,
    damage: 46,
    look: { shape: 'elven', size: 0.98, main: 0xf2ecd8, accent: 0xd4af37, glow: 0x2bd97a },
  },
  eldrinBow: {
    id: 'eldrinBow',
    name: 'Arco Arcano',
    rarity: 'epic',
    fireInterval: 0.4,
    damage: 46,
    effect: 'ricochet',
    look: { shape: 'echo', size: 1.0, main: 0x6a3fc4, accent: 0xe8dcff, glow: 0xb48cff },
  },
  raszarBow: {
    id: 'raszarBow',
    name: 'Arco de Osso de Crocodilo',
    rarity: 'rare',
    fireInterval: 0.44,
    damage: 54,
    look: { shape: 'long', size: 0.92, main: 0xd8d0b0, accent: 0x3f6a2a, glow: 0x7aff5a, carved: true },
  },
  cobaltoBow: {
    id: 'cobaltoBow',
    name: 'Arco Canhão',
    rarity: 'epic',
    fireInterval: 0.62,
    damage: 54,
    effect: 'explosive',
    look: { shape: 'composite', size: 0.9, main: 0x5a6878, accent: 0xc8d4e0, glow: 0x3ff0ff },
  },
  fennaBow: {
    id: 'fennaBow',
    name: 'Arco Orbital',
    rarity: 'rare',
    fireInterval: 0.28,
    damage: 34,
    look: { shape: 'short', size: 0.74, main: 0xeef0f4, accent: 0xff8a2a, glow: 0xff8a2a },
  },
  noctuaBow: {
    id: 'noctuaBow',
    name: 'Arco da Noite',
    rarity: 'rare',
    fireInterval: 0.48,
    damage: 58,
    look: { shape: 'long', size: 1.0, main: 0x1c2440, accent: 0xc8ccd8, glow: 0xffc020 },
  },
  aurionBow: {
    id: 'aurionBow',
    name: 'Arco Estelar',
    rarity: 'legendary',
    fireInterval: 0.5,
    damage: 46,
    effect: 'multishot',
    look: { shape: 'sun', size: 1.0, main: 0xffc94a, accent: 0xfff1b0, glow: 0x3affc8 },
  },
  ossursoBow: {
    id: 'ossursoBow',
    name: 'Arco da Montanha Gelada',
    rarity: 'epic',
    fireInterval: 0.4,
    damage: 44,
    effect: 'frost',
    look: { shape: 'crystal', size: 0.95, main: 0xe8e0c8, accent: 0xbfefff, glow: 0x6ad8ff },
  },
  faiscaBow: {
    id: 'faiscaBow',
    name: 'Arco de Bambu Biônico',
    rarity: 'rare',
    fireInterval: 0.36,
    damage: 44,
    look: { shape: 'storm', size: 0.88, main: 0x8a9a42, accent: 0xc8873a, glow: 0x3ad8ff },
  },
  ringoBow: {
    id: 'ringoBow',
    name: 'Arco do Velho Oeste',
    rarity: 'rare',
    fireInterval: 0.38,
    damage: 46,
    look: { shape: 'recurve', size: 0.9, main: 0x6a3a1e, accent: 0xd8a83a, glow: 0xffb03a },
  },
  squaloBow: {
    id: 'squaloBow',
    name: 'Arco do Recife',
    rarity: 'rare',
    fireInterval: 0.34,
    damage: 44,
    look: { shape: 'recurve', size: 0.84, main: 0x2a7f8a, accent: 0xff7a5a, glow: 0x4aa8ff },
  },
};
Object.assign(BOWS, SIGNATURE_BOWS);

/** Arco de cada personagem (id do personagem → id do arco). */
export const CHARACTER_BOW: Record<string, string> = {
  hunter: 'kaelBow',
  elf: 'sylwenBow',
  mage: 'eldrinBow',
  lizard: 'raszarBow',
  robot: 'cobaltoBow',
  fox: 'fennaBow',
  owl: 'noctuaBow',
  goldbird: 'aurionBow',
  skelbear: 'ossursoBow',
  shark: 'squaloBow',
  redpanda: 'faiscaBow',
  lemur: 'ringoBow',
};

/** Arco do personagem (os arcos antigos ficam só para testes: ?bow=). */
export function characterBowId(characterId: string): string {
  return CHARACTER_BOW[characterId] ?? DEFAULT_BOW_ID;
}

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
