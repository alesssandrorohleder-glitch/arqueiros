// Prévia 3D de um personagem num pedestal (menu Personagens). Arrastar com o dedo
// ou o mouse gira o personagem (e inclina um pouco a câmera); soltando, ele segue
// girando com embalo. Parado sem mexer por alguns segundos, volta a girar sozinho.
// Usa um renderizador próprio e pequeno, que só desenha enquanto visível.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { characterBowId } from '../data/bows';
import { getCharacter } from '../data/characters';
import { applySkin } from '../data/skins';
import { createCharacterState, type CharacterState } from '../entities/CharacterState';
import { CharacterView } from '../entities/CharacterView';

/** Giro por pixel arrastado (rad). */
const DRAG_TURN = 0.012;
/** Segundos sem mexer até voltar a girar sozinho. */
const IDLE_AUTOSPIN = 5;

export class CharacterPreview {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private view: CharacterView | null = null;
  private state: CharacterState | null = null;
  private running = false;
  private last = 0;
  private angle = 0.5; // começa mostrando a frente, um pouco de lado
  private readonly origin = new THREE.Vector3();
  /** Arrastando com o dedo/mouse. */
  private dragId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  /** Velocidade de giro (rad/s) para o embalo depois de soltar. */
  private spin = 0;
  /** Inclinação da câmera (olhar de cima/de baixo), rad. */
  private tilt = 0.1;
  /** Tempo sem mexer (s): depois de IDLE_AUTOSPIN, volta a girar sozinho. */
  private idle = 0;

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
    this.placeCamera();
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragId = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.spin = 0;
      this.idle = 0;
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.classList.add('dragging');
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragId) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      const turn = dx * DRAG_TURN;
      this.angle += turn;
      // Velocidade suavizada para o embalo (giro por quadro de ~16 ms).
      this.spin = this.spin * 0.6 + (turn / 0.016) * 0.4;
      this.tilt = Math.max(-0.25, Math.min(0.6, this.tilt + dy * 0.006));
      this.placeCamera();
      this.idle = 0;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.dragId) return;
      this.dragId = null;
      this.canvas.classList.remove('dragging');
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
  }

  /** Câmera em órbita em volta do personagem, inclinada por `tilt`. */
  private placeCamera(): void {
    const dist = 4.6;
    this.camera.position.set(0, 0.95 + Math.sin(this.tilt) * dist, -Math.cos(this.tilt) * dist);
    this.camera.lookAt(0, 0.9, 0);
  }

  /** Mostra o personagem (com a skin, se houver). */
  setCharacter(id: string, skinId: string | null = null): void {
    const def = applySkin(getCharacter(id), skinId);
    if (this.view) this.scene.remove(this.view.root);
    this.view = new CharacterView(def);
    this.state = createCharacterState('preview', def.name, false, def, characterBowId(id), 0, 0, 0, 0);
    this.state.grounded = true;
    this.scene.add(this.view.root);
  }

  start(): void {
    if (this.running) return;
    if (!this.renderer) {
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        // Prévia pequena: 1,5× basta (2× pesava em PC fraco junto com o jogo de fundo).
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // Ambiente de "estúdio" para metais e brilhos refletirem algo (senão ficam pretos).
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.5;
        pmrem.dispose();
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
    // O horário do quadro (rAF) pode ser um pouco anterior ao start(): sem o max(0), o 1º dt
    // saía negativo e as suavizações "explodiam" (personagem ficava curvado para a frente).
    const dt = Math.max(0, Math.min((now - this.last) / 1000, 0.1));
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
        if (this.dragId === null) {
          this.idle += dt;
          // Embalo depois de soltar, que vai parando.
          this.angle += this.spin * dt;
          this.spin *= Math.exp(-dt * 3);
          // Sem mexer por um tempo: volta a girar sozinho, devagar.
          if (this.idle > IDLE_AUTOSPIN) this.angle += dt * 0.7 * Math.min(1, (this.idle - IDLE_AUTOSPIN) / 1.5);
        }
        this.state.bodyYaw = this.angle;
        this.view.update(this.state, this.origin, dt);
      }
      this.renderer.render(this.scene, this.camera);
    }
    requestAnimationFrame(this.frame);
  };
}
