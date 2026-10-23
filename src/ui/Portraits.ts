// Miniaturas da cabeça dos personagens (com a skin) para o aviso de abates.
// Cada personagem/skin é "fotografado" uma vez num renderizador pequeno e próprio
// e vira uma imagem (data URL) guardada; quem pede antes de ficar pronta recebe
// null e é avisado por `onReady` quando a foto sai.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { characterBowId } from '../data/bows';
import { getCharacter } from '../data/characters';
import { applySkin } from '../data/skins';
import { createCharacterState } from '../entities/CharacterState';
import { CharacterView } from '../entities/CharacterView';

/** Tamanho da foto (px). */
const SIZE = 96;
/** Tempo máximo esperando o modelo 3D carregar (ms). */
const LOAD_TIMEOUT = 15000;

export class Portraits {
  private readonly cache = new Map<string, string>();
  private readonly queue: string[] = [];
  private readonly queued = new Set<string>();
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
  private busy = false;
  /** Chamado quando a foto de uma chave fica pronta. */
  onReady: (key: string) => void = () => {};

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xdfeeff, 0x3a3020, 1.8));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
    sun.position.set(1.5, 3, -3);
    this.scene.add(sun);
  }

  static key(characterId: string, skin?: string | null): string {
    return `${characterId}:${skin ?? ''}`;
  }

  /** Foto da cabeça (data URL) ou null se ainda não está pronta (e começa a fazer). */
  get(characterId: string, skin?: string | null): string | null {
    const key = Portraits.key(characterId, skin);
    const url = this.cache.get(key);
    if (url) return url;
    if (!this.queued.has(key)) {
      this.queued.add(key);
      this.queue.push(key);
      void this.work();
    }
    return null;
  }

  private async work(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const key = this.queue.shift()!;
      try {
        const url = await this.shoot(key);
        if (url) {
          this.cache.set(key, url);
          this.onReady(key);
        }
      } catch {
        // Sem foto: o aviso continua com a inicial do nome.
      }
    }
    this.busy = false;
  }

  private ensureRenderer(): THREE.WebGLRenderer | null {
    if (this.renderer) return this.renderer;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1);
      r.setSize(SIZE, SIZE, false);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      const pmrem = new THREE.PMREMGenerator(r);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.5;
      pmrem.dispose();
      this.renderer = r;
    } catch {
      return null;
    }
    return this.renderer;
  }

  /** Monta o personagem, espera o modelo carregar e fotografa a cabeça. */
  private async shoot(key: string): Promise<string | null> {
    const renderer = this.ensureRenderer();
    if (!renderer) return null;
    const [characterId, skin] = key.split(':');
    const def = applySkin(getCharacter(characterId), skin || null);
    const view = new CharacterView(def);
    view.showAura = false;
    const state = createCharacterState('portrait', def.name, false, def, characterBowId(characterId), 0, 0, 0, 0);
    state.grounded = true;
    state.bodyYaw = -0.35; // um pouco de lado
    const start = performance.now();
    while (!view.model && performance.now() - start < LOAD_TIMEOUT) await new Promise((r) => setTimeout(r, 100));
    this.scene.add(view.root);
    try {
      // Algumas atualizações para a pose parada assentar.
      const origin = new THREE.Vector3();
      for (let i = 0; i < 20; i++) view.update(state, origin, 1 / 30);
      view.hideBow();
      view.root.updateMatrixWorld(true);
      // Centro da cabeça: encaixe da cabeça + metade da altura dela.
      const center = new THREE.Vector3();
      let headSize = 0.42;
      const rig = view.model;
      if (rig) {
        rig.sockets.head.getWorldPosition(center);
        headSize = 0.42 * rig.partScale;
        center.y += headSize * 0.5;
      } else {
        center.set(0, def.height * 0.9, 0);
      }
      // Frente do personagem = -Z.
      const dist = headSize * 3.6;
      this.camera.position.set(center.x, center.y + headSize * 0.1, center.z - dist);
      this.camera.lookAt(center);
      renderer.render(this.scene, this.camera);
      return renderer.domElement.toDataURL('image/png');
    } finally {
      this.scene.remove(view.root);
    }
  }
}
