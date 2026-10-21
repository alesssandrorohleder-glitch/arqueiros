// Pós-processamento: um leve brilho (bloom) nas partes mais claras.
// Desligado no perfil "low" (celular): aí o render vai direto para a tela.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { QualityProfile } from './quality';

export class PostFX {
  private readonly composer: EffectComposer | null = null;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene, private readonly camera: THREE.Camera, quality: QualityProfile) {
    if (!quality.post) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.12, 0.4, 2.5));
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number): void {
    this.composer?.setSize(w, h);
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
