// Lápides: quando um personagem é eliminado, uma lápide de pedra com o nome
// dele sobe do chão no lugar da morte e fica um tempo antes de afundar.
import * as THREE from 'three';
import { merge, paint } from '../world/props';

/** Quanto tempo a lápide fica (s) e quantas no máximo ao mesmo tempo. */
const LIFETIME = 40;
const MAX = 12;
const RISE = 0.6;

interface Stone {
  root: THREE.Group;
  label: THREE.Mesh;
  age: number;
}

function stoneGeometry(): THREE.BufferGeometry {
  const stone = 0x8d8a84;
  return merge([
    // Placa com topo arredondado.
    paint(new THREE.BoxGeometry(0.62, 0.7, 0.16).translate(0, 0.35, 0), stone),
    paint(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.7, 0), stone),
    // Cruz em relevo na frente (frente = -Z).
    paint(new THREE.BoxGeometry(0.07, 0.3, 0.03).translate(0, 0.78, -0.09), 0x6f6c66),
    paint(new THREE.BoxGeometry(0.2, 0.06, 0.03).translate(0, 0.84, -0.09), 0x6f6c66),
    // Base e montinho de terra.
    paint(new THREE.BoxGeometry(0.78, 0.12, 0.3).translate(0, 0.02, 0), 0x77736c),
    paint(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.25, 1.6).translate(0, -0.02, -0.75), 0x5a4632),
  ], true);
}

function nameTexture(name: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(40,36,30,0.9)';
  g.font = 'bold 34px "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name.slice(0, 14), 128, 34, 240);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Tombstones {
  private readonly geo = stoneGeometry();
  private readonly mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  private readonly stones: Stone[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  /** `yaw`: para onde a lápide olha (geralmente para quem eliminou). */
  add(p: { x: number; y: number; z: number }, yaw: number, name: string): void {
    if (this.stones.length >= MAX) this.remove(0);
    const root = new THREE.Group();
    root.position.set(p.x, p.y, p.z);
    root.rotation.y = yaw;
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.rotation.x = (Math.random() - 0.5) * 0.12; // levemente torta
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.14),
      new THREE.MeshStandardMaterial({ map: nameTexture(name), transparent: true, roughness: 1 }),
    );
    label.position.set(0, 0.42, -0.082);
    label.rotation.y = Math.PI;
    mesh.add(label);
    root.add(mesh);
    root.scale.setScalar(1.25);
    this.scene.add(root);
    this.stones.push({ root, label, age: 0 });
  }

  update(dt: number): void {
    for (let i = this.stones.length - 1; i >= 0; i--) {
      const s = this.stones[i];
      s.age += dt;
      // Sobe do chão no começo e afunda no último segundo e meio.
      const rise = Math.min(1, s.age / RISE);
      const sink = Math.max(0, (s.age - (LIFETIME - 1.5)) / 1.5);
      s.root.children[0].position.y = -1.2 * (1 - rise * (2 - rise)) - 1.2 * sink;
      if (s.age >= LIFETIME) this.remove(i);
    }
  }

  clear(): void {
    while (this.stones.length) this.remove(0);
  }

  private remove(i: number): void {
    const s = this.stones[i];
    this.scene.remove(s.root);
    const m = s.label.material as THREE.MeshStandardMaterial;
    m.map?.dispose();
    m.dispose();
    s.label.geometry.dispose();
    this.stones.splice(i, 1);
  }
}
