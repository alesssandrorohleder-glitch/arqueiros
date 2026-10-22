// Visual das torres e dos gigantes de pedra (modo Gigantes).
// Gigante: corpo de pedras esculpidas (rochas deformadas), runas e olhos que
// brilham na cor do time; ergue os punhos e esmaga o chão; protegido por uma
// redoma enquanto as torres do time estão de pé; desmorona quando cai.
// Torre: torre de pedra com estandartes e um cristal flutuante que atira.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STRUCTURES, TEAMS } from '../data/objectives';
import type { StructureState } from './StructureState';

/** Rocha esculpida: icosaedro deformado por ondas (faces facetadas). */
function boulder(seed: number, sx: number, sy: number, sz: number, rough = 0.18): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed * 0.7) +
      0.6 * Math.sin(v.z * 4.3 + v.x * 1.7 + seed * 1.3) +
      0.35 * Math.sin((v.x + v.y + v.z) * 6 + seed * 2.1);
    v.multiplyScalar(1 + n * rough * 0.5);
    pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  return g;
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

let sharedGlow: THREE.Texture | null = null;

/**
 * Em cada grupo, junta as malhas filhas diretas que usam o mesmo material numa
 * malha só (a posição/rotação/escala de cada uma vai para os vértices). Grupos
 * (tronco, braços, cabeça) continuam separados para animar. `keep` = malhas que
 * se mexem sozinhas e não podem ser juntadas.
 */
function mergeStatic(group: THREE.Object3D, keep: Set<THREE.Object3D>): void {
  const buckets = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of [...group.children]) {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && !keep.has(mesh) && !Array.isArray(mesh.material)) {
      const list = buckets.get(mesh.material) ?? [];
      list.push(mesh);
      buckets.set(mesh.material, list);
    } else if (!(child as THREE.Sprite).isSprite) {
      mergeStatic(child, keep);
    }
  }
  for (const [mat, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((m) => {
      m.updateMatrix();
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g = g.applyMatrix4(m.matrix);
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      return g;
    });
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.userData.noShadow = meshes.every((m) => m.userData.noShadow);
    for (const m of meshes) group.remove(m);
    group.add(mesh);
  }
}

export class StructureView {
  readonly root = new THREE.Group();
  /** Partes que somem ao cair (o resto vira entulho). */
  private readonly standing = new THREE.Group();
  private readonly rubble = new THREE.Group();
  private readonly glowMats: THREE.MeshStandardMaterial[] = [];
  private readonly sprites: THREE.Sprite[] = [];
  private readonly team: THREE.Color;
  private time = Math.random() * 10;
  private flash = 0;
  private wasDestroyed = false;
  /** 0 → 1 durante o desmoronamento. */
  private collapse = 0;
  // Gigante
  private torso: THREE.Group | null = null;
  private head: THREE.Group | null = null;
  private arms: THREE.Group[] = [];
  private shield: THREE.Mesh | null = null;
  private shieldHit = 0;
  private slamAnim = 0;
  private windupTotal = 0;
  // Torre
  private crystal: THREE.Mesh | null = null;

  /**
   * Círculo de ataque no chão (só de dentro dele se causa dano). Fica fora do
   * `root` (que gira com o gigante): o Game o adiciona à cena.
   */
  readonly area: THREE.Mesh;
  private playerInside = false;

  constructor(readonly state: StructureState, stone: THREE.Material, rock: THREE.Material, height: (x: number, z: number) => number) {
    this.team = new THREE.Color(TEAMS[state.team].color);
    sharedGlow ??= glowTexture();
    this.root.position.set(state.position.x, state.position.y, state.position.z);
    this.root.rotation.y = state.yaw;
    this.root.add(this.standing, this.rubble);
    this.area = this.buildArea(height);
    this.rubble.visible = false;
    if (state.kind === 'giant') this.buildGiant(rock);
    else this.buildTower(stone);
    // Junta as pedras de cada parte (mesmo material) numa malha só: de ~90 para ~20 desenhos.
    mergeStatic(this.root, new Set(this.crystal ? [this.crystal] : []));
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !(o as THREE.Mesh).userData.noShadow) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  private glowMat(intensity = 2.2): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color: this.team.clone().multiplyScalar(0.4), emissive: this.team, emissiveIntensity: intensity, roughness: 0.4 });
    this.glowMats.push(m);
    return m;
  }

  private sprite(parent: THREE.Object3D, x: number, y: number, z: number, size: number, opacity = 0.9): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sharedGlow!, color: this.team, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    s.userData.base = size;
    s.userData.opacity = opacity;
    parent.add(s);
    this.sprites.push(s);
    return s;
  }

  // ---------------------------------------------------------------- gigante

  private buildGiant(stone: THREE.Material): void {
    const dark = new THREE.MeshStandardMaterial({ color: 0x5d5a55, roughness: 0.95, flatShading: true });
    const rock = stone;
    const moss = new THREE.MeshStandardMaterial({ color: 0x55703a, roughness: 1, flatShading: true });
    const S = this.standing;
    // Pedestal octogonal com anel de runas.
    this.mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.7, 8), dark, S, 0, 0.1, 0);
    const ring = this.mesh(new THREE.TorusGeometry(4.6, 0.09, 6, 48).rotateX(Math.PI / 2), this.glowMat(1.6), S, 0, 0.48, 0);
    ring.userData.noShadow = true;

    // Pernas e pés.
    for (const side of [-1, 1]) {
      this.mesh(boulder(side * 3, 1.25, 0.7, 1.6), rock, S, side * 1.6, 0.9, -0.4);
      this.mesh(boulder(side * 5 + 1, 1.0, 1.6, 1.0), rock, S, side * 1.55, 2.6, 0);
      this.mesh(boulder(side * 7 + 2, 0.9, 0.7, 0.9), dark, S, side * 1.5, 1.6, -0.3); // joelho
    }
    this.mesh(boulder(11, 2.3, 1.1, 1.5), rock, S, 0, 4.4, 0); // quadril

    // Tronco (gira no quadril para respirar e golpear).
    const torso = new THREE.Group();
    torso.position.set(0, 4.8, 0);
    S.add(torso);
    this.torso = torso;
    this.mesh(boulder(13, 2.0, 1.5, 1.5), rock, torso, 0, 1.2, 0); // barriga
    this.mesh(boulder(17, 3.1, 2.0, 2.0), rock, torso, 0, 3.2, 0.1); // peito
    this.mesh(boulder(19, 2.4, 0.9, 1.4, 0.3), moss, torso, 0, 4.7, 0.5); // musgo nas costas
    // Runas brilhando no peito (rachaduras).
    const rune = this.glowMat(2.4);
    const runes = new THREE.Group();
    runes.position.set(0, 3.2, -1.75);
    torso.add(runes);
    const bar = (x: number, y: number, len: number, rot: number) => {
      const m = this.mesh(new THREE.BoxGeometry(0.16, len, 0.12), rune, runes, x, y, 0);
      m.rotation.z = rot;
      m.userData.noShadow = true;
    };
    bar(0, 0.2, 1.6, 0);
    bar(-0.45, 0.65, 0.9, 0.9);
    bar(0.45, 0.65, 0.9, -0.9);
    bar(-0.35, -0.5, 0.8, -0.6);
    bar(0.35, -0.5, 0.8, 0.6);
    this.sprite(runes, 0, 0.2, -0.3, 2.8, 0.55);

    // Ombros e braços.
    for (const side of [-1, 1]) {
      this.mesh(boulder(side * 23, 1.4, 1.2, 1.4), rock, torso, side * 3.0, 4.2, 0.1);
      this.mesh(boulder(side * 29, 1.0, 0.45, 1.0, 0.35), moss, torso, side * 3.0, 5.15, 0.2);
      const arm = new THREE.Group();
      arm.position.set(side * 3.3, 4.0, 0);
      torso.add(arm);
      this.arms.push(arm);
      this.mesh(boulder(side * 31, 0.85, 1.6, 0.85), rock, arm, side * 0.2, -1.5, 0);
      this.mesh(boulder(side * 37, 0.6, 0.5, 0.6), dark, arm, side * 0.25, -3.1, 0); // cotovelo
      this.mesh(boulder(side * 41, 1.0, 1.6, 1.0), rock, arm, side * 0.3, -4.4, -0.1);
      this.mesh(boulder(side * 43, 1.45, 1.25, 1.45, 0.25), rock, arm, side * 0.3, -6.3, -0.2); // punho
      // Runa no antebraço.
      const r = this.mesh(new THREE.BoxGeometry(0.12, 1.2, 0.1), rune, arm, side * 0.3, -4.4, -1.02);
      r.userData.noShadow = true;
    }

    // Cabeça: pedra com sobrancelha pesada, mandíbula e olhos brilhando.
    const head = new THREE.Group();
    head.position.set(0, 5.6, -0.3);
    torso.add(head);
    this.head = head;
    this.mesh(boulder(47, 1.3, 1.15, 1.2), rock, head, 0, 0.6, 0);
    this.mesh(boulder(53, 1.35, 0.35, 0.6, 0.3), dark, head, 0, 0.95, -0.85); // sobrancelha
    this.mesh(boulder(59, 1.0, 0.45, 0.9), rock, head, 0, -0.15, -0.45); // mandíbula
    this.mesh(new THREE.OctahedronGeometry(0.28).scale(1, 1.6, 0.6), this.glowMat(3), head, 0, 1.55, -0.95); // cristal na testa
    const eye = this.glowMat(4);
    for (const side of [-1, 1]) {
      const e = this.mesh(new THREE.SphereGeometry(0.2, 12, 8).scale(1.3, 0.7, 0.6), eye, head, side * 0.48, 0.62, -1.08);
      e.userData.noShadow = true;
      this.sprite(head, side * 0.48, 0.62, -1.25, 1.6);
    }

    // Redoma de proteção (enquanto as torres do time estão de pé).
    const dome = new THREE.Mesh(
      new THREE.IcosahedronGeometry(7.4, 2),
      new THREE.MeshBasicMaterial({ color: this.team, transparent: true, opacity: 0.1, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    dome.position.y = 6;
    dome.scale.y = 1.15;
    dome.userData.noShadow = true;
    this.root.add(dome);
    this.shield = dome;

    // Entulho (aparece quando cai).
    const R = this.rubble;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + i;
      const d = 1 + (i % 4) * 1.1;
      const s = 0.8 + (i % 3) * 0.5;
      this.mesh(boulder(i * 7.3, s, s * 0.7, s), i % 4 === 0 ? moss : rock, R, Math.cos(a) * d, s * 0.4, Math.sin(a) * d);
    }
    this.mesh(boulder(61, 1.3, 1.15, 1.2), rock, R, 2.4, 0.9, -2.2).rotation.set(0.4, 0.8, 1.6); // cabeça caída
  }

  // ---------------------------------------------------------------- torre

  private buildTower(stone: THREE.Material): void {
    const S = this.standing;
    const dark = new THREE.MeshStandardMaterial({ color: 0x57534c, roughness: 0.95, flatShading: true });
    const banner = new THREE.MeshStandardMaterial({ color: this.team.clone().multiplyScalar(0.75), roughness: 0.85, side: THREE.DoubleSide });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a04a, metalness: 0.8, roughness: 0.35 });
    this.mesh(new THREE.CylinderGeometry(3.0, 3.4, 1.2, 8), dark, S, 0, 0.3, 0);
    // Corpo: blocos irregulares empilhados, mais estreito no alto.
    for (let i = 0; i < 4; i++) {
      const r0 = 2.35 - i * 0.12;
      const g = new THREE.CylinderGeometry(r0 - 0.1, r0, 2.0, 10, 2);
      const pos = g.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k);
        const z = pos.getZ(k);
        const n = 1 + 0.05 * Math.sin(x * 5 + i * 3) * Math.cos(z * 4 - i);
        pos.setX(k, x * n);
        pos.setZ(k, z * n);
      }
      g.computeVertexNormals();
      this.mesh(g, stone, S, 0, 1.9 + i * 2, 0);
      this.mesh(new THREE.CylinderGeometry(r0 + 0.12, r0 + 0.12, 0.25, 10), dark, S, 0, 2.9 + i * 2, 0); // faixa
    }
    // Plataforma com ameias.
    this.mesh(new THREE.CylinderGeometry(2.8, 2.2, 0.7, 10), dark, S, 0, 9.3, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const m = this.mesh(new THREE.BoxGeometry(0.8, 0.8, 0.5), stone, S, Math.cos(a) * 2.45, 10.0, Math.sin(a) * 2.45);
      m.rotation.y = -a;
    }
    // Estandartes do time (frente e trás) com borda dourada.
    for (const side of [-1, 1]) {
      const b = this.mesh(new THREE.PlaneGeometry(1.4, 3.2, 1, 4), banner, S, 0, 7.0, side * 2.42);
      b.rotation.y = side > 0 ? 0 : Math.PI;
      this.mesh(new THREE.BoxGeometry(1.7, 0.12, 0.12), gold, S, 0, 8.65, side * 2.46);
      const emblem = this.mesh(new THREE.OctahedronGeometry(0.32).scale(1, 1.5, 0.3), this.glowMat(1.8), S, 0, 7.3, side * 2.5);
      emblem.userData.noShadow = true;
    }
    // Cristal flutuante (de onde saem os tiros).
    const crystal = this.mesh(new THREE.OctahedronGeometry(0.85).scale(1, 1.7, 1), this.glowMat(2.6), S, 0, STRUCTURES.tower.headY, 0);
    crystal.userData.noShadow = true;
    this.crystal = crystal;
    this.sprite(S, 0, STRUCTURES.tower.headY, 0, 4.5, 0.75);
    // Entulho e toco.
    const R = this.rubble;
    this.mesh(new THREE.CylinderGeometry(2.0, 2.4, 1.4, 10), stone, R, 0, 0.7, 0);
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4;
      const d = 2.2 + (i % 3) * 0.9;
      const s = 0.5 + (i % 4) * 0.25;
      this.mesh(boulder(i * 3.7, s * 1.3, s, s), i % 2 ? stone : dark, R, Math.cos(a) * d, s * 0.5, Math.sin(a) * d);
    }
  }

  // ---------------------------------------------------------------- reações

  /** Acertou e causou dano: pisca. */
  onHit(): void {
    this.flash = 1;
  }

  /** Acertou a redoma (gigante ainda protegido). */
  onShielded(): void {
    this.shieldHit = 1;
  }

  /** Torre atirou: o cristal pisca forte. */
  onShot(): void {
    this.flash = 1.5;
  }

  /** Gigante começou a erguer os punhos. */
  onWindup(time: number): void {
    this.windupTotal = time;
    this.slamAnim = 0;
  }

  onSlam(): void {
    this.windupTotal = 0;
    this.slamAnim = 1;
  }

  /**
   * Círculo de ataque: uma "cerca de luz" baixa em volta da estrutura, que
   * acompanha o relevo e vai sumindo para cima (aparece acima da grama).
   */
  private buildArea(height: (x: number, z: number) => number): THREE.Mesh {
    const R = STRUCTURES[this.state.kind].attackArea;
    const H = 1.1;
    const N = 128;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const { x: cx, z: cz } = this.state.position;
    const c = this.team;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = cx + Math.cos(a) * R;
      const z = cz + Math.sin(a) * R;
      const y = height(x, z) - 0.05;
      pos.push(x, y, z, x, y + H, z);
      col.push(c.r, c.g, c.b, 1, c.r, c.g, c.b, 0);
      if (i < N) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    // Some perto da câmera: quando a câmera atravessa a cerca, ela não cobre a tela.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vCamDist;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvCamDist = -mvPosition.z;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCamDist;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(2.0, 6.0, vCamDist);');
    };
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 2;
    m.frustumCulled = false;
    return m;
  }

  /** O jogador local está dentro do círculo (o círculo brilha mais). */
  setPlayerInside(inside: boolean): void {
    this.playerInside = inside;
  }

  update(s: StructureState, dt: number): void {
    this.area.visible = !s.destroyed;
    (this.area.material as THREE.MeshBasicMaterial).opacity = (this.playerInside ? 0.9 : 0.45) + 0.1 * Math.sin(this.time * 3);
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.shieldHit = Math.max(0, this.shieldHit - dt * 3);
    if (s.destroyed && !this.wasDestroyed) {
      this.wasDestroyed = true;
      this.collapse = 0.0001;
    }
    if (!s.destroyed && this.wasDestroyed) this.reset();

    // Brilho: pulsa devagar, pisca nos acertos; o gigante fica mais intenso quando vulnerável.
    const vulnerableBoost = s.kind === 'giant' && s.vulnerable ? 1.6 : 1;
    const pulse = (0.85 + 0.15 * Math.sin(this.time * 2.4)) * vulnerableBoost + this.flash * 1.2;
    const dying = this.collapse > 0 ? Math.max(0, 1 - this.collapse * 2) : 1;
    for (const m of this.glowMats) m.emissiveIntensity = (m.userData.base ??= m.emissiveIntensity) * pulse * dying;
    for (const sp of this.sprites) {
      sp.scale.setScalar(sp.userData.base * (0.9 + 0.1 * Math.sin(this.time * 3) + this.flash * 0.3) * vulnerableBoost ** 0.5);
      sp.material.opacity = sp.userData.opacity * dying;
    }

    if (this.collapse > 0) {
      this.collapse = Math.min(1, this.collapse + dt / 1.8);
      const t = this.collapse;
      // Desmorona: afunda e tomba; no fim, só o entulho.
      this.standing.position.y = -t * t * (s.kind === 'giant' ? 6 : 8);
      this.standing.rotation.x = t * t * 0.5;
      this.standing.rotation.z = t * 0.15;
      if (this.shield) this.shield.visible = false;
      this.rubble.visible = t > 0.35;
      this.rubble.scale.setScalar(Math.min(1, (t - 0.35) / 0.4));
      if (t >= 1) this.standing.visible = false;
      return;
    }

    if (this.crystal) {
      this.crystal.rotation.y += dt * 1.2;
      this.crystal.position.y = STRUCTURES.tower.headY + Math.sin(this.time * 1.6) * 0.25;
    }
    if (this.torso && this.head) {
      // Respira; ergue os punhos na preparação e esmaga no golpe.
      this.torso.position.y = 4.8 + Math.sin(this.time * 0.9) * 0.08;
      let lift = 0;
      if (s.windup > 0 && this.windupTotal > 0) lift = 1 - s.windup / this.windupTotal;
      else if (s.windup > 0) lift = 1;
      if (this.slamAnim > 0) this.slamAnim = Math.max(0, this.slamAnim - dt * 2.2);
      const raise = lift > 0 ? -2.7 * Math.min(1, lift * 1.4) : 0;
      const smash = this.slamAnim > 0 ? 0.9 * Math.sin(this.slamAnim * Math.PI) : 0;
      for (const arm of this.arms) {
        const target = raise + smash;
        arm.rotation.x += (target - arm.rotation.x) * Math.min(1, dt * (lift > 0 ? 6 : 14));
        arm.rotation.z = Math.sign(arm.position.x) * (0.08 + 0.03 * Math.sin(this.time * 0.9));
      }
      this.torso.rotation.x = lift > 0 ? -0.15 * lift : smash * 0.35;
      this.head.rotation.y = Math.sin(this.time * 0.35) * 0.25;
      this.root.rotation.y += ((s.yaw - this.root.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 2);
    }
    if (this.shield) {
      this.shield.visible = !s.vulnerable;
      const mat = this.shield.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + 0.04 * Math.sin(this.time * 2) + this.shieldHit * 0.35;
      this.shield.rotation.y += dt * 0.1;
    }
  }

  /** Partida reiniciada: de pé de novo. */
  private reset(): void {
    this.wasDestroyed = false;
    this.collapse = 0;
    this.standing.visible = true;
    this.standing.position.y = 0;
    this.standing.rotation.set(0, 0, 0);
    this.rubble.visible = false;
    this.root.rotation.y = this.state.yaw;
  }
}
