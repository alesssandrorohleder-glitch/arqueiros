// Perfis de qualidade gráfica. O celular usa o perfil "low" automaticamente.
import type { Settings } from '../data/settings';

export interface QualityProfile {
  pixelRatio: number;
  shadowMapSize: number;
  /** Lâminas de grama e tamanho (m) da área com grama em volta do jogador. */
  grassBlades: number;
  grassPatch: number;
  /** Pós-processamento (bloom). */
  post: boolean;
  textureSize: number;
}

export function qualityProfile(settings: Settings, touchDevice: boolean): QualityProfile {
  const level = settings.graphics === 'auto' ? (touchDevice ? 'low' : 'high') : settings.graphics;
  const dpr = window.devicePixelRatio || 1;
  switch (level) {
    case 'low':
      return { pixelRatio: Math.min(dpr, 1.25), shadowMapSize: 1024, grassBlades: 30000, grassPatch: 40, post: false, textureSize: 256 };
    case 'medium':
      return { pixelRatio: Math.min(dpr, 1.5), shadowMapSize: 2048, grassBlades: 80000, grassPatch: 56, post: true, textureSize: 512 };
    default:
      return { pixelRatio: Math.min(dpr, 2), shadowMapSize: 4096, grassBlades: 140000, grassPatch: 72, post: true, textureSize: 512 };
  }
}
