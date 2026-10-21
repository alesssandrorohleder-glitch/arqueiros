// Raridades: cor usada em tudo (ícone, brilho, rastro da flecha) e chance de drop.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface RarityDef {
  id: Rarity;
  name: string;
  /** Cor principal (hex). */
  color: number;
  /** Chance de drop (soma 1). Usado na etapa 4/5. */
  dropChance: number;
}

export const RARITIES: Record<Rarity, RarityDef> = {
  common: { id: 'common', name: 'Comum', color: 0xb8b8b8, dropChance: 0.55 },
  uncommon: { id: 'uncommon', name: 'Incomum', color: 0x4fd15a, dropChance: 0.25 },
  rare: { id: 'rare', name: 'Raro', color: 0x3f8cff, dropChance: 0.12 },
  epic: { id: 'epic', name: 'Épico', color: 0xb05cff, dropChance: 0.06 },
  legendary: { id: 'legendary', name: 'Lendário', color: 0xffb627, dropChance: 0.02 },
};

export const cssColor = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
