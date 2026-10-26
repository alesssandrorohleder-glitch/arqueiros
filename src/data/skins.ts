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
    tier: 'épica',
    price: 900,
    palette: { primary: 0xe8e6f0, secondary: 0x2a4ab0, accent: 0xe0b040, eyes: 0x7ac8ff },
    model: { theme: theme(0xc8c6d2, 0x2a4ab8, 0xe8b838, 0.75), variant: 'paladin' },
  },
  {
    id: 'kael-golden',
    characterId: 'hunter',
    name: 'Kael, o Campeão Dourado',
    description: 'O melhor arqueiro da guarda do Rei Dourado, em toda a sua glória: armadura de ouro polido, detalhes carmim e olhos dourados.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0xd8a830, secondary: 0x8a1420, accent: 0xffe08a, eyes: 0xffc020 },
    // Metálico: brilho de ouro polido (o modelo tem um material só, então o rosto vira ouro claro, como estátua de campeão).
    model: { metal: true, skinColor: 0xf6dc8a, theme: theme(0xf2c840, 0xb02430, 0xfff2b0, 0.8), variant: 'champion' },
  },
  {
    id: 'sylwen-autumn',
    characterId: 'elf',
    name: 'Sylwen do Outono',
    description: 'Quando as folhas de Lethariel ficam vermelhas, a guardiã veste o outono: laranja, cobre e folhas secas.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0xc8501a, secondary: 0x6a3a1a, accent: 0xd08040, eyes: 0xffb040 },
    model: { theme: theme(0xd85a1e, 0x6a3a1a, 0xd8904a), variant: 'autumn' },
  },
  {
    id: 'eldrin-fire',
    characterId: 'mage',
    name: 'Eldrin, Mago das Chamas',
    description: 'O lado proibido dos livros da Torre: túnica carmim, couro chamuscado e orbes de fogo.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0xb01818, secondary: 0x2a1010, accent: 0xffa020, eyes: 0xff7a1a },
    model: { theme: theme(0xb81a1a, 0x2a1414, 0xffb030, 0.5), variant: 'fire' },
  },
  {
    id: 'raszar-lava',
    characterId: 'lizard',
    name: 'Raszar Magmático',
    description: 'Mergulhou num vulcão e saiu de pedra quente: escamas de basalto, rachaduras de lava brilhando na cabeça e espinhos de obsidiana na ombreira.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x2a2020, secondary: 0xff6a1a, skin: 0x4a3a34, accent: 0xff7a20, eyes: 0xffc040 },
    model: { skinColor: 0x5a4640, theme: theme(0x2a2222, 0xff6a1a, 0x9a9a9a, 0.5), variant: 'magma' },
  },
  {
    id: 'cobalto-gold',
    characterId: 'robot',
    name: 'Cobalto Dourado',
    description: 'Edição de colecionador: blindagem banhada a ouro e olhos vermelhos de alerta.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0xc89a30, secondary: 0x3a2a10, skin: 0xd4a020, accent: 0x1a1a1a, eyes: 0xff3030 },
    model: { skinColor: 0xd8a830, theme: theme(0x3a2c18, 0x8a1a1a, 0xf0c040, 0.6), variant: 'gold-bot' },
  },
  {
    id: 'fenna-arctic',
    characterId: 'fox',
    name: 'Fenna Ártica',
    description: 'Missão no polo: pelagem branca de raposa-do-ártico e traje de gelo azul.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0xdfe8f4, secondary: 0x4a8ad8, skin: 0xf2f4f8, accent: 0x4ab8ff, eyes: 0x4ad8ff },
    model: { skinColor: 0xf4f6fa, variant: 'arctic' },
  },
  {
    id: 'noctua-snow',
    characterId: 'owl',
    name: 'Noctua das Neves',
    description: 'A vigia do inverno: penas brancas como a neve e olhos dourados que nunca piscam.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0xeef0f4, secondary: 0x9aa4b4, skin: 0xf4f4f6, accent: 0x2a2a30, eyes: 0xffd040 },
    model: { theme: theme(0xe8ecf2, 0x8a94a4, 0xc8ccd8, 0.75), variant: 'snow' },
  },
  {
    id: 'aurion-cosmic',
    characterId: 'goldbird',
    name: 'Áurion Cósmico',
    description: 'Viu o centro da galáxia e voltou com as cores dela: violeta profundo e brilho ciano.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0x5a3ac8, secondary: 0x1a1040, skin: 0x6a4ad8, accent: 0x3affc8, eyes: 0xff6ae0 },
    model: { theme: theme(0x4a2ab8, 0x1a1040, 0x3affc8, 0.5), variant: 'cosmic' },
  },
  {
    id: 'ossurso-obsidian',
    characterId: 'skelbear',
    name: 'Ossurso Obsidiana',
    description: 'Ossos que viraram pedra negra e uma alma verde que não se apaga.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x1e1e24, secondary: 0x2a2a30, skin: 0x2a2a32, accent: 0x5aff8a, eyes: 0x5aff8a },
    model: { theme: theme(0x1e1e24, 0x2a3a2a, 0x5aff8a, 0.45), variant: 'obsidian' },
  },
  {
    id: 'squalo-abyss',
    characterId: 'shark',
    name: 'Squalo Abissal',
    description: 'Das fossas onde não chega luz: pele quase negra com manchas que brilham em ciano.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x10202a, secondary: 0x1a3a4a, skin: 0x1a2a38, accent: 0x3ae8ff, eyes: 0x3ae8ff },
    model: { theme: theme(0x14262e, 0x1a3a4a, 0x3ae8ff, 0.5), variant: 'abyss' },
  },
  // ---------------------------------------------------------------- trio completo
  // Kael
  {
    id: 'kael-moon',
    characterId: 'hunter',
    name: 'Kael, Assassino da Lua',
    description: 'Caça só nas noites de lua cheia: violeta profundo, couro roxo e lâminas de prata.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0x5a34a0, secondary: 0x7a48c0, accent: 0xe4eaff, eyes: 0xc8a8ff },
    model: { theme: theme(0x5a34a0, 0x7a48c0, 0xe4eaff, 0.7), variant: 'moon' },
  },
  // Sylwen
  {
    id: 'sylwen-lunar',
    characterId: 'elf',
    name: 'Sylwen Lunar',
    description: 'A guardiã da noite élfica: azul-noite e prata, como o luar entre as árvores-mãe.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x4a6ac8, secondary: 0x2a3c7a, accent: 0xe8eef8, eyes: 0xa8d8ff },
    model: { theme: theme(0x4a6ac8, 0x2a3c7a, 0xe8eef8, 0.75), variant: 'lunar' },
  },
  {
    id: 'sylwen-fairy',
    characterId: 'elf',
    name: 'Sylwen, Rainha das Fadas',
    description: 'Coroada pelas fadas de Lethariel: vestes rosadas, pétalas e ouro.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0xe86aa8, secondary: 0xffd0e8, accent: 0xffd040, eyes: 0xff8ad8 },
    model: { theme: theme(0xe86aa8, 0xffc8e2, 0xffd040, 0.7), variant: 'fairy' },
  },
  // Eldrin
  {
    id: 'eldrin-ice',
    characterId: 'mage',
    name: 'Eldrin, Mago do Gelo',
    description: 'Um inverno inteiro estudando na torre mais alta: túnica azul-gelo e cristais.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0x4aa8e8, secondary: 0xe0f0ff, accent: 0xc0e8ff, eyes: 0x8ae0ff },
    model: { theme: theme(0x4aa8e8, 0xd8ecff, 0xc0e8ff, 0.7), variant: 'ice' },
  },
  {
    id: 'eldrin-celestial',
    characterId: 'mage',
    name: 'Eldrin, Arquimago Celestial',
    description: 'O mestre da Torre das Estrelas em traje de cerimônia: branco, azul-noite e ouro.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0xf0eada, secondary: 0x2a2a6a, accent: 0xffd040, eyes: 0xffe080 },
    model: { theme: theme(0xe8e2d2, 0x2a2a6e, 0xffd040, 0.65), variant: 'celestial' },
  },
  // Raszar
  {
    id: 'raszar-swamp',
    characterId: 'lizard',
    name: 'Raszar do Pântano',
    description: 'Como era em Krosh: escamas verde-musgo, couro de crocodilo, musgo nos ombros e um cipó com folhas descendo da ombreira.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0x3a4a20, secondary: 0x5a3a20, skin: 0x4a6a2a, accent: 0x8a8a6a, eyes: 0xffd040 },
    model: { skinColor: 0x4a6a2a, theme: theme(0x3a4a22, 0x5a3a20, 0x8a8a6a, 0.6), variant: 'swamp' },
  },
  {
    id: 'raszar-dragon',
    characterId: 'lizard',
    name: 'Raszar, Dragão Dourado',
    description: 'A lenda diz que um lagarto que vive mil anos vira dragão: escamas de ouro, chifres e bigodes de dragão, vestes de fogo e um medalhão de rubi.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0x8a1010, secondary: 0x5a0a0a, skin: 0xd8a830, accent: 0xff3010, eyes: 0xff4010 },
    model: { skinColor: 0xd8a830, metal: true, theme: theme(0x8a1010, 0x5a0a0a, 0xffd040, 0.55), variant: 'dragon' },
  },
  // Cobalto
  {
    id: 'cobalto-camo',
    characterId: 'robot',
    name: 'Cobalto Camuflado',
    description: 'Modo de patrulha na floresta: blindagem verde-oliva e lentes amarelas.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0x4a5a2a, secondary: 0x3a3020, skin: 0x5a6a3a, accent: 0x2a2a20, eyes: 0xffd040 },
    model: { skinColor: 0x5a6a3a, theme: theme(0x4a5a2a, 0x3a3020, 0x6a6a5a, 0.6), variant: 'camo' },
  },
  {
    id: 'cobalto-neon',
    characterId: 'robot',
    name: 'Cobalto Neon',
    description: 'Atualização de fliperama: carcaça preta com luzes rosa e ciano.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x1a1a24, secondary: 0xff2a8a, skin: 0x2a2a34, accent: 0x3ae8ff, eyes: 0xff2a8a },
    model: { skinColor: 0x2a2a34, theme: theme(0x1a1a24, 0xff2a8a, 0x3ae8ff, 0.5), variant: 'neon' },
  },
  // Fenna
  {
    id: 'fenna-mars',
    characterId: 'fox',
    name: 'Fenna, Exploradora de Marte',
    description: 'Primeira raposa no planeta vermelho: traje cor de ferrugem com placas brancas.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0xc8502a, secondary: 0x6a2a1a, accent: 0xe0e0e0, eyes: 0xffd040 },
    model: { metal: true, theme: theme(0xc8502a, 0x6a2a1a, 0xe8e8e8, 0.6), variant: 'mars' },
  },
  {
    id: 'fenna-galaxy',
    characterId: 'fox',
    name: 'Fenna Galáctica',
    description: 'Voltou de uma nebulosa diferente: pelagem violeta e traje roxo com estrelas douradas.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0x3a1a6a, secondary: 0x1a0a3a, skin: 0x6a4ad8, accent: 0xffd040, eyes: 0x3affe8 },
    model: { skinColor: 0x6a4ad8, metal: true, theme: theme(0x3a1a6a, 0x1a0a3a, 0xffd040, 0.55), variant: 'galaxy' },
  },
  // Noctua
  {
    id: 'noctua-royal',
    characterId: 'owl',
    name: 'Noctua, Coruja-Real',
    description: 'Da linhagem das grandes corujas-reais: penas cor de canela e olhos de fogo.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x6a3a1a, secondary: 0x3a2010, skin: 0x8a5a2a, accent: 0xd8a040, eyes: 0xff8a1a },
    model: { theme: theme(0x6a3a1a, 0x3a2010, 0xd8a040, 0.55), variant: 'royal' },
  },
  {
    id: 'noctua-celestial',
    characterId: 'owl',
    name: 'Noctua, Guardiã Celeste',
    description: 'Vigia as estrelas e não só a noite: plumagem azul-noite com bordas de ouro.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0x1a2a5a, secondary: 0x10183a, skin: 0x2a3a7a, accent: 0xffd040, eyes: 0x8ae8ff },
    model: { theme: theme(0x1a2a5c, 0x10183c, 0xffd040, 0.5), variant: 'owl-celestial' },
  },
  // Áurion
  {
    id: 'aurion-silver',
    characterId: 'goldbird',
    name: 'Áurion Prateado',
    description: 'Do planeta gêmeo, feito de prata: penas metálicas e brilho azul.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0x8a94a4, secondary: 0x4a5464, skin: 0xc8ccd8, accent: 0x4ab8ff, eyes: 0x4ab8ff },
    model: { theme: theme(0x8a94a4, 0x4a5464, 0xe0e4ec, 0.6), variant: 'silver' },
  },
  {
    id: 'aurion-ruby',
    characterId: 'goldbird',
    name: 'Áurion Rubi',
    description: 'Lapidado no núcleo de uma estrela vermelha: penas rubi e detalhes de ouro.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x8a1020, secondary: 0x3a0a10, skin: 0xc81a3a, accent: 0xffd040, eyes: 0xffd040 },
    model: { theme: theme(0x8a1020, 0x3a0a10, 0xffd040, 0.5), variant: 'ruby' },
  },
  // Ossurso
  {
    id: 'ossurso-ancient',
    characterId: 'skelbear',
    name: 'Ossurso, Ossos Antigos',
    description: 'Mil invernos debaixo da terra: ossos amarelados, couro gasto e olhos de brasa.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0x5a4a30, secondary: 0x3a2a1a, skin: 0xc8b07a, accent: 0x8a5a2a, eyes: 0xffa040 },
    model: { theme: theme(0x5a4a30, 0x3a2a1a, 0xb8a070, 0.6), variant: 'ancient' },
  },
  {
    id: 'ossurso-ice',
    characterId: 'skelbear',
    name: 'Ossurso, Rei do Gelo Eterno',
    description: 'A Montanha Gelada o coroou de novo: ossos de cristal de gelo que reluzem.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0x4a8ad8, secondary: 0x1a3a6a, skin: 0xbfefff, accent: 0x4ad8ff, eyes: 0x4ad8ff },
    model: { metal: true, theme: theme(0x4a8ad8, 0x1a3a6a, 0xe8f8ff, 0.6), variant: 'ice-king' },
  },
  // Squalo
  {
    id: 'squalo-tiger',
    characterId: 'shark',
    name: 'Squalo, Tubarão-tigre',
    description: 'O primo listrado do Recife Partido: pele cinza-areia e listras laranja.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0x5a5a4a, secondary: 0xc86a2a, skin: 0x7a7a6a, accent: 0xff8a2a, eyes: 0xffd040 },
    model: { theme: theme(0x5a5a4a, 0xc86a2a, 0xb0b0a0, 0.6), variant: 'tiger' },
  },
  {
    id: 'squalo-king',
    characterId: 'shark',
    name: 'Squalo, Rei dos Mares',
    description: 'Tomou a coroa do Recife: pele azul-real e armadura de ouro do fundo do mar.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0x1a2a8a, secondary: 0x10184a, skin: 0x2a4ab8, accent: 0xffd040, eyes: 0xffd040 },
    model: { metal: true, theme: theme(0x1a2a8a, 0x10184a, 0xffd040, 0.55), variant: 'sea-king' },
  },
  // Faísca
  {
    id: 'faisca-bamboo',
    characterId: 'redpanda',
    name: 'Faísca do Bambu',
    description: 'Camuflada para as copas da Floresta de Bambu: roupa verde-bambu, couro claro e luzes verde-limão.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0x5a7a2a, secondary: 0x3a4a1a, accent: 0xd8b060, eyes: 0xa8ff3a },
    model: { theme: theme(0x6a8a32, 0xd0a868, 0xc8c090, 0.6), variant: 'bamboo' },
  },
  {
    id: 'faisca-neon',
    characterId: 'redpanda',
    name: 'Faísca Neon',
    description: 'Turno da noite na cidade das máquinas: jaqueta preta, peças cromadas, pelo carmim escuro e luzes rosa-néon.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x1a1a22, secondary: 0x0e0e14, skin: 0x8a1a2a, accent: 0xdfe6ee, eyes: 0xff3ad8 },
    model: { skinColor: 0x8a1a2a, metal: true, theme: theme(0x22222c, 0x3a1a3a, 0xe8eef4, 0.45), variant: 'faisca-neon' },
  },
  {
    id: 'faisca-solar',
    characterId: 'redpanda',
    name: 'Faísca, Núcleo Solar',
    description: 'O inventor trocou o núcleo por um pedaço de sol: pelo dourado, traje branco com ouro brilhante e uma luz que queima laranja.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0xf2ece0, secondary: 0xd8a028, skin: 0xe8a430, accent: 0xffd040, eyes: 0xff8a1a },
    model: { skinColor: 0xe8a430, metal: true, theme: theme(0xf0ece4, 0xd8a028, 0xffd040, 0.75), variant: 'solar' },
  },
  // Ringo
  {
    id: 'ringo-desert',
    characterId: 'lemur',
    name: 'Ringo do Deserto',
    description: 'Semanas de patrulha no cânion: camisa cor de areia, couro queimado de sol e chapéu claro de palha.',
    tier: 'rara',
    price: 600,
    palette: { primary: 0xd8b886, secondary: 0xd8c08a, accent: 0xc8962e, eyes: 0xffb03a },
    model: { theme: theme(0xd8b886, 0x9a6232, 0xd8a83a, 0.65), variant: 'desert' },
  },
  {
    id: 'ringo-outlaw',
    characterId: 'lemur',
    name: 'Ringo, o Fora-da-Lei',
    description: 'Dizem que, antes da estrela, ele estava do outro lado da lei: roupa preta, chapéu negro, pelo cor de fumaça e olhos vermelhos.',
    tier: 'épica',
    price: 900,
    palette: { primary: 0x1c1a1a, secondary: 0x161414, skin: 0x4a4644, accent: 0x9aa4ac, eyes: 0xff3a2a },
    model: { skinColor: 0x4a4644, theme: theme(0x2a2626, 0x3a2418, 0xa8b0b8, 0.45), variant: 'outlaw' },
  },
  {
    id: 'ringo-gold',
    characterId: 'lemur',
    name: 'Ringo, Lenda de Ouro',
    description: 'O xerife que virou lenda: traje branco, chapéu branco com faixa de ouro, pelo prateado e estrela de ouro maciço.',
    tier: 'lendária',
    price: 1200,
    palette: { primary: 0xf2ece0, secondary: 0xf4f0e8, skin: 0xc8ccd4, accent: 0xffcc33, eyes: 0xffd040 },
    model: { skinColor: 0xc8ccd4, metal: true, theme: theme(0xf0ece4, 0xd8a028, 0xffd040, 0.75), variant: 'legend' },
  },
];

export function getSkin(id: string | null | undefined): SkinDef | undefined {
  return id ? SKINS.find((s) => s.id === id) : undefined;
}

const TIER_ORDER: SkinTier[] = ['rara', 'épica', 'lendária'];

/** Skins do personagem, da rara à lendária. */
export function skinsOf(characterId: string): SkinDef[] {
  return SKINS.filter((s) => s.characterId === characterId).sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
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
