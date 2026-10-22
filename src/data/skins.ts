// Coleção de skins: aparências alternativas de cada personagem (mesmos
// atributos, arco e habilidade; só muda o visual).
//
// Pensado para venda no futuro: cada skin tem preço (em moedas do jogo) e a
// conta guarda as skins que o jogador tem (`ownedSkins`) e a equipada em cada
// personagem (`equippedSkins`). POR ENQUANTO todas estão liberadas para testar
// (`SKINS_FREE_FOR_NOW`). Quando forem pagas, a posse NÃO pode ficar só no
// perfil (o próprio jogador consegue editar o perfil dele): precisa ser gravada
// pelo servidor depois do pagamento confirmado — ver `ownsSkin`.
import type { CharacterDef, CharacterModel, CharacterPalette, ThemeColors } from './characters';

export type SkinTier = 'rara' | 'épica' | 'lendária';

export interface SkinDef {
  id: string;
  characterId: string;
  name: string;
  /** Tema/história curta mostrada na coleção. */
  description: string;
  tier: SkinTier;
  /** Preço em moedas do jogo (para quando a loja existir). */
  price: number;
  /** Cores das partes esculpidas (cabeça, orelhas, olhos...). */
  palette?: Partial<CharacterPalette>;
  /** Mudanças no modelo: cores da roupa, pele/pelo, metal. */
  model?: Partial<CharacterModel>;
}

/** Todas liberadas enquanto a loja não existe. */
export const SKINS_FREE_FOR_NOW = true;

/** Cores das categorias (para os cartões da coleção). */
export const SKIN_TIERS: Record<SkinTier, { color: string }> = {
  rara: { color: '#4a9cff' },
  épica: { color: '#b46cff' },
  lendária: { color: '#ffb627' },
};

const theme = (cloth: number, leather: number, metal: number, other = 0.55): ThemeColors => ({ cloth, leather, metal, other });

export const SKINS: SkinDef[] = [
  {
    id: 'kael-paladin',
    characterId: 'hunter',
    name: 'Kael, o Redimido',
    description: 'O juramento venceu a vingança: manto branco, couro azul real e ouro polido, com olhos de luz.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0xe8e6f0, secondary: 0x2a4ab0, accent: 0xe0b040, eyes: 0x7ac8ff },
    model: { theme: theme(0xc8c6d2, 0x2a4ab8, 0xe8b838, 0.75) },
  },
  {
    id: 'sylwen-autumn',
    characterId: 'elf',
    name: 'Sylwen do Outono',
    description: 'Quando as folhas de Lethariel ficam vermelhas, a guardiã veste o outono: laranja, cobre e folhas secas.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0xc8501a, secondary: 0x6a3a1a, accent: 0xd08040, eyes: 0xffb040 },
    model: { theme: theme(0xd85a1e, 0x6a3a1a, 0xd8904a) },
  },
  {
    id: 'eldrin-fire',
    characterId: 'mage',
    name: 'Eldrin, Mago das Chamas',
    description: 'O lado proibido dos livros da Torre: túnica carmim, couro chamuscado e orbes de fogo.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0xb01818, secondary: 0x2a1010, accent: 0xffa020, eyes: 0xff7a1a },
    model: { theme: theme(0xb81a1a, 0x2a1414, 0xffb030, 0.5) },
  },
  {
    id: 'raszar-lava',
    characterId: 'lizard',
    name: 'Raszar Magmático',
    description: 'Mergulhou num vulcão e saiu de pedra quente: escamas de basalto e veias de lava.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x2a2020, secondary: 0xff6a1a, skin: 0x4a3a34, accent: 0xff7a20, eyes: 0xffc040 },
    model: { skinColor: 0x5a4640, theme: theme(0x2a2222, 0xff6a1a, 0x9a9a9a, 0.5) },
  },
  {
    id: 'cobalto-gold',
    characterId: 'robot',
    name: 'Cobalto Dourado',
    description: 'Edição de colecionador: blindagem banhada a ouro e olhos vermelhos de alerta.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0xc89a30, secondary: 0x3a2a10, skin: 0xd4a020, accent: 0x1a1a1a, eyes: 0xff3030 },
    model: { skinColor: 0xd8a830, theme: theme(0x3a2c18, 0x8a1a1a, 0xf0c040, 0.6) },
  },
  {
    id: 'fenna-arctic',
    characterId: 'fox',
    name: 'Fenna Ártica',
    description: 'Missão no polo: pelagem branca de raposa-do-ártico e traje de gelo azul.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0xdfe8f4, secondary: 0x4a8ad8, skin: 0xf2f4f8, accent: 0x4ab8ff, eyes: 0x4ad8ff },
    model: { skinColor: 0xf4f6fa },
  },
  {
    id: 'noctua-snow',
    characterId: 'owl',
    name: 'Noctua das Neves',
    description: 'A vigia do inverno: penas brancas como a neve e olhos dourados que nunca piscam.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0xeef0f4, secondary: 0x9aa4b4, skin: 0xf4f4f6, accent: 0x2a2a30, eyes: 0xffd040 },
    model: { theme: theme(0xe8ecf2, 0x8a94a4, 0xc8ccd8, 0.75) },
  },
  {
    id: 'aurion-cosmic',
    characterId: 'goldbird',
    name: 'Áurion Cósmico',
    description: 'Viu o centro da galáxia e voltou com as cores dela: violeta profundo e brilho ciano.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0x5a3ac8, secondary: 0x1a1040, skin: 0x6a4ad8, accent: 0x3affc8, eyes: 0xff6ae0 },
    model: { theme: theme(0x4a2ab8, 0x1a1040, 0x3affc8, 0.5) },
  },
  {
    id: 'ossurso-obsidian',
    characterId: 'skelbear',
    name: 'Ossurso Obsidiana',
    description: 'Ossos que viraram pedra negra e uma alma verde que não se apaga.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x1e1e24, secondary: 0x2a2a30, skin: 0x2a2a32, accent: 0x5aff8a, eyes: 0x5aff8a },
    model: { theme: theme(0x1e1e24, 0x2a3a2a, 0x5aff8a, 0.45) },
  },
  {
    id: 'squalo-abyss',
    characterId: 'shark',
    name: 'Squalo Abissal',
    description: 'Das fossas onde não chega luz: pele quase negra com manchas que brilham em ciano.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x10202a, secondary: 0x1a3a4a, skin: 0x1a2a38, accent: 0x3ae8ff, eyes: 0x3ae8ff },
    model: { theme: theme(0x14262e, 0x1a3a4a, 0x3ae8ff, 0.5) },
  },
];

export function getSkin(id: string | null | undefined): SkinDef | undefined {
  return id ? SKINS.find((s) => s.id === id) : undefined;
}

export function skinsOf(characterId: string): SkinDef[] {
  return SKINS.filter((s) => s.characterId === characterId);
}

/**
 * O jogador pode usar esta skin? Hoje: todas liberadas. Com a loja, troque por
 * uma verificação da posse confirmada pelo servidor (e não só `ownedSkins`).
 */
export function ownsSkin(skin: SkinDef, ownedSkins: string[]): boolean {
  return SKINS_FREE_FOR_NOW || ownedSkins.includes(skin.id);
}

/** Personagem com a skin aplicada (mesmo id e atributos; muda só a aparência). */
export function applySkin(def: CharacterDef, skinId: string | null | undefined): CharacterDef {
  const skin = getSkin(skinId);
  if (!skin || skin.characterId !== def.id) return def;
  return {
    ...def,
    palette: { ...def.palette, ...skin.palette },
    model: def.model ? { ...def.model, ...skin.model } : def.model,
  };
}
