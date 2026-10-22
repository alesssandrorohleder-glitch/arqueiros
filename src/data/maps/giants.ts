// Mapa do modo Gigantes (5 contra 5): "Vale dos Gigantes".
// O time Azul (0) fica no sul (+Z) e o Vermelho (1) no norte (-Z): cada base
// tem um gigante e, no meio do caminho, duas torres (uma em cada trilha).
// Coordenadas em metros; -Z é o norte. Formato em maps/arena.ts (MapDef).
import type { MapDef } from './arena';

export const GIANTS_VALLEY: MapDef = {
  name: 'Vale dos Gigantes',
  seed: 20261022,
  playableHalfSize: 90,
  terrainHalfSize: 180,
  terrainCellSize: 2,
  baseNoise: { amplitude: 0.7, scale: 0.045 },
  borderMountains: { start: 94, width: 50, height: 34 },
  hills: [
    // Morros baixos nas laterais (selva), espelhados entre os dois lados.
    { x: -70, z: 30, height: 5, radius: 18 },
    { x: 70, z: -30, height: 5, radius: 18 },
    { x: 72, z: 34, height: 4, radius: 16 },
    { x: -72, z: -34, height: 4, radius: 16 },
    { x: -14, z: 22, height: 2.5, radius: 10 },
    { x: 14, z: -22, height: 2.5, radius: 10 },
  ],
  ruins: [
    // Templo no centro: a área disputada entre as duas trilhas.
    { kind: 'temple', x: 0, z: 0, rotation: 0, flatten: 14 },
    // Arcos na entrada de cada base.
    { kind: 'arch', x: 0, z: 40, rotation: 0, flatten: 5 },
    { kind: 'arch', x: 0, z: -40, rotation: Math.PI, flatten: 5 },
    // Muros protegendo as bases.
    { kind: 'wall', x: -20, z: 58, rotation: 0.5, flatten: 8 },
    { kind: 'wall', x: 20, z: 58, rotation: -0.5, flatten: 8 },
    { kind: 'wall', x: 20, z: -58, rotation: Math.PI + 0.5, flatten: 8 },
    { kind: 'wall', x: -20, z: -58, rotation: Math.PI - 0.5, flatten: 8 },
    // Entulho como cobertura entre as torres.
    { kind: 'rubble', x: -20, z: 14, rotation: 0.2, flatten: 6 },
    { kind: 'rubble', x: 20, z: -14, rotation: 2.4, flatten: 6 },
    { kind: 'rubble', x: 22, z: 16, rotation: 1.1, flatten: 6 },
    { kind: 'rubble', x: -22, z: -16, rotation: 3.6, flatten: 6 },
    // Casas meio destruídas na beira da selva.
    { kind: 'house', x: -50, z: 44, rotation: 0.3, flatten: 7 },
    { kind: 'house', x: 50, z: -44, rotation: 0.3 + Math.PI, flatten: 7 },
    { kind: 'house', x: 52, z: 42, rotation: -1.2, flatten: 7 },
    { kind: 'house', x: -52, z: -42, rotation: -1.2 + Math.PI, flatten: 7 },
  ],
  paths: [
    // Trilhas oeste e leste (as das tropas) e a trilha do meio, pelo templo.
    { points: [[-6, 70], [-31, 46], [-34, 0], [-31, -46], [-6, -70]], width: 3.6 },
    { points: [[6, 70], [31, 46], [34, 0], [31, -46], [6, -70]], width: 3.6 },
    { points: [[0, 66], [0, 14]], width: 2.6 },
    { points: [[0, -14], [0, -66]], width: 2.6 },
  ],
  forests: [
    // Selva dos dois lados (entre as trilhas e a borda).
    { x: -66, z: 0, radius: 18, density: 3.0, kind: 'pine' },
    { x: 66, z: 0, radius: 18, density: 3.0, kind: 'pine' },
    { x: -68, z: 60, radius: 14, density: 2.6, kind: 'mixed' },
    { x: 68, z: -60, radius: 14, density: 2.6, kind: 'mixed' },
    { x: 68, z: 60, radius: 14, density: 2.4, kind: 'broadleaf' },
    { x: -68, z: -60, radius: 14, density: 2.4, kind: 'broadleaf' },
  ],
  scatteredTrees: 50,
  climbTrees: [
    { x: -46, z: 18, rotation: 0.4 },
    { x: 46, z: -18, rotation: 0.4 + Math.PI },
    { x: 46, z: 20, rotation: 1.2 },
    { x: -46, z: -20, rotation: 1.2 + Math.PI },
  ],
  backdropTrees: 700,
  rockClusters: [
    { x: -12, z: 30, radius: 6, count: 5 },
    { x: 12, z: -30, radius: 6, count: 5 },
    { x: 44, z: 2, radius: 6, count: 4 },
    { x: -44, z: -2, radius: 6, count: 4 },
  ],
  scatteredRocks: 35,
  grassTufts: 9000,
  flowers: 900,
  targets: [],
  specialSpots: {
    // Golem veloz: ao lado do templo, no meio (mesma distância das duas bases).
    swiftGolem: { x: 12.5, z: 0, radius: 1.5 },
  },
  playerSpawn: { x: 0, z: 84, yaw: 0 },
  botSpawns: [],
  mobSpawns: [
    // Selva: criaturas neutras/hostis que dão XP e arcos.
    { x: -66, z: 0, types: ['wolf', 'wolf', 'boar'], max: 3, radius: 10 },
    { x: 66, z: 0, types: ['wolf', 'wolf', 'boar'], max: 3, radius: 10 },
    { x: -66, z: 58, types: ['boar'], max: 2, radius: 8 },
    { x: 66, z: -58, types: ['boar'], max: 2, radius: 8 },
    { x: 66, z: 58, types: ['boar', 'wolf'], max: 2, radius: 8 },
    { x: -66, z: -58, types: ['boar', 'wolf'], max: 2, radius: 8 },
  ],
  structures: [
    { kind: 'giant', team: 0, x: 0, z: 74, flatten: 12 },
    { kind: 'tower', team: 0, x: -27, z: 32, flatten: 6 },
    { kind: 'tower', team: 0, x: 27, z: 32, flatten: 6 },
    { kind: 'giant', team: 1, x: 0, z: -74, flatten: 12 },
    { kind: 'tower', team: 1, x: 27, z: -32, flatten: 6 },
    { kind: 'tower', team: 1, x: -27, z: -32, flatten: 6 },
  ],
  lanes: [
    [[-5, 66], [-30, 46], [-33, 32], [-33, 0], [-33, -32], [-30, -46], [-5, -66]],
    [[5, 66], [30, 46], [33, 32], [33, 0], [33, -32], [30, -46], [5, -66]],
  ],
  teamSpawns: [
    [{ x: 0, z: 86 }, { x: -7, z: 85 }, { x: 7, z: 85 }, { x: -13, z: 83 }, { x: 13, z: 83 }],
    [{ x: 0, z: -86 }, { x: 7, z: -85 }, { x: -7, z: -85 }, { x: 13, z: -83 }, { x: -13, z: -83 }],
  ],
};
