// Desenha as flechas: haste + ponta + penas, orientadas pela velocidade, com
// rastro de luz e brilho na ponta, na cor da raridade do arco.
import * as THREE from 'three';
import { FRENZY } from '../data/combat';
import { RARITIES, RARITY_ORDER } from '../data/rarities';
import { merge, paint } from '../world/props';
import type { ArrowState } from './ArrowState';

/** Comprimento da flecha (m): maior que o real para ser bem visível no jogo. */
const LENGTH = 1.05;
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

/** Largura do rastro por raridade (comum → lendário), em metros. */
const TRAIL_WIDTH = [0.07, 0.09, 0.12, 0.16, 0.22];
/** Comprimento máximo do rastro (m) e quantos pontos guarda. */
const TRAIL_LENGTH = 16;
const TRAIL_POINTS = 14;

interface ArrowVisual {
  mesh: THREE.Mesh;
  /** Faixa de luz atrás da flecha (sempre virada para a câmera). */
  ribbon: THREE.Mesh;
  ribbonPos: Float32Array;
  ribbonCol: Float32Array;
  history: THREE.Vector3[];
  color: THREE.Color;
  width: number;
  glow: THREE.Sprite;
  seen: boolean;
}

let glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export class ArrowRenderer {
  private readonly geo = arrowGeometry();
  private readonly mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 });
  private readonly ribbonMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  private readonly visuals = new Map<number, ArrowVisual>();
  private readonly tmp = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly toCam = new THREE.Vector3();
  /** Câmera (o rastro é desenhado de frente para ela). */
  camera: THREE.Camera | null = null;

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

      // Rastro: guarda as últimas posições; encolhe depressa quando a flecha crava.
      if (a.stuck) v.history.splice(Math.max(1, v.history.length - 3));
      else {
        v.history.unshift(this.tmp.clone());
        if (v.history.length > TRAIL_POINTS) v.history.pop();
      }
      this.buildRibbon(v);
      // Brilho na ponta (some ao cravar).
      v.glow.position.copy(this.tmp);
      v.glow.visible = !a.stuck;
    }

    for (const [id, v] of this.visuals) {
      if (v.seen) continue;
      this.scene.remove(v.mesh, v.ribbon, v.glow);
      v.ribbon.geometry.dispose();
      v.glow.material.dispose();
      this.visuals.delete(id);
    }
  }

  /** Faixa larga na frente, afinando e apagando até a cauda. */
  private buildRibbon(v: ArrowVisual): void {
    const h = v.history;
    const pos = v.ribbonPos;
    const col = v.ribbonCol;
    let length = 0;
    let used = 0;
    const cam = this.camera?.position;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const p = h[Math.min(i, h.length - 1)];
      if (i > 0 && i < h.length) length += p.distanceTo(h[i - 1]);
      const t = h.length > 1 ? Math.min(1, length / TRAIL_LENGTH) : 1;
      const live = i < h.length && length <= TRAIL_LENGTH;
      if (live) used = i + 1;
      // Direção do segmento e lado perpendicular à visão.
      const a = h[Math.max(0, Math.min(i, h.length - 2))];
      const b = h[Math.min(h.length - 1, Math.max(1, i + 1))];
      this.dir.subVectors(a, b);
      if (this.dir.lengthSq() < 1e-8) this.dir.set(0, 0, 1);
      if (cam) this.toCam.subVectors(cam, p);
      else this.toCam.set(0, 1, 0);
      this.side.crossVectors(this.dir, this.toCam).normalize().multiplyScalar(v.width * (1 - t * 0.85) * 0.5);
      pos.set([p.x + this.side.x, p.y + this.side.y, p.z + this.side.z, p.x - this.side.x, p.y - this.side.y, p.z - this.side.z], i * 6);
      const k = live ? (1 - t) * (1 - t) : 0;
      col.set([v.color.r * k, v.color.g * k, v.color.b * k, v.color.r * k, v.color.g * k, v.color.b * k], i * 6);
    }
    const g = v.ribbon.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.setDrawRange(0, Math.max(0, used - 1) * 6);
    v.ribbon.visible = used > 1;
  }

  private create(a: ArrowState): ArrowVisual {
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true;
    const rank = RARITY_ORDER.indexOf(a.rarity);
    const special = a.effect !== null || a.trail !== 'normal';
    const color = new THREE.Color(
      a.effect === 'frost' ? 0x9fe8ff : a.effect === 'explosive' ? 0xffa040 : a.trail === 'magic' ? 0xc49bff : a.trail === 'frenzy' ? FRENZY.color : RARITIES[a.rarity].color,
    );
    // Comum: rastro esbranquiçado discreto; quanto mais raro, mais forte a cor.
    if (rank === 0 && !special) color.lerp(new THREE.Color(0xfff4dc), 0.5).multiplyScalar(0.6);
    const ribbonPos = new Float32Array(TRAIL_POINTS * 6);
    const ribbonCol = new Float32Array(TRAIL_POINTS * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(ribbonPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(ribbonCol, 3));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL_POINTS - 1; i++) {
      const o = i * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
    g.setIndex(idx);
    const ribbon = new THREE.Mesh(g, this.ribbonMat);
    ribbon.frustumCulled = false;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    glow.scale.setScalar(0.35 + rank * 0.12 + (special ? 0.15 : 0));
    this.scene.add(mesh, ribbon, glow);
    const v: ArrowVisual = { mesh, ribbon, ribbonPos, ribbonCol, history: [], color, width: TRAIL_WIDTH[rank] + (special ? 0.04 : 0), glow, seen: true };
    this.visuals.set(a.id, v);
    return v;
  }
}
