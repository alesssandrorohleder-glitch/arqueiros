// Nível do personagem DENTRO da partida (a partir do 1, sem limite): sobe abatendo
// tropas, criaturas e inimigos (e com assistências e torres derrubadas). Cada nível
// deixa o personagem mais forte e custa mais XP que o anterior. Começa no 1 a cada
// partida; renascer não perde nível.
// (O nível da CONTA, que sobe entre partidas, fica em data/progression.ts.)

export const MATCH_LEVELS = {
  /** XP para subir do nível 1 ao 2; cada nível seguinte custa `perLevel` a mais. */
  first: 60,
  perLevel: 45,
  // --- XP ganho ---
  /** Eliminar outro personagem. */
  kill: 100,
  /** Assistência (causou dano em quem foi eliminado nos últimos ASSIST.window s). */
  assist: 50,
  /** Torre derrubada (para cada um do time); o gigante encerra a partida. */
  tower: 120,
  // Criaturas e tropas dão o XP delas (data/mobs.ts → xp).
  // --- Bônus por nível acima do 1 ---
  /** Dano das flechas e habilidades (+5% por nível: +45% no nível 10, +95% no 20). */
  damagePerLevel: 0.05,
  /** Vida máxima (+7 por nível: +63 no nível 10, +133 no 20). */
  healthPerLevel: 7,
  /** Ao subir de nível, recupera esta fração da vida máxima. */
  levelUpHeal: 0.25,
};

/** Assistências de abate. */
export const ASSIST = {
  /** Quem causou dano na vítima nos últimos `window` segundos (e não deu o abate) ganha a assistência. */
  window: 10,
};

/** XP total (desde o nível 1) para chegar ao nível `level`. */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += MATCH_LEVELS.first + MATCH_LEVELS.perLevel * (l - 1);
  return total;
}
