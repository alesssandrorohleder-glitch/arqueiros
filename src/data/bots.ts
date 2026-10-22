// Bots: dificuldades e quem entra na partida.
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyDef {
  name: string;
  /** Tempo entre ver o inimigo e começar a atirar (s). */
  reactionTime: number;
  /** Cadência do bot em relação ao arco (0,5 = atira na metade da velocidade). */
  fireRate: number;
  /** Dano das flechas do bot em relação ao normal. */
  damage: number;
  /** Erro de mira (rad, desvio típico) depois de estabilizar. Muda a cada ~0,35 s. */
  aimError: number;
  /** Tempo mirando até a mira "assentar" (s). Antes disso o erro é maior. */
  settleTime: number;
  /** Até onde enxerga (m) e ângulo de visão (graus, total). */
  visionRange: number;
  visionFov: number;
  /** Chance de buscar cobertura ao levar dano. */
  coverChance: number;
  /** Abaixo desta fração de vida, prefere se esconder. */
  lowHealth: number;
  /** Distância que tenta manter do alvo (m). */
  preferredRange: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: {
    name: 'Fácil',
    reactionTime: 1.3,
    fireRate: 0.5,
    damage: 0.7,
    aimError: 0.035,
    settleTime: 1.5,
    visionRange: 45,
    visionFov: 140,
    coverChance: 0.2,
    lowHealth: 0.25,
    preferredRange: 22,
  },
  normal: {
    name: 'Normal',
    reactionTime: 0.9,
    fireRate: 0.65,
    damage: 0.85,
    aimError: 0.026,
    settleTime: 1.1,
    visionRange: 60,
    visionFov: 160,
    coverChance: 0.4,
    lowHealth: 0.35,
    preferredRange: 28,
  },
  hard: {
    name: 'Difícil',
    reactionTime: 0.55,
    fireRate: 0.85,
    damage: 1,
    aimError: 0.018,
    settleTime: 0.8,
    visionRange: 75,
    visionFov: 180,
    coverChance: 0.6,
    lowHealth: 0.4,
    preferredRange: 32,
  },
};

export interface BotSlot {
  name: string;
  characterId: string;
  difficulty: Difficulty;
  /** Arco do bot (padrão: o arco inicial). */
  bowId?: string;
}

/** Bots da partida. Adicione/remova linhas para mudar a quantidade. */
export const BOT_ROSTER: BotSlot[] = [
  { name: 'Lirien', characterId: 'elf', difficulty: 'normal', bowId: 'recurve' },
  { name: 'Ravok', characterId: 'lizard', difficulty: 'easy' },
  { name: 'Unidade-7', characterId: 'robot', difficulty: 'easy' },
  { name: 'Ruivo', characterId: 'fox', difficulty: 'normal', bowId: 'elvenLong' },
  { name: 'Mestre Oru', characterId: 'owl', difficulty: 'easy', bowId: 'yew' },
];

/**
 * Nível escolhido pelo jogador (Configurações): ajusta a dificuldade de cada
 * bot da lista. 'easy' rebaixa todos para fácil; 'hard' sobe um nível.
 */
export type BotLevel = 'easy' | 'normal' | 'hard';

export function botDifficultyFor(slot: BotSlot, level: BotLevel): Difficulty {
  if (level === 'easy') return 'easy';
  if (level === 'hard') return slot.difficulty === 'easy' ? 'normal' : 'hard';
  return slot.difficulty;
}
