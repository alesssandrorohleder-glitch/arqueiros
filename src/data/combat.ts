// Balanceamento geral do combate (vale para todos os arcos).
export const COMBAT = {
  // --- Tiro (automático e instantâneo) ---
  /**
   * Fração do dano do arco que cada flecha causa. Com tiro automático cada
   * flecha tira menos; o arco inicial (40) faz 20 por flecha: 5 no corpo ou
   * 3 na cabeça eliminam um personagem de 100 de vida.
   */
  shotDamageFraction: 0.5,
  /**
   * Cadência normal: o intervalo entre flechas de cada arco (data/bows.ts) é
   * multiplicado por este valor. Maior = atira mais devagar. A cadência rápida
   * (1) fica para a Fúria (ver FRENZY).
   */
  fireIntervalScale: 1.8,
  /** Alcance do tiro (m): o acerto é decidido na hora, numa linha reta da mira. */
  hitscanRange: 150,
  /** Velocidade da flecha que se vê voando até o ponto atingido (só visual, m/s). */
  tracerSpeed: 220,
  /** Raio do tiro (m): engorda um pouco os alvos para o acerto ficar mais justo. */
  arrowRadius: 0.12,
  /** Tempo que a flecha fica cravada no cenário (s). */
  stuckArrowLifetime: 20,
  /** Limite de flechas cravadas no mapa (as mais antigas somem). */
  maxStuckArrows: 80,
  /** Ângulo (rad) entre as flechas do leque de "Múltiplas flechas". */
  multishotFan: 0.04,

  /**
   * Auxílio de mira (ligado por padrão no celular): se a mira está a até este
   * ângulo (rad) de um inimigo na hora do tiro, a flecha vai nele.
   */
  aimAssistAngle: 0.05,
  /** Distância máxima do auxílio (m). */
  aimAssistRange: 70,
  /** Velocidade ao andar segurando o tiro (multiplicador). */
  drawMoveMultiplier: 0.85,

  // --- Dano ---
  /** Multiplicador de dano na cabeça. */
  headshotMultiplier: 2.0,

  // --- Alvos de treino ---
  dummyHealth: 100,
  dummyRespawnTime: 4,
};

/** Efeitos especiais dos arcos (épico em diante). */
export const EFFECTS = {
  // --- Múltiplas flechas ---
  multishotCount: 3,
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

/** Fúria: quem elimina o Lobo de brasa atira rápido e brilha em laranja por um tempo. */
export const FRENZY = {
  /** Duração (s). */
  duration: 30,
  /** Multiplicador do intervalo entre flechas durante a Fúria (1 = cadência cheia do arco). */
  fireIntervalScale: 1,
  /** Cor do brilho no personagem. */
  color: 0xff7a1a,
};
