// Visual de um personagem: modelo geométrico estilizado + animação procedural.
// Só lê o CharacterState; nunca o altera. Para trocar por um modelo .glb no
// futuro, basta outra classe com o mesmo método `update`.
import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/math';
import type { CharacterDef } from '../data/characters';
import type { CharacterState } from './CharacterState';

/** Altura de referência do modelo; é escalado para `def.height`. */
const MODEL_HEIGHT = 1.8;

export class CharacterView {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private phase = 0;
  private stride = 0;
  private airBlend = 0;
  private visualY = 0;
  private lean = 0;
  private time = 0;

  constructor(def: CharacterDef) {
    const pal = def.palette;
    const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });
    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      return mesh;
    };

    const primary = mat(pal.primary);
    const secondary = mat(pal.secondary);
    const skin = mat(pal.skin);
    const accent = mat(pal.accent);
    const boots = mat(0x3a2a1e);
    const eyes = mat(pal.eyes, { emissive: def.style === 'robot' ? pal.eyes : 0x000000, emissiveIntensity: 1.5 });

    this.root.add(this.body);
    this.body.scale.setScalar(def.height / MODEL_HEIGHT);

    // Quadril (pivô das pernas e do tronco).
    this.hips.position.y = 0.92;
    this.body.add(this.hips);

    for (const [leg, x] of [[this.legL, -0.12], [this.legR, 0.12]] as const) {
      leg.position.set(x, 0, 0);
      leg.add(box(0.19, 0.62, 0.22, secondary, 0, -0.31, 0));
      leg.add(box(0.21, 0.32, 0.27, boots, 0, -0.76, -0.03));
      this.hips.add(leg);
    }

    this.torso.position.y = 0.02;
    this.hips.add(this.torso);
    this.torso.add(box(0.5, 0.58, 0.28, primary, 0, 0.29, 0));
    this.torso.add(box(0.52, 0.08, 0.3, accent, 0, 0.04, 0)); // cinto
    // Aljava nas costas, com penas das flechas.
    const quiver = new THREE.Group();
    quiver.position.set(0.12, 0.38, 0.2);
    quiver.rotation.z = -0.35;
    quiver.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.55, 6), accent));
    for (let i = 0; i < 3; i++) {
      quiver.add(box(0.03, 0.12, 0.06, mat(0xe9e2d0), -0.03 + i * 0.03, 0.34, 0));
    }
    quiver.traverse((o) => (o.castShadow = true));
    this.torso.add(quiver);

    // Cabeça com capuz.
    this.head.position.y = 0.62;
    this.torso.add(this.head);
    this.head.add(box(0.28, 0.3, 0.28, skin, 0, 0.17, 0));
    this.head.add(box(0.33, 0.2, 0.33, primary, 0, 0.3, 0.02)); // topo do capuz
    this.head.add(box(0.33, 0.3, 0.08, primary, 0, 0.17, 0.14)); // nuca do capuz
    this.head.add(box(0.05, 0.05, 0.02, eyes, -0.07, 0.19, -0.145));
    this.head.add(box(0.05, 0.05, 0.02, eyes, 0.07, 0.19, -0.145));

    // Braços (pivô no ombro).
    for (const [arm, x] of [[this.armL, -0.32], [this.armR, 0.32]] as const) {
      arm.position.set(x, 0.52, 0);
      arm.add(box(0.13, 0.32, 0.14, primary, 0, -0.16, 0));
      arm.add(box(0.12, 0.28, 0.13, skin, 0, -0.44, 0));
      this.torso.add(arm);
    }

    // Arco na mão esquerda.
    const bow = new THREE.Group();
    const limb = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 4, 14, Math.PI * 0.8), mat(0x7a4a22));
    limb.rotation.z = Math.PI / 2 - Math.PI * 0.4;
    limb.castShadow = true;
    bow.add(limb);
    const chord = Math.sin(Math.PI * 0.4) * 0.55 * 2;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, chord, 3), mat(0xeeeeee));
    string.position.x = Math.cos(Math.PI * 0.4) * 0.55;
    bow.add(string);
    // Arco de pé, com a corda virada para o corpo.
    bow.rotation.set(0, Math.PI / 2, 0);
    bow.position.set(0, -0.56, -0.12);
    this.armL.add(bow);

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  /** Atualiza posição e animação. `pos` já vem interpolada entre ticks. */
  update(s: CharacterState, pos: THREE.Vector3, dt: number): void {
    this.time += dt;
    // Suaviza degraus para cima (a física sobe na hora; o visual acompanha).
    if (pos.y > this.visualY && pos.y - this.visualY < 0.6) this.visualY = damp(this.visualY, pos.y, 25, dt);
    else this.visualY = pos.y;
    this.root.position.set(pos.x, this.visualY, pos.z);
    this.root.rotation.y = s.bodyYaw;

    const hSpeed = Math.hypot(s.velocity.x, s.velocity.z);
    // Velocidade relativa ao corpo: decide se as pernas andam para frente ou para trás.
    const fwd = -Math.sin(s.bodyYaw) * s.velocity.x - Math.cos(s.bodyYaw) * s.velocity.z;
    const dir = fwd < -0.3 ? -1 : 1;
    this.phase += dt * hSpeed * 1.7 * dir;
    this.stride = damp(this.stride, clamp(hSpeed / 8, 0, 1), 10, dt);
    this.airBlend = damp(this.airBlend, s.grounded ? 0 : 1, 12, dt);
    this.lean = damp(this.lean, s.moveState === 'run' ? 1 : 0, 6, dt);

    const swing = Math.sin(this.phase) * lerp(0.25, 0.85, this.stride) * Math.min(1, hSpeed / 1.5);
    const groundLegL = swing;
    const groundLegR = -swing;
    this.legL.rotation.x = lerp(groundLegL, 0.7, this.airBlend);
    this.legR.rotation.x = lerp(groundLegR, -0.25, this.airBlend);
    this.armR.rotation.x = lerp(-swing * 0.8, -0.6, this.airBlend);
    // Braço do arco balança menos e fica um pouco à frente.
    this.armL.rotation.x = lerp(swing * 0.5 + 0.15, 0.3, this.airBlend);
    this.armL.rotation.z = 0.08;
    this.armR.rotation.z = -0.08;

    const bob = Math.abs(Math.cos(this.phase)) * 0.06 * this.stride * (1 - this.airBlend);
    const breath = Math.sin(this.time * 2.2) * 0.008;
    this.hips.position.y = 0.92 + bob;
    this.torso.rotation.x = -0.25 * this.lean - 0.05 * this.stride;
    this.torso.position.y = 0.02 + breath;
    // A cabeça segue a mira vertical.
    this.head.rotation.x = clamp(s.aimPitch * 0.5, -0.4, 0.35) + 0.25 * this.lean;
  }
}
