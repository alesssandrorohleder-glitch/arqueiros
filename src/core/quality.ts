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
  /** Máximo de linhas desenhadas no lado menor da tela (limita a opção Resolução). */
  maxLines: number;
  /** Modo Mínimo: sem grama, céu simples, chão e pedras com uma textura só, visão curta. */
  minimum: boolean;
}

/**
 * Placa de vídeo fraca ou 3D sem aceleração (o navegador desenhando no processador):
 * nesses casos até o menu travava. Lê o nome da placa pelo WebGL.
 */
export function detectWeakGpu(gl: WebGLRenderingContext | WebGL2RenderingContext): { weak: boolean; software: boolean; name: string } {
  let name = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    // sem a informação: considera normal
  }
  const software = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(name);
  // Integradas antigas (Intel HD 2000–5xxx, GMA) e celulares antigos.
  const weak = software || /intel\(r\) (hd graphics|gma)|mobile intel|gma \d|mali-[4t]|adreno \(tm\) [34]\d\d|powervr sgx/i.test(name);
  return { weak, software, name };
}

export function qualityProfile(settings: Settings, touchDevice: boolean, weakGpu = false): QualityProfile {
  // Automático: leve no celular e médio no PC (o Alto pesava demais em PC comum; escolha à mão).
  // Placa fraca/sem aceleração: sempre o leve no Automático.
  const level = settings.graphics === 'auto' ? (touchDevice || weakGpu ? 'low' : 'medium') : settings.graphics;
  if (level === 'minimum') {
    return { pixelRatio: 1, shadowMapSize: 512, grassBlades: 0, grassPatch: 30, post: false, textureSize: 256, shadows: false, maxLines: 540, minimum: true };
  }
  const dpr = window.devicePixelRatio || 1;
  switch (level) {
    case 'low':
      return { pixelRatio: Math.min(dpr, 1.25), shadowMapSize: 1024, grassBlades: 30000, grassPatch: 40, post: false, textureSize: 512, shadows: false, maxLines: 720, minimum: false };
    case 'medium':
      // Médio sem pós-processamento (brilho + correção de cor em tela cheia eram o efeito mais caro).
      return { pixelRatio: Math.min(dpr, 1.5), shadowMapSize: 2048, grassBlades: 70000, grassPatch: 54, post: false, textureSize: 512, shadows: true, maxLines: 1080, minimum: false };
    default:
      return { pixelRatio: Math.min(dpr, 2), shadowMapSize: 4096, grassBlades: 100000, grassPatch: 66, post: true, textureSize: 512, shadows: true, maxLines: 1440, minimum: false };
  }
}
