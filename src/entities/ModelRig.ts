// Modelo 3D animado de um personagem (.glb do KayKit Adventurers, CC0).
// As pernas/corpo seguem as animações (parado, andar, correr, pular, morrer);
// os braços e a cabeça são girados por cima delas para apontar o arco para a mira.
import * as THREE from 'three';
import { GLTFLoader, type GLTF, type GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharacterDef, CharacterModel } from '../data/characters';
import { MOVEMENT } from '../data/movement';
import { damp } from '../core/math';

/** Escurece a textura dos modelos para combinar com a luz da arena (1 = original). */
const MODEL_ALBEDO = 0.62;

const MODELS_URL = `${import.meta.env.BASE_URL}models/`;

/** Velocidade (m/s) em que cada animação de passo fica com os pés "no chão". */
const ANIM_SPEED = { walk: 3.2, walkBack: 2.4, run: 6.5, strafe: 5.5 };

type ClipName = 'idle' | 'walk' | 'walkBack' | 'run' | 'strafeL' | 'strafeR' | 'jump' | 'death';
const CLIP_SOURCE: Record<ClipName, string> = {
  idle: 'Idle',
  walk: 'Walking_A',
  walkBack: 'Walking_Backwards',
  run: 'Running_A',
  strafeL: 'Running_Strafe_Left',
  strafeR: 'Running_Strafe_Right',
  jump: 'Jump_Idle',
  death: 'Death_A',
};

/**
 * Texturas sem fetch: decodifica a imagem embutida no .glb direto com
 * createImageBitmap (o GLTFLoader usaria uma URL blob:, que algumas páginas
 * com política de segurança rígida bloqueiam).
 */
class EmbeddedTexturePlugin {
  readonly name = 'arqueiros_embedded_textures';
  constructor(private readonly parser: GLTFParser) {}

  loadTexture(index: number): Promise<THREE.Texture> | null {
    const json = this.parser.json;
    const image = json.images?.[json.textures[index].source];
    if (!image || image.bufferView === undefined) return null;
    return this.parser.getDependency('bufferView', image.bufferView).then(async (data: ArrayBuffer) => {
      const bitmap = await createImageBitmap(new Blob([data], { type: image.mimeType }));
      const tex = new THREE.Texture(bitmap);
      tex.flipY = false;
      tex.needsUpdate = true;
      return tex;
    });
  }
}

const loader = new GLTFLoader().register((parser) => new EmbeddedTexturePlugin(parser));
const gltfCache = new Map<string, Promise<GLTF>>();

declare global {
  /** Modelos embutidos (base64) na versão de página única; senão, baixa public/models/*.glb. */
  interface Window {
    __ARQ_MODELS__?: Record<string, string>;
  }
}

async function modelBytes(file: string): Promise<ArrayBuffer> {
  const embedded = window.__ARQ_MODELS__?.[file];
  if (embedded) return Uint8Array.from(atob(embedded), (c) => c.charCodeAt(0)).buffer;
  const res = await fetch(`${MODELS_URL}${file}.glb`);
  if (!res.ok) throw new Error(`${file}.glb: HTTP ${res.status}`);
  return res.arrayBuffer();
}

function loadGltf(file: string): Promise<GLTF> {
  let p = gltfCache.get(file);
  if (!p) {
    p = modelBytes(file).then((bytes) => loader.parseAsync(bytes, ''));
    gltfCache.set(file, p);
  }
  return p;
}

function loadScene(file: string): Promise<THREE.Object3D> {
  return loadGltf(file).then((g) => g.scene);
}

let clipsPromise: Promise<Map<string, THREE.AnimationClip>> | null = null;
function loadClips(): Promise<Map<string, THREE.AnimationClip>> {
  clipsPromise ??= loadGltf('anims').then((g) => new Map(g.animations.map((a) => [a.name, a])));
  return clipsPromise;
}

/** Começa a baixar os modelos usados (chamado ao abrir o jogo). */
export function preloadModels(defs: CharacterDef[]): void {
  loadClips().catch(() => undefined);
  for (const d of defs) if (d.model) loadScene(d.model.file).catch(() => undefined);
}

const skinTextures = new Map<string, THREE.Texture>();

/** Textura com a célula de pele da paleta (canto superior esquerdo, 1/8 x 1/4) trocada pela cor pedida. */
function recolorSkin(tex: THREE.Texture, color: number): THREE.Texture {
  const key = `${tex.uuid}:${color}`;
  const cached = skinTextures.get(key);
  if (cached) return cached;
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const w = Math.round(img.width / 8);
  const h = Math.round(img.height / 4);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const lum = (i: number) => 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
  let avg = 0;
  for (let i = 0; i < px.length; i += 4) avg += lum(i);
  avg /= px.length / 4;
  const c = new THREE.Color(color);
  for (let i = 0; i < px.length; i += 4) {
    const k = lum(i) / avg;
    px[i] = Math.min(255, c.r * 255 * k);
    px[i + 1] = Math.min(255, c.g * 255 * k);
    px[i + 2] = Math.min(255, c.b * 255 * k);
  }
  ctx.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(canvas);
  out.flipY = tex.flipY;
  out.colorSpace = tex.colorSpace;
  out.magFilter = tex.magFilter;
  out.minFilter = tex.minFilter;
  skinTextures.set(key, out);
  return out;
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** Gira um osso no espaço do mundo (q aplicado por cima da rotação atual). */
function rotateBoneWorld(bone: THREE.Object3D, q: THREE.Quaternion): void {
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(q);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_q);
    _q2.premultiply(_q.invert());
  }
  bone.quaternion.copy(_q2);
  bone.updateMatrixWorld(true);
}

/** Gira `bone` para que o caminho até `child` aponte para `dir` (mundo), misturado por `blend`. */
function aimBone(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3, blend: number): void {
  if (blend <= 0.001) return;
  bone.getWorldPosition(_v);
  child.getWorldPosition(_v2).sub(_v).normalize();
  _q.setFromUnitVectors(_v2, dir);
  _q.slerp(_q2.identity(), 1 - blend);
  rotateBoneWorld(bone, _q.clone());
}

export interface RigPose {
  /** Mira (0 = relaxado, 1 = arco erguido). */
  drawBlend: number;
  /** Puxada da corda (0..1). */
  pull: number;
  aimPitch: number;
  /** Velocidade em relação ao corpo (m/s): frente e direita. */
  forward: number;
  right: number;
  running: boolean;
  grounded: boolean;
  dead: boolean;
  recoil: number;
  flinch: number;
}

export class ModelRig {
  /** Raiz do modelo (já virado para -Z e na escala do personagem). */
  readonly root = new THREE.Group();
  /** Pontos de encaixe das partes geométricas (cabeça/peito/quadril), alinhados ao corpo. */
  readonly sockets: { head: THREE.Group; torso: THREE.Group; hips: THREE.Group };
  /** Escala para partes geométricas feitas para um corpo de 1,8 m. */
  readonly partScale: number;
  readonly materials: THREE.MeshStandardMaterial[] = [];
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<ClipName, THREE.AnimationAction>();
  private readonly weights = new Map<ClipName, number>();
  private readonly bones: Record<string, THREE.Object3D> = {};
  private deadShown = false;

  constructor(source: THREE.Object3D, clips: Map<string, THREE.AnimationClip>, def: CharacterDef, model: CharacterModel) {
    const obj = cloneSkinned(source);
    obj.rotation.y = Math.PI; // os modelos olham para +Z; o jogo usa -Z como frente
    this.root.add(obj);
    obj.traverse((o) => {
      // Obs.: o GLTFLoader tira os pontos dos nomes dos ossos ('hand.l' vira 'handl').
      if (o.name) this.bones[o.name] ??= o;
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false; // a animação de morte sai da caixa da pose original
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      if (model.skinColor !== undefined && m.map) m.map = recolorSkin(m.map, model.skinColor);
      if (model.metal) {
        m.metalness = 0.7;
        m.roughness = 0.35;
      } else {
        // O .glb vem com rugosidade 0,5: reflete demais o céu.
        m.roughness = 0.85;
      }
      // A paleta do KayKit é bem clara; sob o sol forte da arena ficaria "lavada".
      m.color.multiplyScalar(MODEL_ALBEDO);
      mesh.material = m;
      this.materials.push(m);
    });
    for (const name of model.hide ?? []) if (this.bones[name]) this.bones[name].visible = false;
    if (model.customHead) for (const o of Object.values(this.bones)) if (/_Head/.test(o.name) && (o as THREE.Mesh).isMesh) o.visible = false;

    // Escala: a altura do modelo vira a altura do personagem.
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj, true);
    const scale = def.height / Math.max(0.1, box.max.y - box.min.y);
    obj.scale.setScalar(scale);
    obj.position.y = -box.min.y * scale;
    this.root.updateMatrixWorld(true);

    // Partes geométricas: cabeça proporcional à cabeça (grande) do modelo.
    const headBone = this.bones.head;
    const headTop = box.max.y * scale;
    headBone.getWorldPosition(_v);
    this.partScale = (headTop - _v.y) / 0.42;
    const socket = (bone: THREE.Object3D, s: number, offsetY = 0) => {
      const g = new THREE.Group();
      bone.getWorldPosition(_v);
      // Matriz desejada no mundo (= espaço do personagem na pose de criação): sem giro, só posição e escala.
      _m.compose(_v.setY(_v.y + offsetY), _q.identity(), _v2.setScalar(s));
      bone.updateMatrixWorld(true);
      g.matrix.copy(bone.matrixWorld).invert().multiply(_m);
      g.matrix.decompose(g.position, g.quaternion, g.scale);
      bone.add(g);
      return g;
    };
    const bodyScale = def.height / 1.8;
    const hipsY = (() => {
      this.bones.hips.getWorldPosition(_v);
      return _v.y;
    })();
    this.bones.chest.getWorldPosition(_v);
    this.sockets = {
      head: socket(headBone, this.partScale),
      // O "tronco" geométrico tem origem na altura do quadril.
      torso: socket(this.bones.chest, bodyScale, hipsY - _v.y),
      hips: socket(this.bones.hips, bodyScale),
    };

    this.mixer = new THREE.AnimationMixer(obj);
    for (const [name, src] of Object.entries(CLIP_SOURCE) as [ClipName, string][]) {
      const clip = clips.get(src);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      if (name === 'death') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      action.play();
      action.setEffectiveWeight(name === 'idle' ? 1 : 0);
      this.actions.set(name, action);
      this.weights.set(name, name === 'idle' ? 1 : 0);
    }
  }

  static async load(def: CharacterDef): Promise<ModelRig | null> {
    const model = def.model;
    if (!model) return null;
    const [scene, clips] = await Promise.all([loadScene(model.file), loadClips()]);
    return new ModelRig(scene, clips, def, model);
  }

  /** Ponto da mão esquerda (encaixe do arco), no espaço de `space`. */
  bowHand(space: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
    const slot = this.bones['handslotl'] ?? this.bones['handl'];
    slot.getWorldPosition(out);
    return space.worldToLocal(out);
  }

  update(p: RigPose, dt: number, bowNock: (() => THREE.Vector3) | null): void {
    // --- Pesos das animações do corpo ---
    const target: Partial<Record<ClipName, number>> = {};
    const speed = Math.hypot(p.forward, p.right);
    if (p.dead) target.death = 1;
    else if (!p.grounded) target.jump = 1;
    else if (speed < 0.4) target.idle = 1;
    else {
      const f = Math.abs(p.forward) / speed;
      const side = 1 - f;
      if (p.forward >= 0) target[p.running ? 'run' : 'walk'] = f;
      else target.walkBack = f;
      if (side > 0) target[p.right > 0 ? 'strafeR' : 'strafeL'] = side;
      // Começando a andar: um pouco de "parado" para não deslizar.
      if (speed < 1.5) target.idle = (1.5 - speed) / 1.1;
    }
    if (p.dead && !this.deadShown) this.actions.get('death')?.reset().play();
    this.deadShown = p.dead;
    let total = 0;
    for (const name of this.actions.keys()) {
      const w = damp(this.weights.get(name)!, target[name] ?? 0, p.dead ? 8 : 12, dt);
      this.weights.set(name, w);
      total += w;
    }
    for (const [name, action] of this.actions) action.setEffectiveWeight(this.weights.get(name)! / Math.max(1e-3, total));
    // Passos acompanham a velocidade real (pés não deslizam).
    const ts = (name: ClipName, ref: number) => this.actions.get(name)?.setEffectiveTimeScale(Math.min(1.8, Math.max(0.5, speed / ref)));
    ts('walk', ANIM_SPEED.walk);
    ts('walkBack', ANIM_SPEED.walkBack);
    ts('run', ANIM_SPEED.run * (MOVEMENT.sprintSpeed / 8.2));
    ts('strafeL', ANIM_SPEED.strafe);
    ts('strafeR', ANIM_SPEED.strafe);
    this.mixer.update(dt);
    this.root.updateMatrixWorld(true);
    if (p.dead) return;

    // --- Por cima da animação: mira, recuo e tranco ---
    const b = this.bones;
    const bodyQuat = this.root.getWorldQuaternion(new THREE.Quaternion());
    const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(bodyQuat);
    // Tranco ao levar dano: o peito vai para trás.
    if (p.flinch > 0.01) rotateBoneWorld(b.spine, _q.setFromAxisAngle(rightAxis, p.flinch * 0.35));
    // Cabeça acompanha a mira vertical.
    rotateBoneWorld(b.head, _q.setFromAxisAngle(rightAxis, -Math.max(-0.5, Math.min(0.4, p.aimPitch * 0.5))));

    const blend = p.drawBlend;
    if (blend > 0.001) {
      // Direção da mira no mundo (frente do corpo = -Z, inclinada pelo pitch).
      const aimDir = new THREE.Vector3(0, Math.sin(p.aimPitch), -Math.cos(p.aimPitch)).applyQuaternion(bodyQuat);
      const recoilDir = aimDir.clone().addScaledVector(new THREE.Vector3(0, 1, 0), p.recoil * 0.25).normalize();
      // Braço esquerdo esticado segurando o arco.
      aimBone(b['upperarml'], b['lowerarml'], recoilDir, blend);
      aimBone(b['lowerarml'], b['wristl'] ?? b['handl'], recoilDir, blend);
      // Braço direito: cotovelo para fora/trás, mão na corda.
      if (bowNock) {
        const elbowDir = new THREE.Vector3().copy(rightAxis).multiplyScalar(0.8).addScaledVector(aimDir, -0.35 - p.pull * 0.4);
        elbowDir.y += 0.1;
        aimBone(b['upperarmr'], b['lowerarmr'], elbowDir.normalize(), blend);
        const elbow = b['lowerarmr'].getWorldPosition(new THREE.Vector3());
        const toNock = bowNock().sub(elbow);
        if (toNock.lengthSq() > 1e-6) aimBone(b['lowerarmr'], b['wristr'] ?? b['handr'], toNock.normalize(), blend);
      }
    }
  }
}
