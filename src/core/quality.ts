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
  /** Sombras do sol (desligadas no perfil leve: era o maior peso no celular). */
  shadows: boolean;
}

export function qualityProfile(settings: Settings, touchDevice: boolean): QualityProfile {
  // Automático: leve no celular e médio no PC (o Alto pesava demais em PC comum; escolha à mão).
  const level = settings.graphics === 'auto' ? (touchDevice ? 'low' : 'medium') : settings.graphics;
  const dpr = window.devicePixelRatio || 1;
  switch (level) {
    case 'low':
      return { pixelRatio: Math.min(dpr, 1.25), shadowMapSize: 1024, grassBlades: 30000, grassPatch: 40, post: false, textureSize: 512, shadows: false };
    case 'medium':
      return { pixelRatio: Math.min(dpr, 1.5), shadowMapSize: 2048, grassBlades: 80000, grassPatch: 56, post: true, textureSize: 512, shadows: true };
    default:
      return { pixelRatio: Math.min(dpr, 2), shadowMapSize: 4096, grassBlades: 100000, grassPatch: 66, post: true, textureSize: 512, shadows: true };
  }
}
