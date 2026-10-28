// Configurações do jogador (menu Configurações), salvas no navegador.
import type { ModeId } from './modes';
export interface Settings {
  /** Radianos girados por pixel de movimento do mouse. */
  mouseSensitivity: number;
  invertY: boolean;
  /** Sensibilidade da mira por toque (arrastar no lado direito), relativa à do mouse. */
  touchLookMultiplier: number;
  /** Sensibilidade ao mirar arrastando o botão Atirar, relativa à de cima. */
  touchFireAimMultiplier: number;
  /** Auxílio de mira: null = automático (ligado no celular, desligado no PC). */
  aimAssist: boolean | null;
  /** Dificuldade dos bots no modo offline. */
  botLevel: 'easy' | 'normal' | 'hard';
  /** Vibrar o celular e dar um tranco na câmera ao atirar. */
  vibration: boolean;
  /** 0 a 1. */
  volume: number;
  /** Volume da música (0 a 1). */
  music: number;
  /** 'auto' = leve no celular, média no computador (e se ajusta ao FPS). */
  graphics: 'auto' | 'low' | 'medium' | 'high';
  /**
   * Resolução em que o jogo desenha (linhas no lado menor da tela). 'native' = todos os
   * pixels da tela. Antes o celular desenhava ~480 linhas e esticava (imagem borrada).
   */
  resolution: '720p' | '1080p' | '1440p' | 'native';
  /** Último modo de jogo escolhido (data/modes.ts). */
  mode: ModeId;
}

export const DEFAULT_SETTINGS: Settings = {
  mouseSensitivity: 0.0022,
  invertY: false,
  touchLookMultiplier: 1.8,
  touchFireAimMultiplier: 1.2,
  aimAssist: null,
  botLevel: 'easy',
  vibration: true,
  volume: 0.8,
  music: 0.5,
  graphics: 'auto',
  resolution: '1080p',
  mode: 'ffa',
};

const KEY = 'arqueiros.settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // localStorage indisponível (aba anônima, etc.): usa o padrão.
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignora
  }
}
