// Prévia 3D de um personagem girando num pedestal (menu Personagens).
// Usa um renderizador próprio e pequeno, que só desenha enquanto visível.
import * as THREE from 'three';
import { DEFAULT_BOW_ID } from '../data/bows';
import { getCharacter } from '../data/characters';
import { createCharacterState, type CharacterState } from '../entities/CharacterState';
import { CharacterView } from '../entities/CharacterView';

export class CharacterPreview {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private view: CharacterView | null = null;
  private state: CharacterState | null = null;
  private running = false;
  private last = 0;
  private angle = 0.6;
  private readonly origin = new THREE.Vector3();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'char-preview';
    this.scene.add(new THREE.HemisphereLight(0xdfeeff, 0x3a3020, 1.6));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sun.position.set(2, 4, -3);
    this.scene.add(sun);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.85, 0.12, 40),
      new THREE.MeshStandardMaterial({ color: 0x4a4436, roughness: 0.9 }),
    );
    pedestal.position.y = -0.06;
    this.scene.add(pedestal);
    this.camera.position.set(0, 1.2, -4.6);
    this.camera.lookAt(0, 0.95, 0);
  }

  setCharacter(id: string): void {
    const def = getCharacter(id);
    if (this.view) this.scene.remove(this.view.root);
    this.view = new CharacterView(def);
    this.state = createCharacterState('preview', def.name, false, def, DEFAULT_BOW_ID, 0, 0, 0, 0);
    this.state.grounded = true;
    this.scene.add(this.view.root);
  }

  start(): void {
    if (this.running) return;
    if (!this.renderer) {
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      } catch {
        return; // sem WebGL extra: o menu funciona sem a prévia
      }
    }
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  private frame = (now: number): void => {
    if (!this.running || !this.renderer) return;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w > 0 && h > 0) {
      if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
      if (this.view && this.state) {
        this.angle += dt * 0.7;
        this.state.bodyYaw = this.angle;
        this.view.update(this.state, this.origin, dt);
      }
      this.renderer.render(this.scene, this.camera);
    }
    requestAnimationFrame(this.frame);
  };
}
