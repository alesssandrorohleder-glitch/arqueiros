// Minas de choque do Cobalto (segunda habilidade): disco de metal no chão com uma
// luz que pisca depois de armada. Uma malha por mina (são no máximo 2 por Cobalto).
import * as THREE from 'three';
import type { MineState } from '../core/Simulation';
import { ABILITY2_TUNING } from '../data/abilities';

export class MinesView {
  private readonly meshes = new Map<number, { group: THREE.Group; light: THREE.MeshStandardMaterial }>();
  private readonly body = new THREE.MeshStandardMaterial({ color: 0x4a525a, metalness: 0.8, roughness: 0.35 });
  private readonly stripe = new THREE.MeshStandardMaterial({ color: 0xffb03a, roughness: 0.5 });
  private readonly bodyGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.1, 16);
  private readonly ringGeo = new THREE.TorusGeometry(0.3, 0.025, 6, 20).rotateX(Math.PI / 2);
  private readonly lightGeo = new THREE.SphereGeometry(0.07, 10, 8);
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {}

  update(mines: MineState[], dt: number): void {
    this.time += dt;
    const seen = new Set<number>();
    for (const m of mines) {
      seen.add(m.id);
      let v = this.meshes.get(m.id);
      if (!v) {
        const group = new THREE.Group();
        const light = new THREE.MeshStandardMaterial({ color: 0xff4a2a, emissive: 0xff4a2a, emissiveIntensity: 0.2 });
        group.add(new THREE.Mesh(this.bodyGeo, this.body));
        const ring = new THREE.Mesh(this.ringGeo, this.stripe);
        ring.position.y = 0.04;
        group.add(ring);
        const l = new THREE.Mesh(this.lightGeo, light);
        l.position.y = 0.07;
        group.add(l);
        group.traverse((o) => (o.castShadow = true));
        this.scene.add(group);
        v = { group, light };
        this.meshes.set(m.id, v);
      }
      v.group.position.set(m.position.x, m.position.y + 0.04, m.position.z);
      // Armada: pisca forte; ainda armando: brilho fraco.
      v.light.emissiveIntensity = m.age >= ABILITY2_TUNING.mineArm ? (Math.sin(this.time * 9) > 0 ? 3 : 0.4) : 0.2;
    }
    for (const [id, v] of this.meshes) {
      if (seen.has(id)) continue;
      this.scene.remove(v.group);
      v.light.dispose();
      this.meshes.delete(id);
    }
  }
}
