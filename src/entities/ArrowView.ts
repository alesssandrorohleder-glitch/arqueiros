// Desenha as flechas: haste + ponta + penas, orientadas pela velocidade, com
// rastro na cor da raridade do arco.
import * as THREE from 'three';
import { FRENZY } from '../data/combat';
import { RARITIES } from '../data/rarities';
import { merge, paint } from '../world/props';
import type { ArrowState } from './ArrowState';

/** Comprimento da flecha (m): maior que o real para ser bem visível no jogo. */
const LENGTH = 1.05;
const TRAIL_POINTS = 10;
const FORWARD = new THREE.Vector3(0, 0, -1);

function arrowGeometry(): THREE.BufferGeometry {
  // Ponta em z = 0 (onde a flecha crava), cauda em z = +LENGTH.
  return merge([
    paint(new THREE.CylinderGeometry(0.02, 0.02, LENGTH, 6).rotateX(Math.PI / 2).translate(0, 0, LENGTH / 2), 0xc9a36b),
    paint(new THREE.ConeGeometry(0.05, 0.15, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.04), 0x8d949b),
    paint(new THREE.BoxGeometry(0.008, 0.12, 0.22).translate(0, 0, LENGTH - 0.12), 0xe9e2d0),
    paint(new THREE.BoxGeometry(0.12, 0.008, 0.22).translate(0, 0, LENGTH - 0.12), 0xe9e2d0),
  ]);
}

interface ArrowVisual {
  mesh: THREE.Mesh;
  trail: THREE.Line;
  trailPositions: Float32Array;
  trailCount: number;
  seen: boolean;
}

export class ArrowRenderer {
  private readonly geo = arrowGeometry();
  private readonly mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 });
  private readonly visuals = new Map<number, ArrowVisual>();
  private readonly tmp = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene) {}

  /** `prev` = posições no tick anterior, para interpolar. */
  update(arrows: ArrowState[], prev: Map<number, { x: number; y: number; z: number }>, alpha: number): void {
    for (const v of this.visuals.values()) v.seen = false;

    for (const a of arrows) {
      let v = this.visuals.get(a.id);
      if (!v) v = this.create(a);
      v.seen = true;

      const p0 = prev.get(a.id) ?? a.position;
      if (a.stuck) this.tmp.set(a.position.x, a.position.y, a.position.z);
      else this.tmp.set(
        p0.x + (a.position.x - p0.x) * alpha,
        p0.y + (a.position.y - p0.y) * alpha,
        p0.z + (a.position.z - p0.z) * alpha,
      );
      v.mesh.position.copy(this.tmp);
      const d = a.stuck && a.stuckDir ? a.stuckDir : a.velocity;
      this.dir.set(d.x, d.y, d.z);
      if (this.dir.lengthSq() > 1e-8) v.mesh.quaternion.setFromUnitVectors(FORWARD, this.dir.normalize());

      // Rastro: guarda as últimas posições; some quando a flecha crava.
      if (a.stuck) {
        v.trailCount = Math.max(0, v.trailCount - 2);
      } else {
        v.trailPositions.copyWithin(3, 0, (TRAIL_POINTS - 1) * 3);
        v.trailPositions[0] = this.tmp.x;
        v.trailPositions[1] = this.tmp.y;
        v.trailPositions[2] = this.tmp.z;
        v.trailCount = Math.min(TRAIL_POINTS, v.trailCount + 1);
      }
      v.trail.geometry.setDrawRange(0, v.trailCount);
      v.trail.geometry.attributes.position.needsUpdate = true;
      v.trail.visible = v.trailCount > 1;
    }

    for (const [id, v] of this.visuals) {
      if (v.seen) continue;
      this.scene.remove(v.mesh, v.trail);
      v.trail.geometry.dispose();
      (v.trail.material as THREE.Material).dispose();
      this.visuals.delete(id);
    }
  }

  private create(a: ArrowState): ArrowVisual {
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true;
    const trailPositions = new Float32Array(TRAIL_POINTS * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const special = a.effect !== null || a.trail !== 'normal';
    const trail = new THREE.Line(g, new THREE.LineBasicMaterial({
      color: a.effect === 'frost' ? 0x9fe8ff : a.effect === 'explosive' ? 0xffa040 : a.trail === 'magic' ? 0xc49bff : a.trail === 'frenzy' ? FRENZY.color : RARITIES[a.rarity].color,
      transparent: true,
      opacity: special ? 0.9 : 0.55,
      blending: special ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    trail.frustumCulled = false;
    this.scene.add(mesh, trail);
    const v: ArrowVisual = { mesh, trail, trailPositions, trailCount: 0, seen: true };
    this.visuals.set(a.id, v);
    return v;
  }
}
