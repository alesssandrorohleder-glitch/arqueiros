// Balanceamento do movimento dos personagens.
// Valores em metros e segundos. Os multiplicadores de cada personagem
// (data/characters.ts) são aplicados por cima destes valores base.
export const MOVEMENT = {
  /** Velocidade andando (m/s). */
  walkSpeed: 5.0,
  /** Velocidade correndo com Shift (m/s). */
  sprintSpeed: 8.2,
  /** Multiplicador ao andar para trás (andar de costas é mais lento). */
  backwardMultiplier: 0.7,
  /** Multiplicador ao andar só para os lados. */
  strafeMultiplier: 0.88,
  /** Só corre se estiver indo para frente (input frontal acima deste valor). */
  sprintMinForward: 0.3,

  /** Aceleração no chão (m/s²): quão rápido chega na velocidade máxima. */
  groundAcceleration: 45,
  /** Desaceleração no chão ao soltar as teclas (m/s²). */
  groundDeceleration: 38,
  /** Controle no ar (m/s²): baixo para o pulo ter peso. */
  airAcceleration: 9,

  /** Velocidade vertical inicial do pulo (m/s). Altura ≈ v² / (2·g). */
  jumpVelocity: 7.2,
  /** Gravidade aplicada aos personagens (m/s²). */
  gravity: 22,
  /** Velocidade máxima de queda (m/s). */
  maxFallSpeed: 40,
  /** "Coyote time": ainda dá para pular logo após sair de uma borda (s). */
  coyoteTime: 0.1,
  /** Pulo apertado um pouco antes de tocar o chão ainda conta (s). */
  jumpBufferTime: 0.12,

  /** Altura máxima de degrau que se sobe andando (m). */
  stepHeight: 0.45,
  /** Distância para "grudar" no chão ao descer rampas/morros (m). */
  groundSnapDistance: 0.35,

  /** Velocidade de giro do corpo em direção à mira (rad/s). */
  turnSpeed: 12,
};
