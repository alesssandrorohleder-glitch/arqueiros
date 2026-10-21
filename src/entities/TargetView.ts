// Boneco de treino de palha num poste, com alvo pintado no peito.
// Pisca ao ser atingido e tomba quando a vida acaba.
import * as THREE from 'three';
import { damp } from '../core/math';
import { DUMMY_HITBOX, type TargetState } from './TargetState';

export class TargetView {
  readonly root = new THREE.Group();
  private readonly tilt = new THREE.Group();
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private flash = 0;
  private fall = 0;

  constructor(t: TargetState) {
    const H = DUMMY_HITBOX;
    const mat = (color: number) => {
      const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
      this.materials.push(m);
      return m;
    };
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.tilt) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const wood = mat(0x6e4b2c);
    const straw = mat(0xd9b65f);
    const sack = mat(0xc9a77a);

    // Base fica parada; o resto tomba a partir dela.
    add(new THREE.CylinderGeometry(0.35, 0.42, 0.18, 7), wood, 0, 0.09, 0, this.root);
    this.root.add(this.tilt);
    add(new THREE.CylinderGeometry(0.06, 0.06, H.bodyBottom + 0.1, 5), wood, 0, (H.bodyBottom + 0.1) / 2, 0);
    const bodyH = H.bodyTop - H.bodyBottom;
    add(new THREE.CylinderGeometry(H.bodyRadius * 0.92, H.bodyRadius, bodyH, 8), straw, 0, H.bodyBottom + bodyH / 2, 0);
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5).rotateZ(Math.PI / 2), wood, 0, H.bodyTop - 0.2, 0);
    add(new THREE.IcosahedronGeometry(H.headRadius, 1), sack, 0, H.headY, 0);
    // Alvo pintado no peito (anéis vermelho/branco), virado para -Z.
    const rings: [number, number][] = [[0.22, 0xf2ece0], [0.16, 0xc8352b], [0.1, 0xf2ece0], [0.045, 0xc8352b]];
    rings.forEach(([r, c], i) => {
      const disc = add(new THREE.CircleGeometry(r, 16), mat(c), 0, H.bodyBottom + bodyH * 0.55, -H.bodyRadius - 0.005 - i * 0.002);
      disc.rotation.y = Math.PI;
      disc.castShadow = false;
    });

    this.root.position.set(t.position.x, t.position.y, t.position.z);
    this.root.rotation.y = t.yaw;
  }

  hit(): void {
    this.flash = 1;
  }

  update(t: TargetState, dt: number): void {
    this.flash = Math.max(0, this.flash - dt * 6);
    for (const m of this.materials) m.emissive.setRGB(this.flash * 0.6, this.flash * 0.35, this.flash * 0.2);
    // Tomba para trás quando derrubado; levanta ao voltar.
    this.fall = damp(this.fall, t.respawnTimer > 0 ? 1 : 0, t.respawnTimer > 0 ? 7 : 4, dt);
    this.tilt.rotation.x = this.fall * 1.45;
  }
}
