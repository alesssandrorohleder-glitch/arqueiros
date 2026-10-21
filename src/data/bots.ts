// Bots: dificuldades e quem entra na partida.
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyDef {
  name: string;
  /** Tempo entre ver o inimigo e começar a puxar o arco (s). */
  reactionTime: number;
  /** Erro de mira (rad, desvio típico) depois de estabilizar. */
  aimError: number;
  /** Tempo mirando até a mira "assentar" (s). Antes disso o erro é maior. */
  settleTime: number;
  /** Até onde enxerga (m) e ângulo de visão (graus, total). */
  visionRange: number;
  visionFov: number;
  /** Carga mínima antes de soltar (0 a 1). */
  minCharge: number;
  /** Quanto prevê o movimento do alvo (0 = nada, 1 = perfeito). */
  leadSkill: number;
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
    reactionTime: 0.9,
    aimError: 0.045,
    settleTime: 1.2,
    visionRange: 45,
    visionFov: 140,
    minCharge: 0.55,
    leadSkill: 0.3,
    coverChance: 0.2,
    lowHealth: 0.25,
    preferredRange: 22,
  },
  normal: {
    name: 'Normal',
    reactionTime: 0.6,
    aimError: 0.028,
    settleTime: 0.9,
    visionRange: 60,
    visionFov: 160,
    minCharge: 0.7,
    leadSkill: 0.6,
    coverChance: 0.4,
    lowHealth: 0.35,
    preferredRange: 28,
  },
  hard: {
    name: 'Difícil',
    reactionTime: 0.35,
    aimError: 0.016,
    settleTime: 0.6,
    visionRange: 75,
    visionFov: 180,
    minCharge: 0.85,
    leadSkill: 0.9,
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
  { name: 'Unidade-7', characterId: 'robot', difficulty: 'normal' },
  { name: 'Ruivo', characterId: 'fox', difficulty: 'hard', bowId: 'elvenLong' },
  { name: 'Mestre Oru', characterId: 'owl', difficulty: 'normal', bowId: 'storm' },
];
