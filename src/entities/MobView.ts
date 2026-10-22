// Visual dos mobs: javali, lobo e golem feitos de formas simples, com
// animação de andar (patas), golpe, piscar ao levar dano e tombar ao morrer.
import * as THREE from 'three';
import { auraTexture } from './CharacterView';
import { clamp, damp } from '../core/math';
import { MOBS, type MobDef } from '../data/mobs';
import type { MobState } from './MobState';

interface Leg {
  pivot: THREE.Group;
  phase: number;
}

export class MobView {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legs: Leg[] = [];
  private readonly arms: THREE.Group[] = [];
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private readonly def: MobDef;
  private walk = 0;
  private flash = 0;
  private aura: THREE.Sprite | null = null;
  private death = 0;
  private visualY: number | null = null;

  constructor(m: MobState) {
    this.def = MOBS[m.typeId];
    this.root.add(this.body);
    this.body.add(this.head);
    if (this.def.shape === 'boar') this.buildBoar();
    else if (this.def.shape === 'wolf') this.buildWolf();
    else this.buildGolem();
    this.body.scale.setScalar(this.def.scale);
    // Mob especial: corpo em brasa (brilho laranja).
    // Pelo escuro + brilho forte: sob o sol o laranja continua saturado.
    if (this.def.glow !== undefined) {
      for (const mat of this.materials) {
        mat.color.multiplyScalar(0.25);
        mat.emissive.setHex(this.def.glow);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 1.1);
      }
      this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTexture(), color: this.def.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      this.aura.position.y = this.def.height * 0.6;
      this.aura.scale.setScalar(this.def.height * 2.4);
      this.body.add(this.aura);
    }
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).castShadow = true;
      }
    });
  }

  private mat(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    this.materials.push(m);
    return m;
  }

  private mesh(geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  private addLegs(m: THREE.Material, hipY: number, length: number, radius: number, xs: number, zFront: number, zBack: number): void {
    const spots: [number, number, number][] = [
      [-xs, zFront, 0],
      [xs, zFront, Math.PI],
      [-xs, zBack, Math.PI],
      [xs, zBack, 0],
    ];
    for (const [x, z, phase] of spots) {
      const pivot = new THREE.Group();
      pivot.position.set(x, hipY, z);
      this.mesh(new THREE.CylinderGeometry(radius, radius * 0.7, length, 8), m, 0, -length / 2, 0, pivot);
      this.body.add(pivot);
      this.legs.push({ pivot, phase });
    }
  }

  private buildBoar(): void {
    const hide = this.mat(0x5a3d2b, { roughness: 0.95 });
    const dark = this.mat(0x3a271b);
    const tusk = this.mat(0xeae0c8, { roughness: 0.4 });
    this.mesh(new THREE.SphereGeometry(1, 16, 12).scale(0.48, 0.42, 0.78), hide, 0, 0.68, 0.05, this.body);
    this.mesh(new THREE.SphereGeometry(1, 12, 8).scale(0.2, 0.12, 0.6), dark, 0, 1.05, 0, this.body); // crina
    this.head.position.set(0, 0.62, -0.7);
    this.mesh(new THREE.SphereGeometry(0.27, 14, 10).scale(1, 0.9, 1.15), hide, 0, 0, 0, this.head);
    this.mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.25, 12).rotateX(Math.PI / 2), dark, 0, -0.05, -0.3, this.head);
    for (const s of [-1, 1]) {
      const t = this.mesh(new THREE.ConeGeometry(0.035, 0.18, 6), tusk, s * 0.12, -0.07, -0.33, this.head);
      t.rotation.set(-0.3, 0, s * -0.5);
      const ear = this.mesh(new THREE.ConeGeometry(0.07, 0.15, 6), dark, s * 0.15, 0.22, 0.05, this.head);
      ear.rotation.z = s * -0.4;
      this.mesh(new THREE.SphereGeometry(0.03, 8, 6), this.mat(0x120a06, { roughness: 0.3 }), s * 0.13, 0.08, -0.2, this.head);
    }
    this.addLegs(dark, 0.45, 0.45, 0.08, 0.22, -0.4, 0.45);
  }

  private buildWolf(): void {
    const fur = this.mat(0x3a3d45, { roughness: 0.95 });
    const light = this.mat(0x6a6e78);
    const eye = this.mat(0xff6a20, { emissive: 0xff5a10, emissiveIntensity: 2 });
    this.mesh(new THREE.CapsuleGeometry(0.22, 0.75, 6, 12).rotateX(Math.PI / 2), fur, 0, 0.72, 0.05, this.body);
    this.mesh(new THREE.SphereGeometry(0.27, 12, 10), light, 0, 0.8, -0.38, this.body); // peito
    this.head.position.set(0, 0.95, -0.62);
    this.mesh(new THREE.SphereGeometry(0.19, 14, 10), fur, 0, 0, 0, this.head);
    this.mesh(new THREE.ConeGeometry(0.1, 0.32, 10).rotateX(-Math.PI / 2), fur, 0, -0.05, -0.25, this.head);
    for (const s of [-1, 1]) {
      this.mesh(new THREE.ConeGeometry(0.06, 0.16, 6), fur, s * 0.1, 0.19, 0.03, this.head);
      this.mesh(new THREE.SphereGeometry(0.028, 8, 6), eye, s * 0.08, 0.04, -0.15, this.head);
    }
    const tail = this.mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.55, 8), fur, 0, 0.82, 0.68, this.body);
    tail.rotation.x = 1.0;
    this.addLegs(fur, 0.55, 0.55, 0.06, 0.15, -0.38, 0.4);
  }

  private buildGolem(): void {
    const stone = this.mat(0x7d776d, { flatShading: true, roughness: 1 });
    const moss = this.mat(0x4f6b34, { flatShading: true, roughness: 1 });
    const core = this.mat(0xff8a2a, { emissive: 0xff6a10, emissiveIntensity: 2.5 });
    const torso = this.mesh(new THREE.DodecahedronGeometry(0.75, 0), stone, 0, 1.75, 0, this.body);
    torso.scale.set(1.15, 1.0, 0.85);
    this.mesh(new THREE.DodecahedronGeometry(0.4, 0), moss, 0.1, 2.35, 0.2, this.body); // musgo nas costas
    this.mesh(new THREE.OctahedronGeometry(0.14, 0), core, 0, 1.8, -0.6, this.body);
    this.head.position.set(0, 2.72, -0.05);
    this.mesh(new THREE.DodecahedronGeometry(0.34, 0), stone, 0, 0, 0, this.head);
    for (const s of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(0.08, 0.05, 0.02), core, s * 0.12, 0.02, -0.3, this.head);
      const arm = new THREE.Group();
      arm.position.set(s * 0.95, 2.1, 0);
      this.mesh(new THREE.DodecahedronGeometry(0.32, 0), stone, 0, -0.35, 0, arm);
      this.mesh(new THREE.DodecahedronGeometry(0.38, 0), stone, 0, -0.95, -0.05, arm); // punho
      this.body.add(arm);
      this.arms.push(arm);
    }
    // Pernas grossas (duas): usa o mesmo sistema com fase oposta.
    for (const [s, phase] of [[-1, 0], [1, Math.PI]] as const) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.42, 1.05, 0);
      this.mesh(new THREE.DodecahedronGeometry(0.34, 0), stone, 0, -0.55, 0, pivot);
      this.body.add(pivot);
      this.legs.push({ pivot, phase });
    }
  }

  hit(): void {
    this.flash = 1;
  }

  update(m: MobState, pos: THREE.Vector3, dt: number): void {
    // Suaviza degraus.
    if (this.visualY === null || Math.abs(pos.y - this.visualY) > 0.8) this.visualY = pos.y;
    else this.visualY = damp(this.visualY, pos.y, 20, dt);
    this.root.position.set(pos.x, this.visualY, pos.z);
    this.root.rotation.y = m.yaw;

    const speed = Math.hypot(m.velocity.x, m.velocity.z);
    const stride = this.def.shape === 'golem' ? 1.6 : 3.2;
    this.walk += dt * speed * stride;
    const amp = clamp(speed / 3, 0, 1) * (this.def.shape === 'golem' ? 0.5 : 0.7);
    for (const leg of this.legs) leg.pivot.rotation.x = Math.sin(this.walk + leg.phase) * amp;

    // Golpe: abaixa a cabeça e avança (quadrúpedes) ou ergue os braços (golem).
    const windup = m.mode === 'attack' ? clamp(1 - m.timer / this.def.attackWindup, 0, 1) : 0;
    if (this.def.shape === 'golem') {
      for (const arm of this.arms) arm.rotation.x = damp(arm.rotation.x, m.mode === 'attack' ? -2.6 * windup : Math.sin(this.walk) * 0.3, 12, dt);
    } else {
      this.head.rotation.x = damp(this.head.rotation.x, m.mode === 'attack' ? 0.5 * windup : 0, 14, dt);
      this.body.position.z = damp(this.body.position.z, m.mode === 'attack' ? -0.25 * windup : 0, 14, dt);
    }

    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.aura) {
      this.aura.material.opacity = m.mode === 'dead' ? 0 : 0.45 + 0.2 * Math.sin(performance.now() / 160);
    }
    for (const mat of this.materials) {
      if (mat.userData.baseEmissive === undefined) mat.userData.baseEmissive = mat.emissive.getHex();
      if (this.flash > 0) mat.emissive.setRGB(this.flash * 0.7, this.flash * 0.2, this.flash * 0.1);
      else if (m.slowTimer > 0) mat.emissive.setHex(0x2a6a9a); // congelado
      else mat.emissive.setHex(mat.userData.baseEmissive);
    }

    // Morte: tomba de lado e afunda no chão.
    this.death = m.mode === 'dead' ? damp(this.death, 1, 6, dt) : 0;
    this.body.rotation.z = this.death * 1.5;
    this.body.position.y = m.mode === 'dead' && m.timer < 1 ? -(1 - m.timer) * 0.8 : 0;
  }
}

/** Item no chão: arco girando com um feixe de luz na cor da raridade. */
export class LootView {
  readonly root = new THREE.Group();
  private readonly spinner = new THREE.Group();
  private time = Math.random() * 10;

  constructor(color: number) {
    const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.28, 7, 16, 1, true), glow);
    beam.position.y = 3.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.6, 32).rotateX(-Math.PI / 2), glow);
    ring.position.y = 0.05;
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a22, emissive: color, emissiveIntensity: 0.6, roughness: 0.5 });
    const limb = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 20, Math.PI * 0.8), wood);
    limb.rotation.z = Math.PI / 2 - Math.PI * 0.4;
    const chord = Math.sin(Math.PI * 0.4) * 0.45 * 2;
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, chord, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    str.position.x = Math.cos(Math.PI * 0.4) * 0.45;
    this.spinner.add(limb, str);
    this.spinner.position.y = 0.9;
    this.root.add(beam, ring, this.spinner);
  }

  update(dt: number): void {
    this.time += dt;
    this.spinner.rotation.y = this.time * 1.8;
    this.spinner.position.y = 0.9 + Math.sin(this.time * 2.4) * 0.12;
  }
}
