// Personagens (skins). Para adicionar um novo, basta incluir uma entrada aqui.
// As diferenças de atributos são pequenas de propósito: a hitbox fica equilibrada
// e o que decide a luta é a mira.

export type BodyStyle = 'human' | 'elf' | 'mage' | 'lizard' | 'robot' | 'fox' | 'owl' | 'goldbird' | 'skelbear' | 'shark';
/** 'frenzy' é usado durante a Fúria (rastro laranja). */
export type ArrowTrail = 'normal' | 'magic' | 'frenzy';

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
  /** Modelo 3D animado (.glb em public/models). Sem ele, usa o modelo geométrico. */
  model?: CharacterModel;
}

/**
 * Modelo animado. Todos usam o mesmo esqueleto (KayKit Adventurers, CC0) e
 * compartilham as animações de public/models/anims.glb.
 */
export interface CharacterModel {
  /** Arquivo em public/models (sem extensão). */
  file: string;
  /** Troca a cor da pele da textura (lagarto verde, raposa laranja, robô metálico). */
  skinColor?: number;
  /** Metalizado (robô). */
  metal?: boolean;
  /** Esconde a cabeça do modelo e usa a cabeça geométrica do estilo (animais). */
  customHead?: boolean;
  /** Acrescenta as partes geométricas do estilo (orelhas, cauda, asas...) por cima do modelo. */
  styleExtras?: boolean;
  /** Partes do modelo a esconder (ex.: 'Knight_Helmet'). */
  hide?: string[];
}

export const CHARACTERS: Record<string, CharacterDef> = {
  hunter: {
    id: 'hunter',
    name: 'Kael',
    description: 'Humano caçador, o arqueiro base: manto de pele e aljava de couro. Equilibrado em tudo.',
    style: 'human',
    palette: { primary: 0x4f6b3a, secondary: 0x5a4632, skin: 0xe0b48f, accent: 0x7a4f2a, eyes: 0x222222 },
    maxHealth: 100,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.0,
    radius: 0.4,
    height: 1.8,
    arrowTrail: 'normal',
    model: { file: 'rogue_hooded', styleExtras: true },
  },
  elf: {
    id: 'elf',
    name: 'Sylwen',
    description: 'Elfa arqueira da floresta, de tiara e folhas douradas. Ágil: mais rápida, porém com menos vida.',
    style: 'elf',
    palette: { primary: 0x2f8f6a, secondary: 0xd8d2b8, skin: 0xf2d3bd, accent: 0xc9a227, eyes: 0x2b6b3f },
    maxHealth: 90,
    speedMultiplier: 1.08,
    jumpMultiplier: 1.05,
    radius: 0.38,
    height: 1.78,
    arrowTrail: 'normal',
    model: { file: 'rogue', styleExtras: true },
  },
  mage: {
    id: 'mage',
    name: 'Eldrin',
    description: 'Arqueiro-mago de barba longa, com orbes mágicos girando em volta. Flechas com rastro mágico.',
    style: 'mage',
    palette: { primary: 0x3b3f9e, secondary: 0x2a2346, skin: 0xd9b08c, accent: 0xb48cff, eyes: 0x8fd3ff },
    maxHealth: 95,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.0,
    radius: 0.4,
    height: 1.82,
    arrowTrail: 'magic',
    model: { file: 'mage', styleExtras: true },
  },
  lizard: {
    id: 'lizard',
    name: 'Raszar',
    description: 'Lagarto arqueiro de escamas grossas: mais vida, um pouco mais lento.',
    style: 'lizard',
    palette: { primary: 0x6b4a2b, secondary: 0x3f3a2a, skin: 0x5f9e4a, accent: 0xb5c94a, eyes: 0xffd23f },
    maxHealth: 110,
    speedMultiplier: 0.96,
    jumpMultiplier: 0.98,
    radius: 0.42,
    height: 1.85,
    arrowTrail: 'normal',
    model: { file: 'barbarian', customHead: true, skinColor: 0x5f9e4a, hide: ['Barbarian_Hat'] },
  },
  robot: {
    id: 'robot',
    name: 'Cobalto',
    description: 'Robô arqueiro de metal, com olhos de luz e núcleo de energia. Resistente e pesado.',
    style: 'robot',
    palette: { primary: 0x8a949e, secondary: 0x4a525a, skin: 0xb8c2cc, accent: 0xff8a2a, eyes: 0x3ff0ff },
    maxHealth: 120,
    speedMultiplier: 0.92,
    jumpMultiplier: 0.95,
    radius: 0.43,
    height: 1.9,
    arrowTrail: 'normal',
    model: { file: 'knight', skinColor: 0xb8c2cc, metal: true, customHead: true, hide: ['Knight_Helmet'] },
  },
  fox: {
    id: 'fox',
    name: 'Fenna',
    description: 'Raposa arqueira esperta e veloz, de cauda bem peluda.',
    style: 'fox',
    palette: { primary: 0x355e8c, secondary: 0x2c2c2c, skin: 0xe07a2e, accent: 0xf5f0e6, eyes: 0x1a1a1a },
    maxHealth: 95,
    speedMultiplier: 1.06,
    jumpMultiplier: 1.02,
    radius: 0.39,
    height: 1.72,
    arrowTrail: 'normal',
    model: { file: 'rogue', customHead: true, skinColor: 0xe07a2e },
  },
  owl: {
    id: 'owl',
    name: 'Noctua',
    description: 'Coruja arqueira de olhos enormes e asas de penas: pula mais alto.',
    style: 'owl',
    palette: { primary: 0x7a5a3a, secondary: 0x4a3a2a, skin: 0xb08a5e, accent: 0xefe6d2, eyes: 0xffb020 },
    maxHealth: 100,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.12,
    radius: 0.4,
    height: 1.75,
    arrowTrail: 'normal',
    model: { file: 'knight', customHead: true, skinColor: 0xb08a5e, hide: ['Knight_Helmet'] },
  },
  goldbird: {
    id: 'goldbird',
    name: 'Áurion',
    description: 'Pássaro-alien dourado vindo das estrelas, de olhos que brilham. Leve: pula muito alto.',
    style: 'goldbird',
    palette: { primary: 0xc9a227, secondary: 0x5a3a8a, skin: 0xffd24a, accent: 0x7fffd4, eyes: 0x3affc8 },
    maxHealth: 90,
    speedMultiplier: 1.05,
    jumpMultiplier: 1.18,
    radius: 0.38,
    height: 1.76,
    arrowTrail: 'magic',
    model: { file: 'mage', customHead: true, skinColor: 0xffc83a, hide: ['Mage_Hat'] },
  },
  skelbear: {
    id: 'skelbear',
    name: 'Ossurso',
    description: 'Urso esqueleto que voltou dos mortos: só ossos e fúria. O mais resistente, mas lento.',
    style: 'skelbear',
    palette: { primary: 0x3a3632, secondary: 0x24211e, skin: 0xe8e0c8, accent: 0x8a2a2a, eyes: 0xff3a2a },
    maxHealth: 125,
    speedMultiplier: 0.9,
    jumpMultiplier: 0.92,
    radius: 0.44,
    height: 1.95,
    arrowTrail: 'normal',
    model: { file: 'barbarian', customHead: true, skinColor: 0xe8e0c8, hide: ['Barbarian_Hat'] },
  },
  shark: {
    id: 'shark',
    name: 'Squalo',
    description: 'Homem-tubarão, predador dos mares que aprendeu a andar em terra. Rápido e com mordida feroz.',
    style: 'shark',
    palette: { primary: 0x2f5f7a, secondary: 0x1f3a4a, skin: 0x7393a8, accent: 0xf2f0ea, eyes: 0x101418 },
    maxHealth: 105,
    speedMultiplier: 1.04,
    jumpMultiplier: 1.0,
    radius: 0.41,
    height: 1.84,
    arrowTrail: 'normal',
    model: { file: 'knight', customHead: true, skinColor: 0x7393a8, hide: ['Knight_Helmet'] },
  },
};

export const DEFAULT_CHARACTER_ID = 'hunter';

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS[id] ?? CHARACTERS[DEFAULT_CHARACTER_ID];
}
