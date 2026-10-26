// Acabamento "premium" dos personagens (fantasia 3D cinematográfica, cartunesca):
// sem novos modelos nem texturas baixadas, só um ajuste no shader padrão do
// Three.js (MeshStandardMaterial) dos materiais do personagem:
//
// - Luz de contorno (rim light): a silhueta ganha um brilho suave, como a luz de
//   recorte dos filmes de animação, separando o personagem do cenário.
// - Microdetalhe procedural no relevo: trama de tecido, grão de couro ou escamas,
//   calculado na hora a partir da posição no modelo (a textura dos modelos do
//   KayKit é só uma paleta de cores chapadas, sem UV de detalhe).
// - Leve aumento de contraste/saturação na cor final.
//
// Não muda tamanho, ossos, animação nem hitbox: só a cor dos pixels do personagem.
// Os programas de shader são compartilhados por tipo de detalhe (customProgramCacheKey).
import * as THREE from 'three';

export type DetailKind = 'cloth' | 'leather' | 'scales' | 'smooth';

export interface PremiumOptions {
  /** Relevo procedural da superfície. */
  detail: DetailKind;
  /** Força do relevo (0 = liso). */
  bump?: number;
  /** Tamanho do desenho (repetições por metro no modelo). */
  scale?: number;
  /** Cor e força da luz de contorno. */
  rimColor?: number;
  rim?: number;
}

const DETAIL_CODE: Record<DetailKind, string> = {
  // Tecido: irregularidade macia (dobrinhas) com uma trama bem fraca por cima.
  cloth: 'float h = vnoise(p * 0.25) * 0.55 + vnoise(p) * 0.3 + 0.15 * sin(p.x * 3.1416 + p.y * 3.1416);',
  // Grão de couro: manchinhas irregulares.
  leather: 'float h = vnoise(p) * 0.7 + vnoise(p * 2.7) * 0.3;',
  // Escamas: células arredondadas.
  scales: 'vec2 q = p.xy + vec2(0.5 * floor(p.y), 0.0); vec2 f = fract(q) - 0.5; float h = 1.0 - smoothstep(0.15, 0.5, length(f));',
  smooth: 'float h = 0.0;',
};

const NOISE = /* glsl */ `
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

/** Aplica o acabamento premium a um material do personagem (uma vez só). */
export function applyPremium(material: THREE.Material, opts: PremiumOptions): void {
  const m = material as THREE.MeshStandardMaterial;
  if (!m.isMeshStandardMaterial || m.userData.premium) return;
  m.userData.premium = true;
  const uniforms = {
    uRimColor: { value: new THREE.Color(opts.rimColor ?? 0xfff0d8) },
    uRim: { value: opts.rim ?? 0.35 },
    uBump: { value: opts.bump ?? 0.6 },
    uDetailScale: { value: opts.scale ?? 40 },
  };
  m.userData.premiumUniforms = uniforms;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPremiumPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPremiumPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vPremiumPos;
uniform vec3 uRimColor;
uniform float uRim;
uniform float uBump;
uniform float uDetailScale;
${NOISE}
float premiumDetail(vec3 p) { ${DETAIL_CODE[opts.detail]} return h; }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  // Relevo procedural (mesma ideia do bump map do Three.js, com derivadas de tela).
  float hh = premiumDetail(vPremiumPos * uDetailScale);
  vec3 dpdx = dFdx(-vViewPosition);
  vec3 dpdy = dFdy(-vViewPosition);
  float dhdx = dFdx(hh);
  float dhdy = dFdy(hh);
  vec3 r1 = cross(dpdy, normal);
  vec3 r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  normal = normalize(abs(det) * normal - grad * uBump * 0.004);
}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
  // Luz de contorno + um pouco mais de contraste e cor.
  float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
  outgoingLight += uRimColor * fres * uRim;
  float l = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  outgoingLight = mix(vec3(l), outgoingLight, 1.1);
}
#include <opaque_fragment>`,
      );
  };
  // Mesmo código = mesmo programa (só os uniforms mudam entre materiais).
  m.customProgramCacheKey = () => `premium-${opts.detail}`;
  m.needsUpdate = true;
}
