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
/** Brilho da cor nas roupas metálicas (o armadura do KayKit é cinza-escura). */
const METAL_ALBEDO = 1.6;

const MODELS_URL = `${import.meta.env.BASE_URL}models/`;

/** Folga entre a capa e a superfície do corpo/cauda (unidades do modelo). */
const CAPE_MARGIN = 0.03;
/** Quanto a capa pode abrir para trás (rad). */
const CAPE_MAX_ANGLE = 0.7;
/** Por quanto tempo a capa segura a maior abertura recente (s). */
const CAPE_HOLD = 0.6;
/** Pontos acima disto (perto dos ombros, relativo ao alto da capa) não empurram a capa. */
const CAPE_TOP_SKIP = -0.15;

/** Velocidade (m/s) em que cada animação de passo fica com os pés "no chão". */
const ANIM_SPEED = { walk: 3.2, walkBack: 2.4, run: 6.5, strafe: 5.5 };

/**
 * Animações de passo que andam juntas num ciclo só. O número é onde o ciclo de
 * cada uma começa para ficar no mesmo compasso da corrida (pé esquerdo no alto em
 * ~0,67 do ciclo), medido nos clipes do KayKit. Antes cada uma rodava no próprio
 * ritmo (andar = 1,07 s, correr = 0,8 s): andando na diagonal a mistura de
 * "andar/correr" com "correr de lado" ficava com as pernas fora de compasso,
 * parecendo dois corpos tremendo.
 */
const GAIT_OFFSET = { walk: 0.167, walkBack: 0.75, run: 0, strafeL: 0, strafeR: 0 } as const;
type GaitClip = keyof typeof GAIT_OFFSET;
const GAIT_CLIPS = Object.keys(GAIT_OFFSET) as GaitClip[];

type ClipName = 'idle' | 'walk' | 'walkBack' | 'run' | 'strafeL' | 'strafeR' | 'jump' | 'death' | 'cheer';
const CLIP_SOURCE: Record<ClipName, string> = {
  idle: 'Idle',
  walk: 'Walking_A',
  walkBack: 'Walking_Backwards',
  run: 'Running_A',
  strafeL: 'Running_Strafe_Left',
  strafeR: 'Running_Strafe_Right',
  jump: 'Jump_Idle',
  death: 'Death_A',
  // Comemoração do vencedor (Último de pé).
  cheer: 'Cheer',
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

const themeTextures = new Map<string, THREE.Texture>();

/**
 * Troca as cores da roupa na textura (paleta), mantendo a célula da pele.
 * 'evil' = arqueiro do mal: verde → preto, couro/marrom → vermelho-sangue, metal/claro → dourado.
 */
function recolorTheme(tex: THREE.Texture, theme: NonNullable<CharacterModel['theme']>): THREE.Texture {
  const key = `${tex.uuid}:${typeof theme === 'string' ? theme : JSON.stringify(theme)}`;
  const custom = typeof theme === 'string' ? null : { cloth: new THREE.Color(theme.cloth), leather: new THREE.Color(theme.leather), metal: new THREE.Color(theme.metal), other: theme.other };
  // Cor da categoria × brilho do pixel (mantém o sombreado pintado na textura).
  const paint = (col: THREE.Color, v: number, c: THREE.Color) => c.setRGB(Math.min(1, col.r * (0.35 + v)), Math.min(1, col.g * (0.35 + v)), Math.min(1, col.b * (0.35 + v)));
  const cached = themeTextures.get(key);
  if (cached) return cached;
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const px = data.data;
  const skinW = Math.round(img.width / 8);
  const skinH = Math.round(img.height / 4);
  const hsl = { h: 0, s: 0, l: 0 };
  const c = new THREE.Color();
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (x < skinW && y < skinH) continue; // pele
      const i = (y * img.width + x) * 4;
      c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
      c.getHSL(hsl);
      const h = hsl.h * 360;
      const v = Math.max(c.r, c.g, c.b);
      if (custom) {
        // Skin: cores livres por categoria.
        if (hsl.s > 0.18 && h > 70 && h < 200) paint(custom.cloth, v, c);
        else if (hsl.s > 0.2 && (h < 50 || h > 330)) paint(custom.leather, v, c);
        else if (hsl.s < 0.22 && v > 0.35) paint(custom.metal, v, c);
        else c.multiplyScalar(custom.other);
      } else if (theme === 'astronaut') {
        // Traje de astronauta: tecido → prata clara, couro → cinza, metal → laranja.
        if (hsl.s > 0.18 && h > 70 && h < 200) c.setRGB(0.55 * v + 0.38, 0.57 * v + 0.39, 0.6 * v + 0.42);
        else if (hsl.s > 0.2 && (h < 50 || h > 330)) c.setRGB(0.55 * v + 0.2, 0.58 * v + 0.2, 0.64 * v + 0.22);
        else if (hsl.s < 0.22 && v > 0.35) c.setRGB(1.0 * v, 0.55 * v, 0.16 * v);
        else c.multiplyScalar(0.8);
      } else if (hsl.s > 0.18 && h > 70 && h < 200) c.setRGB(0.16 * v + 0.03, 0.1 * v + 0.02, 0.12 * v + 0.02); // verde → preto
      else if (hsl.s > 0.2 && (h < 50 || h > 330)) c.setRGB(0.78 * v, 0.06 * v, 0.08 * v); // marrom/vermelho → vermelho-sangue
      else if (hsl.s < 0.22 && v > 0.35) c.setRGB(1.0 * v, 0.76 * v, 0.28 * v); // metal/claro → dourado
      else c.multiplyScalar(0.45);
      px[i] = c.r * 255;
      px[i + 1] = c.g * 255;
      px[i + 2] = c.b * 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(canvas);
  out.flipY = tex.flipY;
  out.colorSpace = tex.colorSpace;
  out.magFilter = tex.magFilter;
  out.minFilter = tex.minFilter;
  themeTextures.set(key, out);
  return out;
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _v3 = new THREE.Vector3();

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
  /** Comemorando (vencedor no fim da partida). */
  cheer?: boolean;
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
  /**
   * Capa (peça rígida presa ao peito nos modelos do KayKit). Fica num pivô no alto
   * das costas e abre para trás o bastante para as pernas, o quadril e a cauda não
   * a atravessarem. Antes, andando, o corpo/armadura passava por trás da capa e
   * piscava através dela.
   */
  private cape: {
    pivot: THREE.Group;
    /**
     * Superfície de dentro da capa (lado do corpo) numa grade altura × largura, no
     * espaço do pivô: por faixa (distância r do pivô), por coluna em x, o z mais à frente.
     */
    rows: { r: number; y: number; cells: (number | null)[] }[];
    x0: number;
    colWidth: number;
    angle: number;
    /** Giro do pivô com a capa parada. */
    baseQuat: THREE.Quaternion;
    /** Maior abertura pedida recentemente e por quanto tempo ainda vale (s). */
    holdNeed: number;
    hold: number;
    /** Pontos da superfície do corpo/pernas (quadril para baixo), no espaço do osso que os move. */
    surface: { bone: THREE.Object3D; points: THREE.Vector3[] }[];
  } | null = null;
  /** A capa também passa por cima das peças presas ao peito/costas (bichos: mochila, etc.). */
  capeOverTorsoParts = false;
  /** Posição no ciclo de passos (0..1), comum a todas as animações de passo. */
  private gaitCycle = 0;
  /**
   * Pose original dos ossos que giramos por cima da animação (cabeça, peito,
   * braços). Restaurada a cada quadro: se a animação não mexe num desses ossos,
   * o giro do quadro anterior não acumula (antes a cabeça ficava girando parada).
   */
  private readonly overrideBones: { bone: THREE.Object3D; rest: THREE.Quaternion }[] = [];

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
      if (model.theme && m.map) m.map = recolorTheme(m.map, model.theme);
      if (model.skinColor !== undefined && m.map) m.map = recolorSkin(m.map, model.skinColor);
      if (model.theme === 'astronaut') {
        // Traje acetinado: brilho metálico suave, sem escurecer o branco.
        m.metalness = 0.5;
        m.roughness = 0.32;
        m.envMapIntensity = 1.8;
        m.color.multiplyScalar(0.95);
      } else if (model.metal) {
        // Metal polido: cor mais clara (metal escuro vira preto) e reflexo do céu reforçado.
        m.metalness = 0.85;
        m.roughness = 0.28;
        m.envMapIntensity = 2.5;
        m.color.multiplyScalar(METAL_ALBEDO);
      } else {
        // O .glb vem com rugosidade 0,5: reflete demais o céu.
        m.roughness = 0.85;
        // A paleta do KayKit é bem clara; sob o sol forte da arena ficaria "lavada".
        m.color.multiplyScalar(MODEL_ALBEDO);
      }
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

    for (const name of ['head', 'spine', 'upperarml', 'lowerarml', 'upperarmr', 'lowerarmr']) {
      const bone = this.bones[name];
      if (bone) this.overrideBones.push({ bone, rest: bone.quaternion.clone() });
    }
    this.setupCape(obj);
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

  private setupCape(obj: THREE.Object3D): void {
    let cape: THREE.Mesh | null = null;
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh && /_Cape$/.test(o.name) && o.visible && o.parent) cape = o as THREE.Mesh;
    });
    if (!cape) return;
    const mesh = cape as THREE.Mesh;
    const parent = mesh.parent!;
    obj.updateWorldMatrix(true, true);
    // Eixos do pivô = eixos do modelo na pose original (+Y cima, +Z frente do modelo),
    // presos ao peito. (O osso do peito pode ter eixos girados.)
    const baseQuat = obj.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(parent.getWorldQuaternion(new THREE.Quaternion())).invert();
    const parentScale = parent.getWorldScale(new THREE.Vector3());
    const objScale = obj.getWorldScale(new THREE.Vector3());
    // Vértices da capa no mundo e depois no espaço do modelo.
    const toObj = obj.matrixWorld.clone().invert();
    const pos = mesh.geometry.getAttribute('position');
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(toObj));
    // Pivô: no alto da capa, no meio da espessura (no espaço do modelo).
    let top = -Infinity;
    for (const v of pts) top = Math.max(top, v.y);
    const near = pts.filter((v) => v.y > top - 0.08 * (1 / objScale.y));
    const pivotObj = new THREE.Vector3(
      near.reduce((a, v) => a + v.x, 0) / Math.max(1, near.length),
      top,
      near.reduce((a, v) => a + v.z, 0) / Math.max(1, near.length),
    );
    const pivot = new THREE.Group();
    parent.add(pivot);
    pivot.position.copy(parent.worldToLocal(pivotObj.clone().applyMatrix4(obj.matrixWorld)));
    pivot.quaternion.copy(baseQuat);
    // Mesma escala do modelo (o osso pode ter escala própria).
    pivot.scale.set(objScale.x / parentScale.x, objScale.y / parentScale.y, objScale.z / parentScale.z);
    pivot.attach(mesh);
    for (const v of pts) v.sub(pivotObj);
    // Grade: faixas de altura × colunas na largura; em cada célula, o ponto da capa mais
    // perto do corpo (+Z = frente do modelo).
    // (pts já estão relativos ao pivô.)
    top = -Infinity;
    let bottom = Infinity;
    let half = 0;
    for (const v of pts) {
      top = Math.max(top, v.y);
      bottom = Math.min(bottom, v.y);
      half = Math.max(half, Math.abs(v.x));
    }
    const NY = 14;
    const NX = 9;
    const colWidth = (2 * half) / NX;
    const rows: { r: number; y: number; cells: (number | null)[] }[] = [];
    for (let b = 0; b < NY; b++) {
      const y0 = top - ((b + 1) * (top - bottom)) / NY;
      const y1 = top - (b * (top - bottom)) / NY;
      const cells: (number | null)[] = new Array(NX).fill(null);
      let sumR = 0;
      let n = 0;
      for (const v of pts) {
        if (v.y < y0 - 1e-4 || v.y > y1 + 1e-4) continue;
        const col = Math.min(NX - 1, Math.max(0, Math.floor((v.x + half) / colWidth)));
        cells[col] = Math.max(cells[col] ?? -Infinity, v.z);
        sumR += Math.hypot(v.y, v.z);
        n++;
      }
      if (n) rows.push({ r: sumR / n, y: (y0 + y1) / 2, cells });
    }
    this.cape = { pivot, rows, x0: -half, colWidth, angle: 0, baseQuat, holdNeed: 0, hold: 0, surface: this.lowerBodySurface(obj) };
  }

  /**
   * Amostra da superfície das malhas do corpo, pernas e braços, presa ao osso que
   * mais mexe em cada vértice (quadril, pernas, braços), na pose original. Os braços
   * contam porque, puxando o arco, o cotovelo vai para trás e passava pela capa.
   */
  private lowerBodySurface(obj: THREE.Object3D): { bone: THREE.Object3D; points: THREE.Vector3[] }[] {
    const wanted = new Set(['hips', 'upperlegl', 'upperlegr', 'lowerlegl', 'lowerlegr', 'footl', 'footr', 'upperarml', 'upperarmr', 'lowerarml', 'lowerarmr', 'wristl', 'wristr', 'handl', 'handr']);
    const byBone = new Map<THREE.Object3D, THREE.Vector3[]>();
    obj.updateWorldMatrix(true, true);
    obj.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh || !mesh.visible) return;
      const pos = mesh.geometry.getAttribute('position');
      const idx = mesh.geometry.getAttribute('skinIndex');
      const wgt = mesh.geometry.getAttribute('skinWeight');
      if (!idx || !wgt) return;
      const bones = mesh.skeleton.bones;
      for (let i = 0; i < pos.count; i++) {
        let best = 0;
        for (let k = 1; k < 4; k++) if (wgt.getComponent(i, k) > wgt.getComponent(i, best)) best = k;
        const bone = bones[idx.getComponent(i, best)];
        if (!bone || !wanted.has(bone.name)) continue;
        // Vértice no mundo (pose original) → espaço do osso.
        const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse));
        bone.updateWorldMatrix(true, false);
        v.applyMatrix4(bone.matrixWorld.clone().invert());
        let list = byBone.get(bone);
        if (!list) byBone.set(bone, (list = []));
        list.push(v);
      }
    });
    // No máximo ~32 pontos por osso (espalhados).
    return [...byBone].map(([bone, pts]) => ({ bone, points: pts.filter((_, i) => i % Math.max(1, Math.ceil(pts.length / 32)) === 0) }));
  }

  /** Abre a capa para trás o necessário para pernas, quadril e cauda não a atravessarem. */
  private fitCape(dt: number): void {
    const cape = this.cape;
    if (!cape) return;
    const pivot = cape.pivot;
    // Espaço do pivô sem o giro da capa.
    pivot.parent!.updateWorldMatrix(true, false);
    _m.compose(pivot.position, cape.baseQuat, pivot.scale).premultiply(pivot.parent!.matrixWorld).invert();
    let need = 0;
    const margin = CAPE_MARGIN;
    // Um ponto (já no espaço do pivô): quanto a capa precisa abrir para passar por trás dele.
    const check = (p: THREE.Vector3) => {
      // Só o que está na altura da capa (abaixo dos ombros e acima da barra).
      if (p.y > CAPE_TOP_SKIP) return;
      let row = cape.rows[0];
      for (const rw of cape.rows) if (Math.abs(rw.y - p.y) < Math.abs(row.y - p.y)) row = rw;
      if (Math.abs(row.y - p.y) > 0.12) return;
      const z = row.cells[Math.floor((p.x - cape.x0) / cape.colWidth)];
      if (z == null) return; // ao lado da capa
      // Só o que está atrás da superfície de dentro da capa.
      if (p.z - margin > z) return;
      // Ângulo para trás (−Z) a partir da vertical, do ponto (com folga) e da capa parada.
      const over = Math.atan2(-(p.z - margin), -p.y) - Math.atan2(-z, -row.y);
      // Muito além da capa (ex.: braço esticado para trás no alto): não é a capa que ele atravessa.
      if (over <= CAPE_MAX_ANGLE && over > need) need = over;
    };
    // Superfície do corpo/pernas/braços (armadura do quadril, coxas, cotovelos).
    for (const { bone, points: local } of cape.surface) {
      _m2.multiplyMatrices(_m, bone.matrixWorld);
      for (const lp of local) check(_v3.copy(lp).applyMatrix4(_m2));
    }
    // Peças presas ao quadril (cauda do lagarto, da raposa...) e, nos bichos, às costas
    // (mochila-foguete da Fenna): a capa passa por cima delas.
    const parts = (o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      _m2.multiplyMatrices(_m, mesh.matrixWorld);
      // Malha juntada (entities/mergeParts.ts): confere a caixa de cada peça original.
      const boxes: THREE.Box3[] = mesh.userData.partBoxes ?? [mesh.geometry.boundingBox!];
      for (const bb of boxes) for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) check(_v3.set(x, y, z).applyMatrix4(_m2));
    };
    this.sockets.hips.traverse(parts);
    if (this.capeOverTorsoParts) this.sockets.torso.traverse(parts);
    need = Math.min(CAPE_MAX_ANGLE, need);
    // Estável: guarda a maior abertura do último meio segundo (a capa não sobe e desce
    // a cada passada) e se move devagar, sem trancos.
    cape.hold = need >= cape.holdNeed ? CAPE_HOLD : Math.max(0, cape.hold - dt);
    if (need >= cape.holdNeed || cape.hold <= 0) cape.holdNeed = need;
    cape.angle = damp(cape.angle, cape.holdNeed, cape.holdNeed > cape.angle ? 7 : 2, dt);
    pivot.quaternion.copy(cape.baseQuat).multiply(_q.setFromAxisAngle(_v2.set(1, 0, 0), cape.angle));
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
    else if (p.cheer) target.cheer = 1;
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
    // Passos: um ciclo só para todas as animações de passo, no ritmo da mistura
    // atual (cada uma acompanha a velocidade real, para os pés não deslizarem).
    const ref: Record<GaitClip, number> = {
      walk: ANIM_SPEED.walk,
      walkBack: ANIM_SPEED.walkBack,
      run: ANIM_SPEED.run * (MOVEMENT.sprintSpeed / 8.2),
      strafeL: ANIM_SPEED.strafe,
      strafeR: ANIM_SPEED.strafe,
    };
    let rate = 0;
    let gaitWeight = 0;
    for (const name of GAIT_CLIPS) {
      const action = this.actions.get(name);
      const w = this.weights.get(name) ?? 0;
      if (!action || w <= 0) continue;
      rate += (w * Math.min(1.8, Math.max(0.5, speed / ref[name]))) / action.getClip().duration;
      gaitWeight += w;
    }
    if (gaitWeight > 1e-3) this.gaitCycle = (this.gaitCycle + (rate / gaitWeight) * dt) % 1;
    for (const name of GAIT_CLIPS) {
      const action = this.actions.get(name);
      if (!action) continue;
      // O tempo é posto aqui; o mixer não avança essas animações sozinho.
      action.setEffectiveTimeScale(0);
      action.time = ((this.gaitCycle + GAIT_OFFSET[name]) % 1) * action.getClip().duration;
    }
    for (const o of this.overrideBones) o.bone.quaternion.copy(o.rest);
    this.mixer.update(dt);
    this.root.updateMatrixWorld(true);
    if (p.dead || p.cheer) {
      this.fitCape(dt);
      return;
    }

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
        // Cotovelo para o lado e um pouco para cima (antes ia bem para trás e atravessava a capa).
        const elbowDir = new THREE.Vector3().copy(rightAxis).multiplyScalar(0.9).addScaledVector(aimDir, -0.12 - p.pull * 0.15);
        elbowDir.y += 0.22;
        aimBone(b['upperarmr'], b['lowerarmr'], elbowDir.normalize(), blend);
        const elbow = b['lowerarmr'].getWorldPosition(new THREE.Vector3());
        const toNock = bowNock().sub(elbow);
        if (toNock.lengthSq() > 1e-6) aimBone(b['lowerarmr'], b['wristr'] ?? b['handr'], toNock.normalize(), blend);
      }
    }
    // Capa por último: depende da pose final (pernas e braços mirando).
    this.root.updateMatrixWorld(true);
    this.fitCape(dt);
  }
}
