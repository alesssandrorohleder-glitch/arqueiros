// Gera o mapa a partir dos dados (data/maps/arena.ts): terreno, ruínas,
// árvores, pedras e vegetação — tanto as malhas quanto os colisores.
import * as THREE from 'three';
import { distToSegment2D, lerp, smoothstep } from '../core/math';
import { Random, smoothNoise } from '../core/random';
import type { MapDef } from '../data/maps/arena';
import { TREE_AGES } from '../data/trees';
import { ANCIENT_TREE_CLEARANCE, ancientTreeBase, ancientTreeColliders, ancientTreeGeometry } from './ancientTree';
import { ColliderGrid, makeBox, makeCylinder, type Collider, type CollisionWorld } from '../systems/collision';
import type { GrassField } from './Grass';
import { Heightfield } from './Heightfield';
import { barkMaterial, foliageMaterial, terrainMaterial, triplanarMaterial } from './materials';
import { broadleafGeometry, bushGeometry, merge, paint, pebbleGeometry, petalFlowerGeometry, pineGeometry, rockGeometry } from './props';
import { buildRuin } from './ruins';
import { STRUCTURES } from '../data/objectives';
import type { TextureSet } from './textures';

export interface Arena {
  def: MapDef;
  group: THREE.Group;
  collision: CollisionWorld;
  height: (x: number, z: number) => number;
  /** Dados para a grama (altura e densidade em grade). */
  grassField: GrassField;
}

interface Spot { x: number; z: number; r: number }

const STONE_TONES = [0xe8e2d6, 0xd6cfc0, 0xf2ece0, 0xcbc3b2, 0xded6c6];
/** Madeira velha das casas em ruínas. */
const WOOD_TONES = [0x6b4a30, 0x5c3f28, 0x7a5636, 0x4f3622];

export function buildArena(def: MapDef, textures: TextureSet): Arena {
  const rng = new Random(def.seed);
  const group = new THREE.Group();
  group.name = 'arena';
  const colliders: Collider[] = [];

  // ---------------------------------------------------------------- terreno
  const rawHeight = (x: number, z: number): number => {
    const n = def.baseNoise;
    let h = n.amplitude * smoothNoise(x * n.scale, z * n.scale);
    for (const hill of def.hills) {
      const d2 = ((x - hill.x) ** 2 + (z - hill.z) ** 2) / (hill.radius * hill.radius);
      h += hill.height * Math.exp(-3 * d2);
    }
    const bm = def.borderMountains;
    const edge = Math.max(Math.abs(x), Math.abs(z));
    const m = smoothstep(bm.start, bm.start + bm.width, edge);
    if (m > 0) {
      h += m * bm.height * (0.6 + 0.4 * smoothNoise(x * 0.025 + 5, z * 0.025 - 2));
      h += m * 3 * smoothNoise(x * 0.15, z * 0.15);
    }
    return h;
  };
  // Ruínas e estruturas (torres/gigantes) ficam em chão plano.
  const flats = [...def.ruins, ...def.structures];
  const flatTargets = flats.map((r) => rawHeight(r.x, r.z));
  const height = (x: number, z: number): number => {
    let h = rawHeight(x, z);
    flats.forEach((r, i) => {
      const d = Math.hypot(x - r.x, z - r.z);
      if (d < r.flatten + 8) h = lerp(flatTargets[i], h, smoothstep(r.flatten, r.flatten + 8, d));
    });
    return h;
  };

  const terrain = new Heightfield(def.terrainHalfSize, def.terrainCellSize, height);

  const pathDist = (x: number, z: number): number => {
    let best = Infinity;
    for (const path of def.paths) {
      for (let i = 0; i < path.points.length - 1; i++) {
        const [ax, az] = path.points[i];
        const [bx, bz] = path.points[i + 1];
        best = Math.min(best, distToSegment2D(x, z, ax, az, bx, bz) - path.width / 2);
      }
    }
    return best;
  };
  const forestFactor = (x: number, z: number): number => {
    let f = 0;
    for (const fo of def.forests) f = Math.max(f, 1 - smoothstep(fo.radius * 0.6, fo.radius * 1.15, Math.hypot(x - fo.x, z - fo.z)));
    return f;
  };

  group.add(buildTerrainMesh(terrain, def, pathDist, forestFactor, textures));

  // ---------------------------------------------------------------- ruínas
  const blocked: Spot[] = def.targets.map((t) => ({ x: t.x, z: t.z, r: 2.5 }));
  for (const t of def.climbTrees) blocked.push({ x: t.x, z: t.z, r: ANCIENT_TREE_CLEARANCE });
  // Torres e gigantes (modo Gigantes): o visual é do StructureView; aqui só o colisor
  // (a simulação acha o colisor pela posição e o rebaixa quando a estrutura cai).
  def.structures.forEach((st, i) => {
    const sd = STRUCTURES[st.kind];
    const baseY = flatTargets[def.ruins.length + i];
    blocked.push({ x: st.x, z: st.z, r: st.flatten });
    colliders.push(makeCylinder(st.x, st.z, sd.radius, baseY - 0.5, baseY + sd.height));
  });
  for (const sp of def.teamSpawns.flat()) blocked.push({ x: sp.x, z: sp.z, r: 3 });
  const stoneGeos: THREE.BufferGeometry[] = [];
  const woodGeos: THREE.BufferGeometry[] = [];
  def.ruins.forEach((ruin, i) => {
    const baseY = flatTargets[i];
    blocked.push({ x: ruin.x, z: ruin.z, r: ruin.flatten });
    const c = Math.cos(ruin.rotation);
    const s = Math.sin(ruin.rotation);
    const toWorld = (lx: number, lz: number): [number, number] => [ruin.x + c * lx + s * lz, ruin.z - s * lx + c * lz];
    const pieceRng = new Random(def.seed + i * 977);

    for (const piece of buildRuin(ruin.kind, pieceRng)) {
      const tone = new THREE.Color(pieceRng.pick(STONE_TONES));
      const [wx, wz] = toWorld(piece.x, piece.z);
      if (piece.kind === 'block') {
        // Peças no chão afundam um pouco para não aparecer fresta em desníveis.
        const sink = piece.y === 0 ? 0.6 : 0;
        const h = piece.h + sink;
        const rot = piece.rot ?? 0;
        const g = new THREE.BoxGeometry(piece.w, h, piece.d)
          .rotateY(rot)
          .translate(piece.x, piece.y - sink + h / 2, piece.z)
          .rotateY(ruin.rotation)
          .translate(ruin.x, baseY, ruin.z);
        if (piece.wood) woodGeos.push(paint(g, WOOD_TONES[pieceRng.int(0, WOOD_TONES.length - 1)]));
        else stoneGeos.push(paint(g, tone));
        if (piece.collide !== false) {
          colliders.push(makeBox(wx, wz, piece.w, piece.d, ruin.rotation + rot, baseY + piece.y - sink, baseY + piece.y + piece.h));
        }
      } else if (piece.kind === 'column') {
        const g = new THREE.CylinderGeometry(piece.radius * 0.88, piece.radius, piece.height, 16)
          .translate(piece.x, piece.y + piece.height / 2, piece.z)
          .rotateY(ruin.rotation)
          .translate(ruin.x, baseY, ruin.z);
        stoneGeos.push(paint(g, tone));
        colliders.push(makeCylinder(wx, wz, piece.radius, baseY + piece.y - 0.6, baseY + piece.y + piece.height));
      } else if (piece.kind === 'beam') {
        // Viga/tábua inclinada: só visual.
        const g = new THREE.BoxGeometry(piece.w, piece.h, piece.d)
          .applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(piece.rx, piece.ry, piece.rz, 'YXZ')))
          .translate(piece.x, piece.y, piece.z)
          .rotateY(ruin.rotation)
          .translate(ruin.x, baseY, ruin.z);
        if (piece.wood !== false) woodGeos.push(paint(g, WOOD_TONES[pieceRng.int(0, WOOD_TONES.length - 1)]));
        else stoneGeos.push(paint(g, tone));
      } else {
        const g = new THREE.CylinderGeometry(piece.radius, piece.radius, piece.length, 16)
          .rotateZ(Math.PI / 2)
          .rotateY(piece.rot)
          .translate(piece.x, piece.y + piece.radius * 0.85, piece.z)
          .rotateY(ruin.rotation)
          .translate(ruin.x, baseY, ruin.z);
        stoneGeos.push(paint(g, tone.multiplyScalar(0.92)));
        colliders.push(makeBox(wx, wz, piece.length, piece.radius * 2, ruin.rotation + piece.rot, baseY - 0.3, baseY + piece.y + piece.radius * 1.85));
      }
    }
  });
  const ruinsMesh = new THREE.Mesh(merge(stoneGeos, true), triplanarMaterial(textures.stone, 0.42, 0.85, { vertexColors: true }));
  ruinsMesh.castShadow = true;
  ruinsMesh.receiveShadow = true;
  ruinsMesh.name = 'ruins';
  if (woodGeos.length) {
    // Madeira das casas (piso, telhado, vigas).
    const woodMesh = new THREE.Mesh(merge(woodGeos, true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;
    group.add(woodMesh);
  }
  group.add(ruinsMesh);

  // ---------------------------------------------------------------- posicionamento
  const spawn = def.playerSpawn;
  const trees: Spot[] = [];
  const P = def.playableHalfSize;
  const isFree = (x: number, z: number, clearance: number, spacing: number): boolean => {
    if (Math.abs(x) > P - 1 || Math.abs(z) > P - 1) return false;
    for (const b of blocked) if (Math.hypot(x - b.x, z - b.z) < b.r + clearance) return false;
    if (pathDist(x, z) < clearance) return false;
    if (Math.hypot(x - spawn.x, z - spawn.z) < 6) return false;
    for (const t of trees) if (Math.hypot(x - t.x, z - t.z) < spacing + t.r) return false;
    return true;
  };

  // ---------------------------------------------------------------- árvores
  const pineMatrices: THREE.Matrix4[] = [];
  const leafMatrices: THREE.Matrix4[] = [];
  const pineColors: THREE.Color[] = [];
  const leafColors: THREE.Color[] = [];
  const totalWeight = TREE_AGES.reduce((s, a) => s + a.weight, 0);
  const pickAge = () => {
    let r = rng.next() * totalWeight;
    for (const a of TREE_AGES) if ((r -= a.weight) <= 0) return a;
    return TREE_AGES[TREE_AGES.length - 1];
  };
  const addTree = (x: number, z: number, kind: 'pine' | 'broadleaf', collide: boolean) => {
    // Idade: nova (pequena), adulta ou antiga (grande e de tronco grosso).
    const age = pickAge();
    const scale = rng.range(age.scale[0], age.scale[1]);
    const girth = scale * age.girth;
    const y = terrain.sample(x, z) - 0.1;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI * 2)),
      new THREE.Vector3(girth, scale * rng.range(0.9, 1.15), girth),
    );
    const tint = new THREE.Color(1, 1, 1).multiplyScalar(rng.range(0.78, 1.08));
    tint.r *= rng.range(0.88, 1.08);
    tint.b *= rng.range(0.85, 1.0);
    if (kind === 'pine') { pineMatrices.push(m); pineColors.push(tint); }
    else { leafMatrices.push(m); leafColors.push(tint); }
    if (collide) {
      trees.push({ x, z, r: 0.3 * girth });
      colliders.push(makeCylinder(x, z, 0.3 * girth, y - 1, y + 3.2 * scale));
    }
  };

  for (const forest of def.forests) {
    const target = Math.round((forest.density * Math.PI * forest.radius * forest.radius) / 100);
    let placed = 0;
    for (let attempt = 0; attempt < target * 10 && placed < target; attempt++) {
      const a = rng.range(0, Math.PI * 2);
      const d = forest.radius * Math.sqrt(rng.next());
      const x = forest.x + Math.cos(a) * d;
      const z = forest.z + Math.sin(a) * d;
      if (!isFree(x, z, 1.5, 2.4)) continue;
      const kind = forest.kind === 'mixed' ? (rng.chance(0.5) ? 'pine' : 'broadleaf') : forest.kind;
      addTree(x, z, kind, true);
      placed++;
    }
  }
  for (let placed = 0, attempt = 0; placed < def.scatteredTrees && attempt < def.scatteredTrees * 20; attempt++) {
    const x = rng.range(-P, P);
    const z = rng.range(-P, P);
    if (!isFree(x, z, 2.5, 7)) continue;
    addTree(x, z, rng.chance(0.4) ? 'pine' : 'broadleaf', true);
    placed++;
  }
  // Árvores de enfeite nas montanhas (sem colisão: o jogador não chega lá).
  const T = def.terrainHalfSize - 4;
  for (let placed = 0, attempt = 0; placed < def.backdropTrees && attempt < def.backdropTrees * 10; attempt++) {
    const x = rng.range(-T, T);
    const z = rng.range(-T, T);
    if (Math.max(Math.abs(x), Math.abs(z)) < P + 3) continue;
    if (terrain.sample(x, z) > def.borderMountains.height * 0.75) continue;
    addTree(x, z, rng.chance(0.75) ? 'pine' : 'broadleaf', false);
    placed++;
  }

  const barkMat = barkMaterial(textures.bark);
  const pine = pineGeometry(rng);
  const leaf = broadleafGeometry(rng);
  const white = pineColors.map(() => new THREE.Color(1, 1, 1));
  const whiteLeaf = leafColors.map(() => new THREE.Color(1, 1, 1));
  group.add(instanced(pine.trunk, barkMat, pineMatrices, white, true));
  group.add(instanced(pine.foliage, foliageMaterial(textures.needles, 0.012), pineMatrices, pineColors, true));
  group.add(instanced(leaf.trunk, barkMat, leafMatrices, whiteLeaf, true));
  group.add(instanced(leaf.foliage, foliageMaterial(textures.leaves, 0.02), leafMatrices, leafColors, true));

  // Árvores anciãs escaláveis.
  if (def.climbTrees.length) {
    const ancient = ancientTreeGeometry(rng);
    const matrices = def.climbTrees.map((t) => {
      const ground = ancientTreeBase((x, z) => terrain.sample(x, z), t.x, t.z);
      colliders.push(...ancientTreeColliders(t.x, ground, t.z, t.rotation));
      return new THREE.Matrix4().compose(
        new THREE.Vector3(t.x, ground, t.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rotation),
        new THREE.Vector3(1, 1, 1),
      );
    });
    const ones = matrices.map(() => new THREE.Color(1, 1, 1));
    // Tábuas com veio (textura projetada); a cor compensa o tom escuro da textura.
    const woodMat = triplanarMaterial(textures.wood, 1.1, 0, { vertexColors: true, roughness: 0.85, color: new THREE.Color(2.1, 2.6, 3.4) }, 1.0);
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: 2.2, roughness: 0.4 });
    group.add(instanced(ancient.lanterns, lanternMat, matrices, ones, false));
    group.add(instanced(ancient.trunk, barkMat, matrices, ones, true));
    group.add(instanced(ancient.wood, woodMat, matrices, ones, true));
    group.add(instanced(ancient.foliage, foliageMaterial(textures.leaves, 0.006), matrices, ones.map(() => new THREE.Color(0.9, 0.95, 0.85)), true));
  }

  // ---------------------------------------------------------------- pedras
  const rockGeos = [rockGeometry(rng), rockGeometry(rng), rockGeometry(rng)];
  const rockMatrices: THREE.Matrix4[][] = [[], [], []];
  const rockColors: THREE.Color[][] = [[], [], []];
  const addRock = (x: number, z: number, size: number, collide: boolean) => {
    const sx = size * rng.range(0.8, 1.3);
    const sz = size * rng.range(0.8, 1.3);
    const sy = size * rng.range(0.6, 1.05);
    const ground = terrain.sample(x, z);
    const y = ground + sy * 0.25;
    const v = rng.int(0, 2);
    rockMatrices[v].push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.2, 0.2), rng.range(0, Math.PI * 2), rng.range(-0.2, 0.2))),
      new THREE.Vector3(sx, sy, sz),
    ));
    const g = rng.range(0.85, 1.1);
    rockColors[v].push(new THREE.Color(g, g * 0.98, g * 0.94));
    if (collide) {
      const r = Math.max(sx, sz) * 0.8;
      trees.push({ x, z, r });
      colliders.push(makeCylinder(x, z, r, ground - 1, y + sy * 0.9));
    }
  };
  for (const cluster of def.rockClusters) {
    for (let placed = 0, attempt = 0; placed < cluster.count && attempt < cluster.count * 15; attempt++) {
      const a = rng.range(0, Math.PI * 2);
      const d = cluster.radius * Math.sqrt(rng.next());
      const x = cluster.x + Math.cos(a) * d;
      const z = cluster.z + Math.sin(a) * d;
      if (!isFree(x, z, 1.5, 1.6)) continue;
      addRock(x, z, rng.range(0.9, 2.0), true);
      placed++;
    }
  }
  for (let placed = 0, attempt = 0; placed < def.scatteredRocks && attempt < def.scatteredRocks * 20; attempt++) {
    const x = rng.range(-P, P);
    const z = rng.range(-P, P);
    if (!isFree(x, z, 1.2, 2)) continue;
    addRock(x, z, rng.chance(0.7) ? rng.range(0.35, 0.8) : rng.range(1.0, 1.7), true);
    placed++;
  }
  for (let placed = 0, attempt = 0; placed < 160 && attempt < 3000; attempt++) {
    const x = rng.range(-T, T);
    const z = rng.range(-T, T);
    if (Math.max(Math.abs(x), Math.abs(z)) < P + 4) continue;
    addRock(x, z, rng.range(1.5, 4.5), false);
    placed++;
  }
  const rockMat = triplanarMaterial(textures.rock, 0.35, 1.0);
  rockGeos.forEach((g, i) => group.add(instanced(g, rockMat, rockMatrices[i], rockColors[i], true)));

  // ---------------------------------------------------------------- grama e flores (só visual)
  const ruinFloor = (x: number, z: number) => blocked.some((b) => Math.hypot(x - b.x, z - b.z) < b.r * 0.75);
  const grassField = buildGrassField(def, terrain, pathDist, (x, z) => {
    for (const r of flats) if (Math.hypot(x - r.x, z - r.z) < r.flatten * 0.8) return true;
    return false;
  });
  const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });

  const flowerMatrices: THREE.Matrix4[] = [];
  const flowerColors: THREE.Color[] = [];
  const petals = [0xffffff, 0xffe066, 0xff8fb1, 0xc39bff, 0xff6b4a];
  for (let placed = 0; placed < def.flowers;) {
    // Flores aparecem em pequenos canteiros.
    const cx = rng.range(-P, P);
    const cz = rng.range(-P, P);
    if (forestFactor(cx, cz) > 0.5 || pathDist(cx, cz) < 1 || ruinFloor(cx, cz)) continue;
    const color = new THREE.Color(rng.pick(petals));
    const n = rng.int(6, 16);
    for (let k = 0; k < n && placed < def.flowers; k++, placed++) {
      const x = cx + rng.range(-2.5, 2.5);
      const z = cz + rng.range(-2.5, 2.5);
      const s = rng.range(0.8, 1.3);
      flowerMatrices.push(new THREE.Matrix4().compose(
        new THREE.Vector3(x, terrain.sample(x, z), z),
        new THREE.Quaternion(),
        new THREE.Vector3(s, s, s),
      ));
      flowerColors.push(color);
    }
  }
  group.add(instanced(petalFlowerGeometry(), grassMat, flowerMatrices, flowerColors, false));

  // ---------------------------------------------------------------- arbustos e pedrinhas (só visual)
  // Sorteio próprio: não muda a posição de nada que já existia no mapa. Sem colisores:
  // não alteram rotas nem tiros. Arbustos baixos (até ~0,9 m) para não esconder ninguém.
  const deco = new Random(def.seed ^ 0x5eed);
  const bushGeos = [0, 1, 2].map(() => bushGeometry(deco));
  const bushMatrices: THREE.Matrix4[][] = [[], [], []];
  const bushColors: THREE.Color[][] = [[], [], []];
  const bushTints = [0xffffff, 0xdcebc0, 0xc8dcb0, 0xf2e2b8];
  for (let placed = 0, attempt = 0; placed < 420 && attempt < 12000; attempt++) {
    const x = deco.range(-P, P);
    const z = deco.range(-P, P);
    // Mais na borda das florestas e perto das ruínas; quase nada no campo aberto.
    const f = forestFactor(x, z);
    const nearRuin = def.ruins.some((r) => Math.abs(Math.hypot(x - r.x, z - r.z) - r.flatten) < 2.5);
    const edge = f > 0.05 && f < 0.75;
    if (!edge && !nearRuin && !deco.chance(0.08)) continue;
    if (ruinFloor(x, z) || !isFree(x, z, 1.3, 0.8)) continue;
    const s = deco.range(0.75, 1.3);
    const k = deco.int(0, 2);
    bushMatrices[k].push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, terrain.sample(x, z) - 0.05, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deco.range(0, Math.PI * 2)),
      new THREE.Vector3(s, s * deco.range(0.8, 1.05), s),
    ));
    bushColors[k].push(new THREE.Color(deco.pick(bushTints)));
    placed++;
  }
  const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  bushGeos.forEach((g, i) => group.add(instanced(g, bushMat, bushMatrices[i], bushColors[i], true)));

  // Pedrinhas espalhadas na beira das trilhas.
  const pebbleMatrices: THREE.Matrix4[] = [];
  const pebbleColors: THREE.Color[] = [];
  const pebbleTones = [0xb8b2a6, 0x9e978a, 0xc9c1b0, 0x8a8478];
  for (const path of def.paths) {
    for (let i = 0; i < path.points.length - 1; i++) {
      const [ax, az] = path.points[i];
      const [bx, bz] = path.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (let k = 0; k < len * 2.2; k++) {
        const t = deco.next();
        const side = deco.chance(0.5) ? 1 : -1;
        const off = side * (path.width / 2 + deco.range(-0.5, 0.9));
        const x = ax + (bx - ax) * t + nx * off;
        const z = az + (bz - az) * t + nz * off;
        if (Math.abs(x) > P || Math.abs(z) > P) continue;
        const s = deco.range(0.06, 0.2);
        pebbleMatrices.push(new THREE.Matrix4().compose(
          new THREE.Vector3(x, terrain.sample(x, z), z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(deco.range(-0.3, 0.3), deco.range(0, 6.3), 0)),
          new THREE.Vector3(s, s, s),
        ));
        pebbleColors.push(new THREE.Color(deco.pick(pebbleTones)));
      }
    }
  }
  const pebbleMat = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.95 });
  group.add(instanced(pebbleGeometry(deco), pebbleMat, pebbleMatrices, pebbleColors, false));

  return {
    def,
    group,
    height: (x, z) => terrain.sample(x, z),
    grassField,
    collision: { terrain, colliders, bounds: def.playableHalfSize, grid: new ColliderGrid(colliders, def.terrainHalfSize) },
  };
}

function instanced(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  matrices: THREE.Matrix4[],
  colors: THREE.Color[],
  shadows: boolean,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(matrices.length, 1));
  mesh.count = matrices.length;
  matrices.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, colors[i]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Grade de altura e densidade de grama para o shader da grama. */
function buildGrassField(
  def: MapDef,
  terrain: Heightfield,
  pathDist: (x: number, z: number) => number,
  onRuin: (x: number, z: number) => boolean,
): GrassField {
  const size = 512;
  const half = def.terrainHalfSize;
  const heights = new Float32Array(size * size);
  const density = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = -half + ((i + 0.5) / size) * half * 2;
      const z = -half + ((j + 0.5) / size) * half * 2;
      const h = terrain.sample(x, z);
      heights[j * size + i] = h;
      // Inclinação aproximada pela diferença de altura.
      const slope = Math.abs(terrain.sample(x + 1, z) - h) + Math.abs(terrain.sample(x, z + 1) - h);
      let d = smoothstep(0.2, 1.4, pathDist(x, z));
      d *= 1 - smoothstep(0.7, 1.1, slope);
      d *= 1 - smoothstep(def.borderMountains.height * 0.25, def.borderMountains.height * 0.4, h);
      if (onRuin(x, z)) d *= 0.15;
      density[j * size + i] = Math.round(d * 255);
    }
  }
  return { heights, density, size, terrainHalfSize: half };
}

function buildTerrainMesh(
  terrain: Heightfield,
  def: MapDef,
  pathDist: (x: number, z: number) => number,
  forestFactor: (x: number, z: number) => number,
  textures: TextureSet,
): THREE.Mesh {
  // Malha indexada (vértices compartilhados) para o relevo ficar liso.
  const n = terrain.cells + 1;
  const positions = new Float32Array(n * n * 3);
  const splat = new Float32Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = terrain.coord(i);
      const z = terrain.coord(j);
      const y = terrain.vertexHeight(i, j);
      const k = j * n + i;
      positions.set([x, y, z], k * 3);
      const pd = pathDist(x, z) + smoothNoise(x * 0.4, z * 0.4) * 0.4;
      const dirt = smoothstep(0.9, -0.3, pd);
      const mountain = smoothstep(def.borderMountains.height * 0.22, def.borderMountains.height * 0.42, y);
      const snow = smoothstep(def.borderMountains.height * 0.72, def.borderMountains.height * 0.92, y);
      splat.set([dirt, mountain, forestFactor(x, z) * 0.8, snow], k * 4);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < terrain.cells; j++) {
    for (let i = 0; i < terrain.cells; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      // Mesma diagonal da física (Heightfield.forEachTriangle).
      index.push(a, c, b, d, b, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // Encostas íngremes viram rocha.
  const normals = geo.getAttribute('normal');
  for (let k = 0; k < n * n; k++) {
    const steep = smoothstep(0.82, 0.66, normals.getY(k));
    splat[k * 4 + 1] = Math.max(splat[k * 4 + 1], steep);
  }
  const mesh = new THREE.Mesh(geo, terrainMaterial(textures));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
