// Progressão do jogador: XP por partida e níveis.
export const PROGRESSION = {
  // --- XP ganho numa partida ---
  /** Por eliminar outro arqueiro. */
  xpPerKill: 100,
  /** Bônus quando a eliminação foi com tiro na cabeça. */
  xpHeadshotKillBonus: 50,
  /** Por flecha que acertou alguém. */
  xpPerHit: 5,
  /** Por terminar em 1º lugar. */
  xpWin: 300,
  /** Por terminar entre os 3 primeiros (sem ser 1º). */
  xpTop3: 120,
  /** Só por jogar a partida até o fim. */
  xpParticipation: 50,

  // --- Níveis ---
  /** XP para ir do nível 1 ao 2. */
  xpFirstLevel: 300,
  /** Quanto o custo de cada nível seguinte aumenta. */
  xpPerLevelIncrease: 150,
};

/** XP necessário para sair do nível `level` para o próximo. */
export function xpToNext(level: number): number {
  return PROGRESSION.xpFirstLevel + PROGRESSION.xpPerLevelIncrease * (level - 1);
}

/** Nível atual e progresso dentro dele, a partir do XP total. */
export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, needed: xpToNext(level) };
}
