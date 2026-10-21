// Personagens (skins). Para adicionar um novo, basta incluir uma entrada aqui.
// As diferenças de atributos são pequenas de propósito: a hitbox fica equilibrada
// e o que decide a luta é a mira.

export type BodyStyle = 'human' | 'elf' | 'mage' | 'lizard' | 'robot' | 'fox' | 'owl';
export type ArrowTrail = 'normal' | 'magic';

export interface CharacterPalette {
  /** Roupa principal. */
  primary: number;
  /** Roupa secundária (calça, detalhes). */
  secondary: number;
  /** Pele / escamas / metal / pelo. */
  skin: number;
  /** Detalhes (cinto, capuz, aljava). */
  accent: number;
  /** Olhos (brilham no robô). */
  eyes: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  style: BodyStyle;
  palette: CharacterPalette;
  // --- Balanceamento ---
  /** Vida máxima. */
  maxHealth: number;
  /** Multiplicador da velocidade base (data/movement.ts). */
  speedMultiplier: number;
  /** Multiplicador da força do pulo. */
  jumpMultiplier: number;
  /** Raio da hitbox/colisão (m). Manter entre 0.36 e 0.44. */
  radius: number;
  /** Altura da hitbox (m). */
  height: number;
  arrowTrail: ArrowTrail;
  /** Futuro: caminho de um modelo .glb para substituir o modelo geométrico. */
  modelUrl?: string;
}

export const CHARACTERS: Record<string, CharacterDef> = {
  hunter: {
    id: 'hunter',
    name: 'Humano caçador',
    description: 'O personagem base. Equilibrado em tudo.',
    style: 'human',
    palette: { primary: 0x4f6b3a, secondary: 0x5a4632, skin: 0xe0b48f, accent: 0x7a4f2a, eyes: 0x222222 },
    maxHealth: 100,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.0,
    radius: 0.4,
    height: 1.8,
    arrowTrail: 'normal',
  },
  elf: {
    id: 'elf',
    name: 'Elfa arqueira',
    description: 'Delicada e ágil: mais rápida, porém com menos vida.',
    style: 'elf',
    palette: { primary: 0x2f8f6a, secondary: 0xd8d2b8, skin: 0xf2d3bd, accent: 0xc9a227, eyes: 0x2b6b3f },
    maxHealth: 90,
    speedMultiplier: 1.08,
    jumpMultiplier: 1.05,
    radius: 0.38,
    height: 1.78,
    arrowTrail: 'normal',
  },
  mage: {
    id: 'mage',
    name: 'Arqueiro-mago',
    description: 'Flechas com rastro mágico.',
    style: 'mage',
    palette: { primary: 0x3b3f9e, secondary: 0x2a2346, skin: 0xd9b08c, accent: 0xb48cff, eyes: 0x8fd3ff },
    maxHealth: 95,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.0,
    radius: 0.4,
    height: 1.82,
    arrowTrail: 'magic',
  },
  lizard: {
    id: 'lizard',
    name: 'Lagarto arqueiro',
    description: 'Humanoide réptil de escamas grossas: mais vida, um pouco mais lento.',
    style: 'lizard',
    palette: { primary: 0x6b4a2b, secondary: 0x3f3a2a, skin: 0x5f9e4a, accent: 0xb5c94a, eyes: 0xffd23f },
    maxHealth: 110,
    speedMultiplier: 0.96,
    jumpMultiplier: 0.98,
    radius: 0.42,
    height: 1.85,
    arrowTrail: 'normal',
  },
  robot: {
    id: 'robot',
    name: 'Robô arqueiro',
    description: 'Metálico, olhos luminosos. Resistente e pesado.',
    style: 'robot',
    palette: { primary: 0x8a949e, secondary: 0x4a525a, skin: 0xb8c2cc, accent: 0xff8a2a, eyes: 0x3ff0ff },
    maxHealth: 120,
    speedMultiplier: 0.92,
    jumpMultiplier: 0.95,
    radius: 0.43,
    height: 1.9,
    arrowTrail: 'normal',
  },
  fox: {
    id: 'fox',
    name: 'Raposa arqueira',
    description: 'Animal humanoide esperto e veloz.',
    style: 'fox',
    palette: { primary: 0x355e8c, secondary: 0x2c2c2c, skin: 0xe07a2e, accent: 0xf5f0e6, eyes: 0x1a1a1a },
    maxHealth: 95,
    speedMultiplier: 1.06,
    jumpMultiplier: 1.02,
    radius: 0.39,
    height: 1.72,
    arrowTrail: 'normal',
  },
  owl: {
    id: 'owl',
    name: 'Coruja arqueira',
    description: 'Animal humanoide com asas: pula mais alto.',
    style: 'owl',
    palette: { primary: 0x7a5a3a, secondary: 0x4a3a2a, skin: 0xb08a5e, accent: 0xefe6d2, eyes: 0xffb020 },
    maxHealth: 100,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.12,
    radius: 0.4,
    height: 1.75,
    arrowTrail: 'normal',
  },
};

export const DEFAULT_CHARACTER_ID = 'hunter';

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS[id] ?? CHARACTERS[DEFAULT_CHARACTER_ID];
}
