// Configurações do jogador (menu Configurações), salvas no navegador.
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
  /** Vibrar o celular e dar um tranco na câmera ao atirar. */
  vibration: boolean;
  /** 0 a 1. */
  volume: number;
  /** 'auto' = baixa no celular, alta no computador. */
  graphics: 'auto' | 'low' | 'medium' | 'high';
}

export const DEFAULT_SETTINGS: Settings = {
  mouseSensitivity: 0.0022,
  invertY: false,
  touchLookMultiplier: 1.8,
  touchFireAimMultiplier: 1.2,
  aimAssist: null,
  vibration: true,
  volume: 0.8,
  graphics: 'auto',
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
