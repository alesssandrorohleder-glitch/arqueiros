// Lobo detalhado: pelo com textura (gerada), corpo que flexiona, juba, cabeça com
// mandíbula, pernas com joelho e cauda peluda em segmentos. A animação é toda
// procedural (trote, respiração, cauda com atraso, orelhas, bote ao atacar).
import * as THREE from 'three';
import { clamp, damp } from '../core/math';

interface WolfLeg {
  hip: THREE.Group;
  knee: THREE.Group;
  phase: number;
  front: boolean;
}

/** Textura de pelo: fios curtos claros/escuros sobre a cor base (cor + relevo). */
function furTextures(base: THREE.Color): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 256;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  };
  const colorCanvas = make();
  const bumpCanvas = make();
  const cg = colorCanvas.getContext('2d')!;
  const bg = bumpCanvas.getContext('2d')!;
  cg.fillStyle = `#${base.getHexString()}`;
  cg.fillRect(0, 0, size, size);
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, size, size);
  // Fios: traços curtos quase verticais (o V da textura segue o comprimento do corpo).
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 5 + Math.random() * 10;
    const ang = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const k = 0.6 + Math.random() * 0.9;
    const c = base.clone().multiplyScalar(k);
    cg.strokeStyle = `rgba(${Math.min(255, c.r * 255) | 0},${Math.min(255, c.g * 255) | 0},${Math.min(255, c.b * 255) | 0},0.55)`;
    const v = (k * 110) | 0;
    bg.strokeStyle = `rgba(${v},${v},${v},0.5)`;
    for (const [g, w] of [[cg, 1.2], [bg, 1.4]] as const) {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.stroke();
    }
  }
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(bumpCanvas);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
  }
  return { map, bump };
}

const texCache = new Map<number, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();

export class WolfModel {
  readonly root = new THREE.Group();
  readonly head = new THREE.Group();
  private readonly chest = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly neck = new THREE.Group();
  private readonly jaw = new THREE.Group();
  private readonly ears: THREE.Group[] = [];
  private readonly tail: THREE.Group[] = [];
  private readonly legs: WolfLeg[] = [];
  private gait = 0;
  private time = Math.random() * 10;
  private move = 0;
  private earTimer = 0;
  private earTwitch = 0;
  private tailSwing = 0;

  /** `mat` registra o material no MobView (para piscar ao levar dano etc.). */
  constructor(mat: (color: number, extra?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial, furColor = 0x4a4d55, bellyColor = 0x8a8c92) {
    const key = furColor;
    let tex = texCache.get(key);
    if (!tex) {
      tex = furTextures(new THREE.Color(furColor));
      texCache.set(key, tex);
    }
    const bellyTex = texCache.get(bellyColor) ?? furTextures(new THREE.Color(bellyColor));
    texCache.set(bellyColor, bellyTex);
    const fur = mat(0xffffff, { map: tex.map, bumpMap: tex.bump, bumpScale: 1.5, roughness: 1 });
    const belly = mat(0xffffff, { map: bellyTex.map, bumpMap: bellyTex.bump, bumpScale: 1.5, roughness: 1 });
    const dark = mat(0x16161a, { roughness: 0.5 });
    const eye = mat(0xffb030, { emissive: 0xff8a10, emissiveIntensity: 2.2, roughness: 0.2 });
    const pink = mat(0x8a4a50, { roughness: 0.8 });
    const teeth = mat(0xf2ecd8, { roughness: 0.4 });

    const add = (geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const ellipsoid = (r: number, sx: number, sy: number, sz: number) => new THREE.SphereGeometry(r, 18, 14).scale(sx, sy, sz);
    /** Tufo de pelo: cone apontando em `dir`. */
    const tuft = (parent: THREE.Object3D, m: THREE.Material, at: THREE.Vector3, dir: THREE.Vector3, r: number, len: number) => {
      const t = add(new THREE.ConeGeometry(r, len, 5).translate(0, len / 2, 0), m, parent, at.x, at.y, at.z);
      t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return t;
    };

    // --- Corpo em duas partes (peito e quadril), que flexionam ao correr ---
    this.chest.position.set(0, 0.78, -0.22);
    this.hips.position.set(0, 0.76, 0.32);
    this.root.add(this.chest, this.hips);
    add(ellipsoid(0.3, 0.85, 1.0, 1.25), fur, this.chest);
    add(ellipsoid(0.24, 0.9, 0.75, 1.0), belly, this.chest, 0, -0.1, -0.08); // peito claro
    add(ellipsoid(0.24, 0.85, 0.9, 1.15), fur, this.hips);
    add(new THREE.CapsuleGeometry(0.2, 0.25, 6, 12).rotateX(Math.PI / 2), fur, this.root, 0, 0.75, 0.06); // cintura
    // Juba: tufos em volta do pescoço e crista nas costas.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const at = new THREE.Vector3(Math.cos(a) * 0.24, 0.1 + Math.sin(a) * 0.22, -0.18);
      if (at.y < -0.05) continue;
      tuft(this.chest, fur, at, new THREE.Vector3(Math.cos(a) * 0.5, Math.sin(a) * 0.4 + 0.1, 1), 0.09, 0.15);
    }
    // Pelo mais longo no alto das costas (bem baixo, só para quebrar a silhueta).
    for (let i = 0; i < 5; i++) {
      tuft(this.chest, fur, new THREE.Vector3(0, 0.24, -0.08 + i * 0.08), new THREE.Vector3(0, 0.35, 1), 0.07, 0.1);
    }

    // --- Pescoço e cabeça ---
    this.neck.position.set(0, 0.12, -0.3);
    this.neck.rotation.x = -0.35;
    this.chest.add(this.neck);
    add(new THREE.CapsuleGeometry(0.13, 0.16, 6, 10).rotateX(Math.PI / 2 - 0.5), fur, this.neck, 0, 0.04, -0.06);
    this.head.position.set(0, 0.1, -0.2);
    this.neck.add(this.head);
    add(ellipsoid(0.16, 1.0, 0.92, 1.1), fur, this.head);
    // Focinho (afinando para a frente) e nariz.
    const snout = add(new THREE.CylinderGeometry(0.055, 0.1, 0.24, 10).rotateX(-Math.PI / 2), fur, this.head, 0, -0.04, -0.2);
    snout.scale.set(1, 0.8, 1);
    add(ellipsoid(0.035, 1.2, 0.8, 1), dark, this.head, 0, -0.01, -0.33);
    // Bochechas peludas.
    for (const s of [-1, 1]) tuft(this.head, fur, new THREE.Vector3(s * 0.12, -0.06, 0.02), new THREE.Vector3(s, -0.3, 0.6), 0.05, 0.14);
    // Mandíbula (abre no bote) com dentinhos.
    this.jaw.position.set(0, -0.08, -0.06);
    this.head.add(this.jaw);
    add(new THREE.CylinderGeometry(0.035, 0.07, 0.2, 8).rotateX(-Math.PI / 2), belly, this.jaw, 0, -0.01, -0.13);
    for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.012, 0.04, 4).rotateX(Math.PI), teeth, this.jaw, s * 0.03, 0.025, -0.2);
    add(new THREE.BoxGeometry(0.06, 0.01, 0.12), pink, this.jaw, 0, 0.012, -0.12); // língua
    // Olhos brilhando e orelhas.
    for (const s of [-1, 1]) {
      add(ellipsoid(0.026, 1.2, 0.8, 0.6), eye, this.head, s * 0.075, 0.04, -0.13);
      const ear = new THREE.Group();
      ear.position.set(s * 0.085, 0.13, 0.02);
      ear.rotation.z = -s * 0.25;
      this.head.add(ear);
      add(new THREE.ConeGeometry(0.055, 0.15, 4).translate(0, 0.075, 0), fur, ear);
      add(new THREE.ConeGeometry(0.03, 0.09, 4).translate(0, 0.05, -0.02), pink, ear);
      this.ears.push(ear);
    }

    // --- Pernas: coxa + canela (joelho) + pata ---
    const legDef: [number, number, boolean, number][] = [
      [-0.15, -0.3, true, 0], [0.15, -0.3, true, Math.PI],
      [-0.14, 0.38, false, Math.PI], [0.14, 0.38, false, 0],
    ];
    for (const [x, z, front, phase] of legDef) {
      const hip = new THREE.Group();
      hip.position.set(x, 0.72, z);
      this.root.add(hip);
      // Coxa grossa (traseira mais musculosa), afinando para o joelho.
      add(new THREE.CylinderGeometry(front ? 0.1 : 0.13, front ? 0.06 : 0.07, 0.34, 10).translate(0, -0.13, 0), fur, hip);
      const knee = new THREE.Group();
      knee.position.set(0, -0.34, front ? 0 : 0.04);
      hip.add(knee);
      add(new THREE.CylinderGeometry(0.055, 0.04, 0.3, 8).translate(0, -0.15, 0), fur, knee);
      add(ellipsoid(0.055, 1, 0.55, 1.4), dark, knee, 0, -0.33, -0.03); // pata
      this.legs.push({ hip, knee, phase, front });
    }

    // --- Cauda: 4 segmentos peludos que balançam com atraso ---
    let parent: THREE.Object3D = this.hips;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 0.12 : 0, i === 0 ? 0.24 : 0.15);
      parent.add(seg);
      add(ellipsoid(0.075 - i * 0.008, 1, 1, 1.6), fur, seg, 0, 0, 0.07);
      if (i === 3) add(ellipsoid(0.06, 1, 1, 1.5), belly, seg, 0, 0, 0.16); // ponta clara
      this.tail.push(seg);
      parent = seg;
    }
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  /**
   * `speed` em m/s; `attack` de 0 a 1 (preparação do bote); `dead` desliga a animação.
   */
  animate(dt: number, speed: number, attack: number, dead: boolean): void {
    this.time += dt;
    if (dead) return;
    this.move = damp(this.move, clamp(speed / 6, 0, 1), 8, dt);
    // Trote: patas em diagonal; mais rápido = passos maiores.
    this.gait += dt * (2.2 + speed * 1.9);
    const amp = 0.15 + 0.55 * this.move;
    for (const l of this.legs) {
      const s = Math.sin(this.gait + l.phase);
      l.hip.rotation.x = s * amp * (l.front ? 1 : 0.9) * Math.min(1, speed / 0.6);
      // Dobra o joelho na fase em que a pata sobe.
      const lift = Math.max(0, Math.cos(this.gait + l.phase)) * amp * 1.4 * Math.min(1, speed / 0.6);
      l.knee.rotation.x = l.front ? lift : -lift;
    }
    // Corpo sobe e desce, coluna flexiona, peito respira parado.
    const bob = Math.abs(Math.sin(this.gait)) * 0.05 * this.move;
    const breath = Math.sin(this.time * 2.4) * 0.012 * (1 - this.move);
    this.chest.position.y = 0.78 + bob + breath;
    this.hips.position.y = 0.76 + bob * 0.8;
    this.chest.rotation.x = Math.sin(this.gait * 2) * 0.05 * this.move;
    this.hips.rotation.x = -Math.sin(this.gait * 2) * 0.06 * this.move;
    this.chest.scale.setScalar(1 + breath * 2);
    // Bote: cabeça baixa e projetada, boca aberta.
    this.root.position.z = -0.25 * attack;
    this.neck.rotation.x = -0.35 + 0.45 * attack + Math.sin(this.gait) * 0.06 * this.move;
    // Parado: olha em volta devagar.
    this.head.rotation.y = Math.sin(this.time * 0.6) * 0.35 * (1 - this.move) * (1 - attack);
    this.jaw.rotation.x = 0.55 * attack + Math.max(0, Math.sin(this.time * 7)) * 0.08 * this.move; // ofegando ao correr
    // Orelhas: mexem de vez em quando; deitam para trás no bote.
    this.earTimer -= dt;
    if (this.earTimer <= 0) {
      this.earTimer = 1.5 + Math.random() * 3;
      this.earTwitch = 1;
    }
    this.earTwitch = Math.max(0, this.earTwitch - dt * 6);
    this.ears.forEach((e, i) => {
      e.rotation.x = 0.7 * attack + 0.25 * this.move - Math.sin(this.earTwitch * Math.PI) * 0.3 * (i === 0 ? 1 : 0.5);
    });
    // Cauda: balança (mais no trote), cada segmento atrasado em relação ao anterior.
    this.tailSwing = damp(this.tailSwing, this.move, 4, dt);
    this.tail.forEach((seg, i) => {
      seg.rotation.y = Math.sin(this.time * (3 + this.tailSwing * 5) - i * 0.7) * (0.12 + 0.12 * i) * (0.6 + this.tailSwing);
      seg.rotation.x = i === 0 ? 0.9 - this.tailSwing * 0.5 - attack * 0.4 : 0.18;
    });
  }
}
