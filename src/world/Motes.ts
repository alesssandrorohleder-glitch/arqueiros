// Partículas de ambiente: pólen e poeirinha dourada flutuando no ar, brilhando
// contra o sol. Um único objeto (THREE.Points) numa caixa em volta da câmera que
// "dá a volta" como a grama: o movimento todo é calculado na GPU, sem custo na CPU.
import * as THREE from 'three';
import { Random } from '../core/random';
import { windUniforms } from './materials';

/** Tamanho (m) da caixa de partículas em volta da câmera. */
const BOX = 36;
const HEIGHT = 9;

const VERTEX = /* glsl */ `
attribute vec4 aMote; // x, y, z na caixa (0..1) e fase
uniform vec3 uCenter;
uniform float uTime;
uniform float uSize;
varying float vAlpha;
#include <fog_pars_vertex>
void main() {
  float ph = aMote.w * 6.2832;
  // Deriva com o vento + vai e vem suave.
  vec3 drift = vec3(uTime * 0.35 + sin(uTime * 0.6 + ph) * 0.6, sin(uTime * 0.45 + ph * 1.7) * 0.35 + uTime * 0.05, uTime * 0.12 + cos(uTime * 0.5 + ph) * 0.6);
  vec3 box = vec3(${BOX.toFixed(1)}, ${HEIGHT.toFixed(1)}, ${BOX.toFixed(1)});
  vec3 origin = uCenter - box * vec3(0.5, 0.35, 0.5);
  vec3 p = origin + mod(aMote.xyz * box + drift - origin, box);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  // Some suavemente perto das bordas da caixa (sem "estalos" quando dão a volta).
  vec3 q = abs((p - origin) / box - 0.5) * 2.0;
  float edge = 1.0 - smoothstep(0.7, 1.0, max(q.x, max(q.y, q.z)));
  float twinkle = 0.6 + 0.4 * sin(uTime * 2.3 + ph * 3.0);
  vAlpha = edge * twinkle;
  gl_PointSize = uSize * (0.6 + aMote.w * 0.8) / max(-mvPosition.z, 0.5);
  #include <fog_vertex>
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * a, a * vAlpha);
  #include <fog_fragment>
}`;

export class Motes {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(count: number, pixelRatio: number, seed: number) {
    const rng = new Random(seed ^ 0x9011e);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < data.length; i++) data[i] = rng.next();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('aMote', new THREE.BufferAttribute(data, 4));
    // Posição fictícia (o vertex shader calcula a real); evita aviso do Three.js.
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uCenter: { value: new THREE.Vector3() },
          uSize: { value: 26 * pixelRatio },
          uColor: { value: new THREE.Color(1.0, 0.86, 0.55) },
        },
      ]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    });
    this.material.uniforms.uTime = windUniforms.uTime;
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  /** O tamanho do ponto é em pixels do buffer: acompanha a resolução. */
  setPixelRatio(pr: number): void {
    this.material.uniforms.uSize.value = 26 * pr;
  }

  update(center: THREE.Vector3): void {
    this.material.uniforms.uCenter.value.copy(center);
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
