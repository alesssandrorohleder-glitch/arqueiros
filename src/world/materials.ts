// Materiais com shader estendido: textura triplanar (sem precisar de UV),
// mistura de texturas do terreno e balanço das folhas com o vento.
import * as THREE from 'three';

/** Tempo compartilhado pelos shaders de vento. Atualizado a cada quadro. */
export const windUniforms = { uTime: { value: 0 } };

const TRI_VERTEX_PARS = /* glsl */ `
varying vec3 vTriPos;
varying vec3 vTriNormal;
`;

const TRI_VERTEX = /* glsl */ `
{
  vec4 triWorld = vec4(transformed, 1.0);
  vec3 triN = objectNormal;
  #ifdef USE_INSTANCING
    triWorld = instanceMatrix * triWorld;
    triN = mat3(instanceMatrix) * triN;
  #endif
  triWorld = modelMatrix * triWorld;
  vTriPos = triWorld.xyz;
  vTriNormal = normalize(mat3(modelMatrix) * triN);
}
`;

const TRI_FRAGMENT_PARS = /* glsl */ `
varying vec3 vTriPos;
varying vec3 vTriNormal;
vec3 triplanar(sampler2D tex, vec3 p, vec3 n, float scale) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z);
  return texture2D(tex, p.zy * scale).rgb * w.x
       + texture2D(tex, p.xz * scale).rgb * w.y
       + texture2D(tex, p.xy * scale).rgb * w.z;
}
`;

/**
 * Textura projetada pelos 3 eixos do mundo. `moss` > 0 esverdeia as faces
 * viradas para cima (musgo em pedras e ruínas).
 */
export function triplanarMaterial(tex: THREE.Texture, scale: number, moss = 0, params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, ...params });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTriTex = { value: tex };
    shader.uniforms.uTriScale = { value: scale };
    shader.uniforms.uMoss = { value: moss };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${TRI_VERTEX_PARS}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${TRI_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uTriTex;\nuniform float uTriScale;\nuniform float uMoss;\n${TRI_FRAGMENT_PARS}`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec3 triN = normalize(vTriNormal);
        vec3 triCol = triplanar(uTriTex, vTriPos, triN, uTriScale);
        float mossMask = smoothstep(0.55, 0.85, triN.y) * uMoss;
        mossMask *= smoothstep(0.35, 0.65, triplanar(uTriTex, vTriPos * 0.37, triN, uTriScale).g);
        triCol = mix(triCol, vec3(0.16, 0.24, 0.07), mossMask);
        diffuseColor.rgb *= triCol;
        `,
      );
  };
  mat.customProgramCacheKey = () => `tri-${moss > 0 ? 1 : 0}`;
  return mat;
}

/**
 * Terreno: mistura grama, terra, rocha e neve conforme o atributo `splat`
 * (x = terra, y = rocha, z = sombra de floresta, w = neve).
 */
export function terrainMaterial(tex: { grass: THREE.Texture; dirt: THREE.Texture; rock: THREE.Texture }): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGrass = { value: tex.grass };
    shader.uniforms.uDirt = { value: tex.dirt };
    shader.uniforms.uRock = { value: tex.rock };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;\n${TRI_VERTEX_PARS}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvSplat = splat;\n${TRI_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uGrass;\nuniform sampler2D uDirt;\nuniform sampler2D uRock;\nvarying vec4 vSplat;\n${TRI_FRAGMENT_PARS}`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 wp = vTriPos.xz;
        // Duas escalas da mesma textura escondem a repetição.
        vec3 grass = texture2D(uGrass, wp * 0.21).rgb * mix(0.75, 1.2, texture2D(uGrass, wp * 0.023).g * 1.6 - 0.2);
        grass *= mix(1.0, 0.68, vSplat.z);
        vec3 dirt = texture2D(uDirt, wp * 0.26).rgb * mix(0.85, 1.1, texture2D(uDirt, wp * 0.04).r);
        vec3 rock = triplanar(uRock, vTriPos, normalize(vTriNormal), 0.11);
        // Bordas irregulares: o ruído da textura de terra quebra a transição.
        float edge = texture2D(uDirt, wp * 0.07).g - 0.5;
        float d = smoothstep(0.35, 0.65, vSplat.x + edge * 0.5);
        float r = smoothstep(0.3, 0.7, vSplat.y + edge * 0.4);
        vec3 col = mix(grass, dirt, d);
        col = mix(col, rock, r);
        col = mix(col, vec3(0.86, 0.88, 0.9), smoothstep(0.4, 0.6, vSplat.w + edge * 0.3));
        diffuseColor.rgb *= col;
        `,
      );
  };
  mat.customProgramCacheKey = () => 'terrain';
  return mat;
}

/** Folhagem (cartões com transparência) que balança com o vento. */
export function foliageMaterial(tex: THREE.Texture, sway: number): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.85,
    vertexColors: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float h = max(position.y - 1.2, 0.0);
          float ph = uTime * 1.3 + ip.x * 0.21 + ip.z * 0.17;
          transformed.x += (sin(ph) * 0.7 + sin(ph * 2.3 + position.y) * 0.3) * h * ${sway.toFixed(3)};
          transformed.z += sin(ph * 0.8 + 1.7) * h * ${(sway * 0.6).toFixed(3)};
        }
        `,
      );
  };
  mat.customProgramCacheKey = () => `foliage-${sway}`;
  return mat;
}
