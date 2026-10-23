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

/**
 * Cores da roupa por categoria da textura do modelo: tecido (verdes/azuis),
 * couro (marrons/vermelhos) e metal/claros. O resto é escurecido por `other`.
 */
export interface ThemeColors {
  cloth: number;
  leather: number;
  metal: number;
  other: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  /** História (lore) mostrada no menu de escolha de personagem. */
  story: string;
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
  /** Metalizado (robô, armadura da Fenna). */
  metal?: boolean;
  /**
   * Troca as cores da roupa ('evil' = preto, vermelho e dourado; 'astronaut' =
   * traje prateado) ou cores livres por categoria (usado pelas skins).
   */
  theme?: 'evil' | 'astronaut' | ThemeColors;
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
    description: 'Arqueiro do mal de capuz negro, manto de pele preta e olhos vermelhos. Equilibrado em tudo.',
    story:
      'Kael era o melhor arqueiro da guarda do Rei Dourado, até o dia em que foi traído e deixado para morrer na Floresta Negra. Lá, um espírito antigo lhe ofereceu uma segunda vida em troca de sangue. Kael aceitou. Voltou de manto negro e olhos vermelhos, e cada flecha que acerta agora devolve um pouco da vida que lhe tiraram. Os dourados da armadura são tudo o que restou do juramento antigo — e ele os usa para lembrar de quem ainda deve vingança.',
    style: 'human',
    palette: { primary: 0x1a1416, secondary: 0x8a1020, skin: 0xe0b48f, accent: 0xd4a020, eyes: 0xff2a1a },
    maxHealth: 100,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.0,
    radius: 0.4,
    height: 1.8,
    arrowTrail: 'normal',
    model: { file: 'rogue_hooded', styleExtras: true, theme: 'evil', skinColor: 0xe6d6cc },
  },
  elf: {
    id: 'elf',
    name: 'Sylwen',
    description: 'Elfa arqueira da floresta, de tiara e folhas douradas. Ágil: mais rápida, porém com menos vida.',
    story:
      'Sylwen nasceu no alto das árvores-mãe de Lethariel, onde os elfos aprendem a andar nos galhos antes de pisar no chão. Guardiã das folhas douradas, ela jurou proteger a floresta de todos que a queimam. Dizem que é tão leve que o vento a carrega: num piscar de olhos ela some de um lugar e aparece em outro, e o inimigo só percebe quando a flecha já está no ar.',
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
    story:
      'Eldrin estudou trezentos anos na Torre das Estrelas e escreveu livros que ninguém mais consegue ler. Cansado de feitiços longos demais para a guerra, encantou um arco e passou a disparar magia pura. Os orbes que giram à sua volta são memórias de antigos aprendizes, e quando o perigo chega eles se fundem num escudo arcano que nenhuma flecha comum atravessa.',
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
    story:
      'Raszar veio dos pântanos de Krosh, onde só sobrevive quem cura as próprias feridas. Caçador de uma tribo de lagartos esquecida, perdeu o clã para uma enchente e saiu pelo mundo com um arco feito de osso de crocodilo. Suas escamas grossas aguentam o que mataria qualquer um, e mesmo ferido ele se fecha como pedra até o corpo se refazer.',
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
    story:
      'Cobalto foi construído para ser uma sentinela: ficar parado num portão por mil anos. Mas uma tempestade de raios atingiu seu núcleo e, junto com a energia, veio a curiosidade. Hoje ele estuda os humanos, as flechas e o vento com seus olhos de luz. Quando se sente cercado, descarrega o núcleo num pulso EMP que deixa todos à volta lentos e tontos.',
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
    description: 'Raposa arqueira astronauta, de traje metálico, esperta e veloz, de cauda bem peluda.',
    story:
      'Fenna foi a primeira raposa a ir ao espaço — e a primeira a voltar. A nave caiu no meio da floresta, mas ela saiu inteira, com o traje metálico, a mochila-foguete e a capa da tripulação. Esperta e inquieta, ela trocou as estrelas por arcos e flechas, e ainda usa o propulsor para saltar por cima dos inimigos e planar até o melhor ponto de tiro.',
    style: 'fox',
    palette: { primary: 0x355e8c, secondary: 0x2c2c2c, skin: 0xe07a2e, accent: 0xf5f0e6, eyes: 0x1a1a1a },
    maxHealth: 95,
    speedMultiplier: 1.06,
    jumpMultiplier: 1.02,
    radius: 0.39,
    height: 1.72,
    arrowTrail: 'normal',
    // Traje metálico de astronauta (corpo recolorido, com capa, sem capacete).
    model: { file: 'rogue', customHead: true, skinColor: 0xe07a2e, theme: 'astronaut' },
  },
  owl: {
    id: 'owl',
    name: 'Noctua',
    description: 'Coruja arqueira de olhos enormes e asas de penas: pula mais alto.',
    story:
      'Noctua guarda a Biblioteca das Penas, onde ficam escritos todos os segredos da noite. Ela não dorme: vigia. Seus olhos enormes enxergam o que se esconde atrás das paredes e no escuro das árvores. Quando abre o Olhar de Coruja, nada lhe escapa — e cada flecha vai exatamente onde mais dói.',
    style: 'owl',
    palette: { primary: 0x7a5a3a, secondary: 0x4a3a2a, skin: 0xb08a5e, accent: 0xefe6d2, eyes: 0xffb020 },
    maxHealth: 100,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.12,
    radius: 0.4,
    height: 1.75,
    arrowTrail: 'normal',
    // Sem capa: as asas de penas ficam à mostra nas costas (antes ficavam debaixo da capa e a atravessavam).
    model: { file: 'knight', customHead: true, skinColor: 0xb08a5e, hide: ['Knight_Helmet', 'Knight_Cape'] },
  },
  goldbird: {
    id: 'goldbird',
    name: 'Áurion',
    description: 'Pássaro-alien dourado vindo das estrelas, de olhos que brilham. Leve: pula muito alto.',
    story:
      'Áurion veio de um planeta feito de ouro, que gira em volta de duas estrelas. Seu povo, metade ave, metade algo que ninguém sabe explicar, viaja entre mundos dobrando o espaço. Áurion caiu aqui atrás de um cristal roubado e ficou para conhecer este mundo estranho. Ele some num brilho e reaparece metros adiante, e seus olhos acendem quando está prestes a fazer isso.',
    style: 'goldbird',
    palette: { primary: 0xc9a227, secondary: 0x5a3a8a, skin: 0xffd24a, accent: 0x7fffd4, eyes: 0x3affc8 },
    maxHealth: 90,
    speedMultiplier: 1.05,
    jumpMultiplier: 1.18,
    radius: 0.38,
    height: 1.76,
    arrowTrail: 'magic',
    // Sem capa: as asas douradas ficam à mostra (antes atravessavam a capa).
    model: { file: 'mage', customHead: true, skinColor: 0xffc83a, hide: ['Mage_Hat', 'Mage_Cape'] },
  },
  skelbear: {
    id: 'skelbear',
    name: 'Ossurso',
    description: 'Urso esqueleto que voltou dos mortos: só ossos e fúria. O mais resistente, mas lento.',
    story:
      'Ossurso era o rei urso da Montanha Gelada, e morreu defendendo a sua caverna de caçadores. Mas a fúria dele era grande demais para descansar: os ossos se levantaram sozinhos, ainda com o arco nas garras. Não sente frio, nem medo, nem dor. Quando endurece a armadura de ossos, as flechas inimigas quase não fazem efeito.',
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
    story:
      'Squalo era o terror do Recife Partido, um tubarão grande demais até para o mar. Quando uma maldição o fez andar em terra, ele descobriu que o mundo seco também está cheio de presas. Aprendeu a usar o arco, mas nunca esqueceu o instinto: sente o cheiro do medo de longe e, quando o inimigo vacila, dispara numa investida e morde.',
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
