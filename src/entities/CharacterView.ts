// Visual de um personagem: modelo geométrico estilizado + animação procedural.
// Só lê o CharacterState; nunca o altera. Para trocar por um modelo .glb no
// futuro, basta outra classe com o mesmo método `update`.
import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/math';
import type { CharacterDef } from '../data/characters';
import { drawCharge } from '../systems/bow';
import type { CharacterState } from './CharacterState';

/** Altura de referência do modelo; é escalado para `def.height`. */
const MODEL_HEIGHT = 1.8;
const BOW_TIP_Y = 0.58;
const ARROW_LENGTH = 0.75;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

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
  private bow: THREE.Group;
  private readonly stringTop = new THREE.Mesh();
  private readonly stringBottom = new THREE.Mesh();
  private readonly nockedArrow = new THREE.Group();
  private drawBlend = 0;
  private pull = 0;
  private readonly restQuat = new THREE.Quaternion();
  private readonly aimQuat = new THREE.Quaternion();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpEuler = new THREE.Euler();

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

    // Arco na mão esquerda (ver buildBow).
    this.bow = this.buildBow(mat);
    this.bow.position.set(0, -0.56, 0);
    this.armL.add(this.bow);

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  /**
   * Arco no "espaço do arco": +Y para cima, -Z para onde a flecha vai,
   * corda do lado +Z. Pontas em y = ±0,58.
   */
  private buildBow(mat: (color: number) => THREE.MeshStandardMaterial): THREE.Group {
    const group = new THREE.Group();
    const wood = mat(0x7a4a22);
    const limbCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, BOW_TIP_Y, 0.06),
      new THREE.Vector3(0, 0, -0.3),
      new THREE.Vector3(0, -BOW_TIP_Y, 0.06),
    );
    const limb = new THREE.Mesh(new THREE.TubeGeometry(limbCurve, 12, 0.022, 5), wood);
    limb.castShadow = true;
    group.add(limb);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), mat(0x3a2a1e));
    grip.position.set(0, 0, -0.12);
    group.add(grip);

    const stringMat = mat(0xf2efe6);
    const stringGeo = new THREE.CylinderGeometry(0.004, 0.004, 1, 3);
    this.stringTop.geometry = stringGeo;
    this.stringTop.material = stringMat;
    this.stringBottom.geometry = stringGeo;
    this.stringBottom.material = stringMat;
    group.add(this.stringTop, this.stringBottom);

    // Flecha encaixada na corda (aparece enquanto puxa).
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, ARROW_LENGTH, 4), mat(0xc9a36b));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -ARROW_LENGTH / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 4), mat(0x9aa0a6));
    head.rotation.x = -Math.PI / 2;
    head.position.z = -ARROW_LENGTH - 0.03;
    const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.1), mat(0xe9e2d0));
    fletch.position.z = -0.08;
    this.nockedArrow.add(shaft, head, fletch);
    this.nockedArrow.visible = false;
    group.add(this.nockedArrow);
    return group;
  }

  /** Estica a corda até o ponto de encaixe (z = nock). */
  private updateString(nockZ: number): void {
    const place = (mesh: THREE.Mesh, tipY: number) => {
      const a = new THREE.Vector3(0, tipY, 0.06);
      const b = new THREE.Vector3(0, 0, nockZ);
      const d = b.clone().sub(a);
      mesh.position.copy(a).addScaledVector(d, 0.5);
      mesh.scale.set(1, d.length(), 1);
      mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    };
    place(this.stringTop, BOW_TIP_Y);
    place(this.stringBottom, -BOW_TIP_Y);
    this.nockedArrow.position.z = nockZ;
  }

  /** Aponta um braço (pivô no ombro, pendurado em -Y) na direção `dir` do tronco. */
  private pointArm(arm: THREE.Group, rest: THREE.Euler, dir: THREE.Vector3, blend: number): void {
    this.restQuat.setFromEuler(rest);
    this.aimQuat.setFromUnitVectors(DOWN, dir.normalize());
    arm.quaternion.copy(this.restQuat).slerp(this.aimQuat, blend);
  }

  /** Atualiza posição e animação. `pos` já vem interpolada entre ticks. */
  update(s: CharacterState, pos: THREE.Vector3, dt: number): void {
    const charge = drawCharge(s);
    this.drawBlend = damp(this.drawBlend, s.bow.drawing ? 1 : 0, s.bow.drawing ? 14 : 8, dt);
    // A corda volta rápido ao soltar.
    this.pull = s.bow.drawing ? damp(this.pull, charge, 20, dt) : damp(this.pull, 0, 30, dt);
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
    // Braços: pose de caminhada misturada com a pose de mira.
    const pitch = clamp(s.aimPitch, -1, 1);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const rotPitch = (v: THREE.Vector3) => v.set(v.x, v.y * cp - v.z * sp, v.y * sp + v.z * cp);
    // Esquerdo: estica para frente, na direção da mira.
    this.tmpEuler.set(lerp(swing * 0.5 + 0.15, 0.3, this.airBlend), 0, 0.08);
    this.pointArm(this.armL, this.tmpEuler, rotPitch(this.tmpDir.set(0.08, 0, -1)), this.drawBlend);
    // Direito: vai da corda (perto do arco) até a ancoragem no queixo.
    this.tmpEuler.set(lerp(-swing * 0.8, -0.6, this.airBlend), 0, -0.08);
    this.tmpDir.set(lerp(-0.75, -0.85, this.pull), lerp(0, 0.35, this.pull), lerp(-0.75, -0.2, this.pull));
    this.pointArm(this.armR, this.tmpEuler, rotPitch(this.tmpDir), this.drawBlend);
    // Arco de pé quando relaxado; deitado no eixo do braço quando mirando.
    this.bow.rotation.x = -Math.PI / 2 * this.drawBlend;
    this.updateString(0.06 + this.pull * 0.5);
    this.nockedArrow.visible = s.bow.drawing;

    const bob = Math.abs(Math.cos(this.phase)) * 0.06 * this.stride * (1 - this.airBlend);
    const breath = Math.sin(this.time * 2.2) * 0.008;
    this.hips.position.y = 0.92 + bob;
    this.torso.rotation.x = (-0.25 * this.lean - 0.05 * this.stride) * (1 - this.drawBlend);
    this.torso.position.y = 0.02 + breath;
    // A cabeça segue a mira vertical.
    this.head.rotation.x = clamp(s.aimPitch * 0.5, -0.4, 0.35) + 0.25 * this.lean;
  }
}
