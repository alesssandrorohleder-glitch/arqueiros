// Pós-processamento: um leve brilho (bloom) nas partes mais claras e a correção de
// cor "cinematográfica" (mais cor, sombras levemente azuladas, luzes douradas e
// uma vinheta suave) — um passe de tela só, barato.
// Desligado no perfil "low" (celular): aí o render vai direto para a tela.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/** Correção de cor (depois da saída sRGB). */
const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // Mais cor (sem estourar os tons de pele/escamas).
      c = mix(vec3(l), c, 1.14);
      // Sombras azuladas, luzes douradas (split toning suave).
      c += vec3(-0.012, 0.004, 0.03) * (1.0 - smoothstep(0.0, 0.45, l));
      c += vec3(0.03, 0.016, -0.022) * smoothstep(0.5, 1.0, l);
      // Contraste leve em S.
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);
      // Vinheta suave.
      vec2 d = vUv - 0.5;
      c *= 1.0 - 0.22 * smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0)));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};
import type { QualityProfile } from './quality';

export class PostFX {
  private readonly composer: EffectComposer | null = null;
  /** Desligado pelo ajuste automático quando o FPS cai (o bloom é o efeito mais caro). */
  enabled = true;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene, private readonly camera: THREE.Camera, quality: QualityProfile) {
    if (!quality.post) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.12, 0.4, 2.5));
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new ShaderPass(GradeShader));
  }

  setSize(w: number, h: number): void {
    this.composer?.setSize(w, h);
  }

  render(): void {
    if (this.composer && this.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
