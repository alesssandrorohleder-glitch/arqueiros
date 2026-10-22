// Modo "Último de pé": uma vida só, sem renascer; vence o último vivo.
// Uma zona (círculo) fecha aos poucos num lugar sorteado do mapa (pode ser o
// centro ou um canto): fora dela se perde vida. Balanceamento aqui.

export interface ZonePhase {
  /** Espera antes de começar a fechar (s). */
  wait: number;
  /** Tempo fechando (s). */
  shrink: number;
  /** Raio ao fim desta fase (m). */
  radius: number;
  /** Dano por segundo fora da zona durante esta fase. */
  damage: number;
}

export const ROYALE = {
  /** Raio inicial (cobre o mapa todo, até as quinas). */
  startRadius: 130,
  /**
   * Cada círculo novo é sorteado dentro do anterior (o fim pode ser no centro ou
   * em qualquer canto). O centro fica a pelo menos isto da borda da área jogável (m).
   */
  edgePadding: 8,
  /** Fases da zona, em ordem. A última fecha até quase nada. */
  phases: [
    { wait: 25, shrink: 25, radius: 70, damage: 3 },
    { wait: 20, shrink: 20, radius: 42, damage: 5 },
    { wait: 15, shrink: 15, radius: 24, damage: 8 },
    { wait: 12, shrink: 15, radius: 11, damage: 12 },
    { wait: 10, shrink: 15, radius: 0, damage: 20 },
  ] as ZonePhase[],
  /** O dano da zona é aplicado em pulsos (s). */
  damageTick: 0.5,
  /** Distância do centro em que todos nascem, em volta do mapa (m). */
  spawnRing: 68,
  /** Bots: começam a voltar para dentro quando estão a menos disto da borda (m). */
  botEdgeMargin: 6,
};
