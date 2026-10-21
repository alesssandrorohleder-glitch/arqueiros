// Comando de entrada de um personagem em um tick da simulação.
// É um objeto simples e serializável: no multiplayer, o cliente envia isto ao
// servidor; os bots (etapa 3) vão gerar o mesmo tipo de comando pela IA.
export interface InputCommand {
  /** -1 (trás) a 1 (frente). */
  forward: number;
  /** -1 (esquerda) a 1 (direita). */
  right: number;
  sprint: boolean;
  /** Pulo apertado neste tick. */
  jump: boolean;
  /** Direção da mira (rad). yaw 0 = norte (-Z); pitch positivo = para cima. */
  aimYaw: number;
  aimPitch: number;
  /** Botão de disparo segurado (etapa 2). */
  primary: boolean;
}

export const emptyCommand = (): InputCommand => ({
  forward: 0, right: 0, sprint: false, jump: false, aimYaw: 0, aimPitch: 0, primary: false,
});
