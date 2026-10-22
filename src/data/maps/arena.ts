// Mapas: formato (MapDef) e o mapa do modo Todos contra todos, "Ruínas da Clareira".
// O mapa do modo Gigantes fica em maps/giants.ts.
// Coordenadas em metros. O centro do mapa é (0, 0); -Z é o norte.
// Tudo aqui é dado: mexa à vontade para mudar o mapa sem tocar no código.

import type { StructureKind, Team } from '../objectives';

export type RuinKind = 'temple' | 'tower' | 'wall' | 'arch' | 'rubble' | 'house';
export type ForestKind = 'pine' | 'broadleaf' | 'mixed';

export interface MapDef {
  name: string;
  seed: number;
  /** Metade do lado da área jogável (o jogador não passa daqui). */
  playableHalfSize: number;
  /** Metade do lado do terreno visível (montanhas em volta). */
  terrainHalfSize: number;
  /** Resolução do terreno (m por célula). Menor = mais detalhe e mais custo. */
  terrainCellSize: number;
  /** Ondulação suave do chão. */
  baseNoise: { amplitude: number; scale: number };
  /** Montanhas que cercam a arena. */
  borderMountains: { start: number; width: number; height: number };
  /** Morros (elevações). radius ≈ alcance do morro. */
  hills: { x: number; z: number; height: number; radius: number }[];
  /** Construções em ruínas. O terreno é aplainado em `flatten` metros em volta. */
  ruins: { kind: RuinKind; x: number; z: number; rotation: number; flatten: number }[];
  /** Trilhas de terra (polilinhas). */
  paths: { points: [number, number][]; width: number }[];
  /** Áreas de floresta. density = árvores a cada 100 m². */
  forests: { x: number; z: number; radius: number; density: number; kind: ForestKind }[];
  /** Árvores de enfeite nas montanhas, fora da área jogável. */
  backdropTrees: number;
  /** Árvores soltas pelo mapa (fora das florestas). */
  scatteredTrees: number;
  /** Árvores anciãs escaláveis (escada em espiral até uma plataforma no topo). rotation em rad. */
  climbTrees: { x: number; z: number; rotation: number }[];
  /** Grupos de pedras grandes (cobertura). */
  rockClusters: { x: number; z: number; radius: number; count: number }[];
  /** Pedras soltas pelo mapa. */
  scatteredRocks: number;
  /** Tufos de grama e flores (só visual). */
  grassTufts: number;
  flowers: number;
  /** Bonecos de treino (viram para o ponto de nascimento do jogador). */
  targets: { x: number; z: number }[];
  /** Onde o jogador nasce e para onde olha (yaw em radianos; 0 = norte). */
  playerSpawn: { x: number; z: number; yaw: number };
  /** Pontos de nascimento de bots (etapa 3). */
  botSpawns: { x: number; z: number }[];
  /** Pontos de nascimento de mobs: tipos possíveis, quantos vivos ao mesmo tempo e raio. */
  mobSpawns: { x: number; z: number; types: string[]; max: number; radius: number }[];
  /** Onde nascem os mobs especiais com lugar fixo (substitui `at` de SPECIAL_MOBS). */
  specialSpots?: Record<string, { x: number; z: number; radius: number }>;
  /** Torres e gigantes de cada time (só no modo Gigantes; vazio = sem times). O terreno é aplainado em `flatten` m em volta. */
  structures: { kind: StructureKind; team: Team; x: number; z: number; flatten: number }[];
  /**
   * Trilhas das tropas, da base do time 0 até a base do time 1 (o time 1 usa
   * de trás para frente).
   */
  lanes: [number, number][][];
  /** Onde cada time nasce (e volta depois de eliminado). */
  teamSpawns: [{ x: number; z: number }[], { x: number; z: number }[]];
}

export const ARENA: MapDef = {
  name: 'Ruínas da Clareira',
  seed: 20261021,
  playableHalfSize: 90,
  terrainHalfSize: 180,
  terrainCellSize: 2,
  baseNoise: { amplitude: 0.7, scale: 0.045 },
  borderMountains: { start: 94, width: 50, height: 34 },
  hills: [
    { x: 56, z: -52, height: 9, radius: 26 }, // morro da torre (nordeste)
    { x: -60, z: 42, height: 6, radius: 22 },
    { x: -48, z: -58, height: 4.5, radius: 18 },
    { x: 62, z: 48, height: 5, radius: 20 },
    { x: 4, z: -80, height: 3.5, radius: 20 },
    { x: -78, z: -10, height: 4, radius: 16 },
  ],
  ruins: [
    { kind: 'temple', x: 0, z: 0, rotation: 0, flatten: 14 },
    { kind: 'tower', x: 56, z: -52, rotation: 0.35, flatten: 7 },
    { kind: 'wall', x: -30, z: -22, rotation: 0.6, flatten: 8 },
    { kind: 'wall', x: 28, z: 30, rotation: -2.2, flatten: 8 },
    { kind: 'arch', x: 0, z: 34, rotation: 0, flatten: 5 },
    { kind: 'arch', x: -40, z: 8, rotation: 1.4, flatten: 5 },
    { kind: 'rubble', x: 36, z: -8, rotation: 0.2, flatten: 6 },
    { kind: 'rubble', x: -14, z: -48, rotation: 1.1, flatten: 6 },
    { kind: 'rubble', x: -58, z: 70, rotation: 2.4, flatten: 6 },
    { kind: 'wall', x: 70, z: 10, rotation: 1.57, flatten: 8 },
    // Casas meio destruídas.
    { kind: 'house', x: -52, z: -6, rotation: 0.3, flatten: 7 },
    { kind: 'house', x: 14, z: -24, rotation: 2.4, flatten: 7 },
    { kind: 'house', x: 60, z: -14, rotation: -1.2, flatten: 7 },
    { kind: 'house', x: 30, z: 46, rotation: 3.6, flatten: 7 },
  ],
  paths: [
    { points: [[0, 85], [0, 34], [0, 14]], width: 3.2 },
    { points: [[8, -6], [30, -26], [46, -42], [52, -48]], width: 2.6 },
    { points: [[-12, 4], [-40, 8], [-66, 18], [-84, 30]], width: 2.4 },
    { points: [[6, 12], [28, 30], [52, 44]], width: 2.2 },
    { points: [[-4, -12], [-14, -48], [-10, -82]], width: 2.2 },
  ],
  forests: [
    { x: -62, z: -30, radius: 22, density: 3.2, kind: 'pine' },
    { x: -66, z: 50, radius: 20, density: 2.6, kind: 'mixed' },
    { x: 66, z: 20, radius: 18, density: 2.4, kind: 'broadleaf' },
    { x: 26, z: -70, radius: 18, density: 3.0, kind: 'pine' },
    { x: 38, z: 68, radius: 20, density: 2.4, kind: 'mixed' },
    { x: -28, z: 70, radius: 14, density: 2.2, kind: 'broadleaf' },
  ],
  scatteredTrees: 70,
  climbTrees: [
    { x: -24, z: 15, rotation: 0.4 }, // entre o templo e o arco oeste
    { x: 20, z: -40, rotation: 2.1 }, // perto da trilha do morro da torre
    { x: -44, z: 30, rotation: 4.0 }, // borda da floresta oeste
    { x: 48, z: 30, rotation: 1.2 }, // leste, perto do bosque
  ],
  backdropTrees: 700,
  rockClusters: [
    { x: 18, z: 52, radius: 7, count: 6 },
    { x: -22, z: 28, radius: 6, count: 5 },
    { x: 44, z: 4, radius: 6, count: 4 },
    { x: -30, z: -70, radius: 8, count: 6 },
    { x: 76, z: -20, radius: 8, count: 6 },
  ],
  scatteredRocks: 45,
  grassTufts: 9000,
  flowers: 900,
  // Campo de treino ao norte do nascimento: alvos a ~12, 25, 40 e 60 m.
  targets: [
    { x: -5, z: 65 },
    { x: 8, z: 52 },
    { x: -12, z: 38 },
    { x: 14, z: 18 },
    { x: -22, z: 52 },
  ],
  playerSpawn: { x: 0, z: 76, yaw: 0 },
  botSpawns: [
    { x: -70, z: -70 },
    { x: 70, z: -76 },
    { x: 78, z: 70 },
    { x: -76, z: 74 },
    { x: -80, z: 0 },
    { x: 80, z: -4 },
  ],
  mobSpawns: [
    { x: -60, z: -30, types: ['wolf'], max: 3, radius: 12 }, // floresta de pinheiros (oeste)
    { x: 66, z: 20, types: ['boar', 'boar', 'wolf'], max: 3, radius: 12 },
    { x: 26, z: -70, types: ['wolf', 'boar'], max: 3, radius: 12 },
    { x: -40, z: 50, types: ['boar'], max: 2, radius: 10 },
    { x: 56, z: -40, types: ['golem'], max: 1, radius: 6 }, // ao pé do morro da torre
    { x: -14, z: -48, types: ['golem', 'wolf', 'wolf'], max: 2, radius: 8 }, // entulho ao norte
  ],
  structures: [],
  lanes: [],
  teamSpawns: [[], []],
};
