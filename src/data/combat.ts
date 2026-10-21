// Balanceamento geral do combate (vale para todos os arcos).
export const COMBAT = {
  // --- Flecha ---
  /** Gravidade da flecha (m/s²). Menor que a real para o arco ser jogável. */
  arrowGravity: 10,
  /** Tempo máximo de voo antes de sumir (s). */
  arrowMaxFlightTime: 6,
  /** Tempo que a flecha fica cravada no cenário (s). */
  stuckArrowLifetime: 20,
  /** Limite de flechas cravadas no mapa (as mais antigas somem). */
  maxStuckArrows: 80,
  /** Raio de colisão da flecha (m): um pouco generoso para ajudar a mira. */
  arrowRadius: 0.05,

  // --- Carga ---
  /** Soltando antes disto (s), o tiro é cancelado. */
  minDrawToFire: 0.12,
  /** Velocidade ao andar com o arco puxado (multiplicador). */
  drawMoveMultiplier: 0.85,

  // --- Dano ---
  /** Multiplicador de dano na cabeça. */
  headshotMultiplier: 2.0,

  // --- Dispersão da mira (em radianos, raio do cone) ---
  /** Parado com o arco puxado. */
  spreadStill: 0.003,
  /** Somado por m/s de velocidade horizontal. */
  spreadPerSpeed: 0.006,
  /** No ar. */
  spreadAir: 0.08,
  /** Ao começar a puxar. */
  spreadDrawStart: 0.05,
  /** Rapidez com que a mira fecha/abre (maior = mais rápido). */
  spreadConvergeRate: 3.5,
  /** Multiplicador da dispersão para estabilidade 0 e 1 do arco. */
  spreadScaleUnstable: 1.6,
  spreadScaleStable: 0.6,

  // --- Cansaço do braço ---
  /** Tremor máximo (rad) após cansar. */
  fatigueMaxSway: 0.06,
  /** Segundos de cansaço até chegar no tremor máximo. */
  fatigueRampTime: 2.0,

  // --- Alvos de treino ---
  dummyHealth: 100,
  dummyRespawnTime: 4,
};

/** Efeitos especiais dos arcos (épico em diante). */
export const EFFECTS = {
  // --- Múltiplas flechas ---
  multishotCount: 3,
  /** Ângulo entre as flechas do leque (rad). */
  multishotSpread: 0.06,
  /** Fração do dano de cada flecha. */
  multishotDamageFraction: 0.6,

  // --- Gelo ---
  /** Multiplicador de velocidade de quem foi congelado. */
  frostSlow: 0.5,
  frostDuration: 2.5,

  // --- Perfurante ---
  /** Quantos alvos a mais a flecha atravessa. */
  piercingCount: 2,
  /** Dano que sobra depois de atravessar cada alvo. */
  piercingDamageKeep: 0.75,

  // --- Ricochete ---
  ricochetBounces: 2,
  /** Velocidade que sobra a cada quique. */
  ricochetSpeedKeep: 0.75,
  /** Dano que sobra a cada quique. */
  ricochetDamageKeep: 0.85,

  // --- Explosiva ---
  explosionRadius: 3.2,
  /** Dano no centro, como fração do dano da flecha (cai até 0 na borda). */
  explosionDamageFraction: 0.8,
};
