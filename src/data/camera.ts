// Configuração da câmera em terceira pessoa (por cima do ombro).
export const CAMERA = {
  /** Distância da câmera atrás do ombro (m). */
  distance: 3.4,
  /** Deslocamento lateral para a direita (ombro direito) (m). */
  shoulderOffset: 0.7,
  /** Altura do ponto de giro da câmera acima dos pés (m). */
  pivotHeight: 1.6,
  /** Limites de inclinação vertical (rad). */
  minPitch: -1.25,
  maxPitch: 1.1,
  /** Folga para a câmera não encostar nas paredes (m). */
  collisionPadding: 0.3,
  /** Distância mínima quando há algo atrás do jogador (m). */
  minDistance: 0.6,
  /** Velocidade com que a câmera volta à distância normal após colisão. */
  returnSpeed: 6,
  /** Campo de visão normal e correndo (graus). */
  fov: 70,
  sprintFov: 77,
  fovSmoothing: 6,
  /** Com o arco totalmente puxado: campo de visão e distância (zoom de mira). */
  drawFov: 67,
  drawDistance: 3.1,
};
