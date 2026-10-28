// Grama densa que acompanha o jogador. As lâminas ficam numa área quadrada
// em volta da câmera e "dão a volta" quando você anda (como uma esteira),
// então dá para ter muita grama sem custo no mapa inteiro. A altura do chão e
// onde há grama vêm de texturas lidas na GPU.
import * as THREE from 'three';
import { Random } from '../core/random';
import { windUniforms } from './materials';

export interface GrassField {
  /** Altura do terreno, amostrada numa grade `size` × `size` sobre o terreno todo. */
  heights: Float32Array;
  /** Densidade de grama 0–255 na mesma grade (0 em trilhas, ruínas, rocha). */
  density: Uint8Array;
  size: number;
  terrainHalfSize: number;
}

const VERTEX = /* glsl */ `
attribute vec4 aBlade; // x, z dentro da área; giro; altura
uniform vec2 uCenter;
uniform float uPatch;
uniform float uTerrainHalf;
uniform sampler2D uHeight;
uniform sampler2D uDensity;
uniform float uTime;
varying float vT;
varying vec3 vColor;
varying float vShade;
#include <fog_pars_vertex>

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Ruído suave (manchas de vários metros) para variar altura e cor sem repetição.
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  // Posição da lâmina "dando a volta" em torno do centro.
  vec2 origin = uCenter - uPatch * 0.5;
  vec2 wxz = origin + mod(aBlade.xy - origin, uPatch);
  vec2 uv = (wxz + uTerrainHalf) / (2.0 * uTerrainHalf);
  float ground = texture2D(uHeight, uv).r;
  float density = texture2D(uDensity, uv).r;
  float r = hash(wxz);
  // Some aos poucos na borda da área e onde não há grama.
  float dist = distance(wxz, uCenter);
  float fade = 1.0 - smoothstep(uPatch * 0.12, uPatch * 0.5, dist);
  float keep = step(r, density);
  // Manchas de grama alta e baixa (variam a cada poucos metros).
  float patchN = vnoise(wxz * 0.09) * 0.65 + vnoise(wxz * 0.31) * 0.35;
  float h = aBlade.w * fade * keep * mix(0.6, 1.0, density) * mix(0.55, 1.55, patchN);

  float t = position.y;
  vec3 p = position;
  p.x *= 0.75 + r * 0.6;
  p.y *= h;
  float c = cos(aBlade.z), s = sin(aBlade.z);
  p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);

  // Vento: rajadas que atravessam o campo + inclinação natural de cada lâmina.
  float gust = sin(uTime * 1.4 + wxz.x * 0.22 + wxz.y * 0.15) * 0.5 + 0.5;
  float wave = sin(uTime * 3.1 + wxz.x * 0.9 + wxz.y * 0.6) * 0.25;
  vec2 windDir = normalize(vec2(1.0, 0.35));
  float bend = t * t * h;
  p.xz += windDir * (gust * 0.55 + wave) * bend * 0.6;
  p.xz += (vec2(r, hash(wxz + 7.3)) - 0.5) * bend * 0.5;
  p.y -= bend * gust * 0.12;

  vec3 world = vec3(wxz.x, ground - 0.04, wxz.y) + p;
  vT = t;
  // Cores: verde-esmeralda, verde-amarelado e verde-escuro úmido em manchas; ponta mais clara.
  float tone = vnoise(wxz * 0.05 + 3.1);
  float dry = smoothstep(0.55, 0.85, vnoise(wxz * 0.13 - 7.0));
  vec3 baseCol = vec3(0.03, 0.075, 0.03);
  vec3 emerald = vec3(0.09, 0.30, 0.10);
  vec3 lime = vec3(0.26, 0.34, 0.07);
  vec3 deep = vec3(0.05, 0.18, 0.07);
  vec3 tipCol = mix(mix(deep, emerald, smoothstep(0.2, 0.6, tone)), lime, dry * 0.8);
  tipCol *= 0.85 + 0.3 * hash(wxz + 1.7);
  vColor = mix(baseCol, tipCol, smoothstep(0.0, 1.0, t));
  // Florzinhas silvestres: poucas lâminas, em grupos, com a ponta colorida.
  float flowerZone = smoothstep(0.62, 0.8, vnoise(wxz * 0.07 + 11.0));
  if (hash(wxz + 4.2) < 0.035 * flowerZone && t > 0.8) {
    float k = hash(wxz + 9.1);
    vec3 petal = k < 0.33 ? vec3(0.95, 0.93, 0.85) : (k < 0.66 ? vec3(1.0, 0.82, 0.2) : vec3(0.7, 0.5, 0.95));
    vColor = petal * 0.55;
  }
  vShade = 0.85 + gust * 0.25;

  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uSunColor;
uniform vec3 uAmbient;
varying float vT;
varying vec3 vColor;
varying float vShade;
#include <common>
#include <fog_pars_fragment>

void main() {
  // Ambiente azulado + sol dourado; a ponta "acende" com a luz atravessando (translucidez).
  vec3 light = uAmbient * (0.75 + 0.25 * vT) + uSunColor * (0.3 + 0.7 * vT) * vShade + uSunColor * 0.18 * vT * vT;
  gl_FragColor = vec4(vColor * light, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export class Grass {
  readonly mesh: THREE.Mesh;
  private blades = 0;
  /** Fração das lâminas desenhadas (o ajuste automático reduz em PC/celular fraco). */
  setDensity(fraction: number): void {
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = Math.round(this.blades * fraction);
  }
  private readonly material: THREE.ShaderMaterial;

  constructor(field: GrassField, blades: number, patch: number, sunColor: THREE.Color, ambient: THREE.Color, seed: number) {
    // Lâmina: faixa afinando até a ponta, levemente curvada.
    const segs = 4;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const w = 0.026 * (1 - t * 0.9);
      pos.push(-w, t, t * t * 0.08, w, t, t * t * 0.08);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const rng = new Random(seed);
    const data = new Float32Array(blades * 4);
    for (let i = 0; i < blades; i++) {
      data[i * 4] = rng.range(0, patch);
      data[i * 4 + 1] = rng.range(0, patch);
      data[i * 4 + 2] = rng.range(0, Math.PI * 2);
      data[i * 4 + 3] = rng.range(0.22, 0.55);
    }
    geo.setAttribute('aBlade', new THREE.InstancedBufferAttribute(data, 4));
    geo.instanceCount = blades;
    this.blades = blades;

    const heightTex = new THREE.DataTexture(
      new Uint16Array(Array.from(field.heights, (h) => THREE.DataUtils.toHalfFloat(h))),
      field.size, field.size, THREE.RedFormat, THREE.HalfFloatType,
    );
    const densityTex = new THREE.DataTexture(field.density, field.size, field.size, THREE.RedFormat, THREE.UnsignedByteType);
    for (const t of [heightTex, densityTex]) {
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearFilter;
      t.needsUpdate = true;
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uCenter: { value: new THREE.Vector2() },
          uPatch: { value: patch },
          uTerrainHalf: { value: field.terrainHalfSize },
          uHeight: { value: null },
          uDensity: { value: null },
          uSunColor: { value: sunColor },
          uAmbient: { value: ambient },
        },
      ]),
    });
    // Texturas e tempo depois do merge (merge clonaria as texturas).
    this.material.uniforms.uHeight.value = heightTex;
    this.material.uniforms.uDensity.value = densityTex;
    this.material.uniforms.uTime = windUniforms.uTime;

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'grass';
  }

  /** Centraliza a área de grama no jogador. */
  update(center: THREE.Vector3): void {
    this.material.uniforms.uCenter.value.set(center.x, center.z);
  }
}
