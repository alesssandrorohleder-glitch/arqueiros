// Configurações do jogador (futuramente editáveis no menu Configurações).
export interface Settings {
  /** Radianos girados por pixel de movimento do mouse. */
  mouseSensitivity: number;
  invertY: boolean;
  /** 0 a 1. Ainda sem sons (etapa 7). */
  volume: number;
  graphics: 'low' | 'medium' | 'high';
}

export const DEFAULT_SETTINGS: Settings = {
  mouseSensitivity: 0.0022,
  invertY: false,
  volume: 0.8,
  graphics: 'high',
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
