// Regras da partida.
export const MATCH = {
  /** Duração da partida (s). */
  duration: 300,
  /** Tempo eliminado até voltar (s). */
  respawnDelay: 3,
  /** Proteção depois de voltar (s): não leva dano. */
  spawnProtection: 1.5,
  /** Sem levar dano por este tempo (s), a vida começa a voltar... */
  regenDelay: 5,
  /** ...nesta velocidade (vida por segundo). */
  regenPerSecond: 8,
  /** Nome do jogador no placar. */
  playerName: 'Você',
};
