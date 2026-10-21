// Gera o mapa a partir dos dados (data/maps/arena.ts): terreno, ruínas,
// árvores, pedras e vegetação — tanto as malhas quanto os colisores.
import * as THREE from 'three';
import { distToSegment2D, lerp, smoothstep } from '../core/math';
import { hash2, Random, smoothNoise } from '../core/random';
import type { MapDef } from '../data/maps/arena';
import { makeBox, makeCylinder, type Collider, type CollisionWorld } from '../systems/collision';
import { Heightfield } from './Heightfield';
import { broadleafGeometry, flowerGeometry, grassGeometry, merge, paint, pineGeometry, rockGeometry } from './props';
import { buildRuin } from './ruins';

export interface Arena {
  def: MapDef;
  group: THREE.Group;
  collision: CollisionWorld;
  height: (x: number, z: number) => number;
}

interface Spot { x: number; z: number; r: number }

const STONE_TONES = [0xbdb5a6, 0xa9a192, 0xc8c0ae, 0x9d9585, 0xb3ab99];

export function buildArena(def: MapDef): Arena {
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
  const flatTargets = def.ruins.map((r) => rawHeight(r.x, r.z));
  const height = (x: number, z: number): number => {
    let h = rawHeight(x, z);
    def.ruins.forEach((r, i) => {
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

  group.add(buildTerrainMesh(terrain, def, pathDist, forestFactor));

  // ---------------------------------------------------------------- ruínas
  const blocked: Spot[] = def.targets.map((t) => ({ x: t.x, z: t.z, r: 2.5 }));
  const stoneGeos: THREE.BufferGeometry[] = [];
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
        stoneGeos.push(paint(g, tone));
        if (piece.collide !== false) {
          colliders.push(makeBox(wx, wz, piece.w, piece.d, ruin.rotation + rot, baseY + piece.y - sink, baseY + piece.y + piece.h));
        }
      } else if (piece.kind === 'column') {
        const g = new THREE.CylinderGeometry(piece.radius * 0.88, piece.radius, piece.height, 8)
          .translate(piece.x, piece.y + piece.height / 2, piece.z)
          .rotateY(ruin.rotation)
          .translate(ruin.x, baseY, ruin.z);
        stoneGeos.push(paint(g, tone));
        colliders.push(makeCylinder(wx, wz, piece.radius, baseY + piece.y - 0.6, baseY + piece.y + piece.height));
      } else {
        const g = new THREE.CylinderGeometry(piece.radius, piece.radius, piece.length, 8)
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
  const ruinsMesh = new THREE.Mesh(
    merge(stoneGeos),
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 }),
  );
  ruinsMesh.castShadow = true;
  ruinsMesh.receiveShadow = true;
  ruinsMesh.name = 'ruins';
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
  const addTree = (x: number, z: number, kind: 'pine' | 'broadleaf', collide: boolean) => {
    const scale = rng.range(0.85, 1.4);
    const y = terrain.sample(x, z) - 0.1;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI * 2)),
      new THREE.Vector3(scale, scale * rng.range(0.9, 1.15), scale),
    );
    const tint = new THREE.Color().setHSL(0, 0, 1).multiplyScalar(rng.range(0.82, 1.08));
    tint.r *= rng.range(0.92, 1.05);
    if (kind === 'pine') { pineMatrices.push(m); pineColors.push(tint); }
    else { leafMatrices.push(m); leafColors.push(tint); }
    if (collide) {
      trees.push({ x, z, r: 0.3 * scale });
      colliders.push(makeCylinder(x, z, 0.3 * scale, y - 1, y + 3.2 * scale));
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

  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  group.add(instanced(pineGeometry(), treeMat, pineMatrices, pineColors, true));
  group.add(instanced(broadleafGeometry(rng), treeMat, leafMatrices, leafColors, true));

  // ---------------------------------------------------------------- pedras
  const rockGeos = [rockGeometry(rng), rockGeometry(rng), rockGeometry(rng)];
  const rockMatrices: THREE.Matrix4[][] = [[], [], []];
  const rockColors: THREE.Color[][] = [[], [], []];
  const addRock = (x: number, z: number, size: number, collide: boolean) => {
    const sx = size * rng.range(0.8, 1.3);
    const sz = size * rng.range(0.8, 1.3);
    const sy = size * rng.range(0.55, 1.0);
    const ground = terrain.sample(x, z);
    const y = ground + sy * 0.55;
    const v = rng.int(0, 2);
    rockMatrices[v].push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.2, 0.2), rng.range(0, Math.PI * 2), rng.range(-0.2, 0.2))),
      new THREE.Vector3(sx, sy, sz),
    ));
    const g = rng.range(0.5, 0.64);
    rockColors[v].push(new THREE.Color(g, g * 0.97, g * 0.92));
    if (collide) {
      const r = Math.max(sx, sz) * 0.8;
      trees.push({ x, z, r });
      colliders.push(makeCylinder(x, z, r, ground - 1, y + sy * 0.8));
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
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  rockGeos.forEach((g, i) => group.add(instanced(g, rockMat, rockMatrices[i], rockColors[i], true)));

  // ---------------------------------------------------------------- grama e flores (só visual)
  const grassMatrices: THREE.Matrix4[] = [];
  const grassColors: THREE.Color[] = [];
  const ruinFloor = (x: number, z: number) => blocked.some((b) => Math.hypot(x - b.x, z - b.z) < b.r * 0.75);
  const G = P + 6;
  for (let placed = 0, attempt = 0; placed < def.grassTufts && attempt < def.grassTufts * 4; attempt++) {
    const x = rng.range(-G, G);
    const z = rng.range(-G, G);
    if (pathDist(x, z) < 0.4 || ruinFloor(x, z)) continue;
    const s = rng.range(0.55, 1.1);
    grassMatrices.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, terrain.sample(x, z) - 0.03, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI * 2)),
      new THREE.Vector3(s, s * rng.range(0.8, 1.3), s),
    ));
    grassColors.push(new THREE.Color().setHSL(rng.range(0.24, 0.3), rng.range(0.45, 0.6), rng.range(0.3, 0.42)));
    placed++;
  }
  const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  group.add(instanced(grassGeometry(), grassMat, grassMatrices, grassColors, false));

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
  group.add(instanced(flowerGeometry(), grassMat, flowerMatrices, flowerColors, false));

  return {
    def,
    group,
    height: (x, z) => terrain.sample(x, z),
    collision: { terrain, colliders, bounds: def.playableHalfSize },
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

function buildTerrainMesh(
  terrain: Heightfield,
  def: MapDef,
  pathDist: (x: number, z: number) => number,
  forestFactor: (x: number, z: number) => number,
): THREE.Mesh {
  const triCount = terrain.cells * terrain.cells * 2;
  const positions = new Float32Array(triCount * 9);
  const colors = new Float32Array(triCount * 9);
  const grassA = new THREE.Color(0x5e9c43);
  const grassB = new THREE.Color(0x86b955);
  const forestGrass = new THREE.Color(0x4a8338);
  const dirt = new THREE.Color(0xb59868);
  const rock = new THREE.Color(0x8d857a);
  const highRock = new THREE.Color(0xc9c4ba);
  const c = new THREE.Color();
  const tmp = new THREE.Color();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  let k = 0;

  terrain.forEachTriangle((ax, ay, az, bx, by, bz, cx, cy, cz) => {
    positions.set([ax, ay, az, bx, by, bz, cx, cy, cz], k * 9);
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const mz = (az + bz + cz) / 3;
    e1.set(bx - ax, by - ay, bz - az);
    e2.set(cx - ax, cy - ay, cz - az);
    const ny = e1.cross(e2).normalize().y;

    c.copy(grassA).lerp(grassB, 0.5 + 0.5 * smoothNoise(mx * 0.06, mz * 0.06));
    c.lerp(forestGrass, forestFactor(mx, mz) * 0.8);
    const pd = pathDist(mx, mz) + smoothNoise(mx * 0.4, mz * 0.4) * 0.5;
    if (pd < 0.8) c.lerp(dirt, smoothstep(0.8, -0.4, pd));
    const steep = smoothstep(0.8, 0.62, ny);
    const mountain = smoothstep(def.borderMountains.height * 0.25, def.borderMountains.height * 0.45, my);
    c.lerp(rock, Math.max(steep, mountain));
    c.lerp(highRock, smoothstep(def.borderMountains.height * 0.7, def.borderMountains.height * 0.95, my));
    // Variação por triângulo: dá o visual "low-poly facetado".
    c.multiplyScalar(0.94 + hash2(mx, mz) * 0.1);
    for (let v = 0; v < 3; v++) colors.set(tmp.copy(c).toArray(), k * 9 + v * 3);
    k++;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.97 }));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
