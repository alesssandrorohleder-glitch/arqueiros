// Layout do mapa inicial: "Ruínas da Clareira".
// Coordenadas em metros. O centro do mapa é (0, 0); -Z é o norte.
// Tudo aqui é dado: mexa à vontade para mudar o mapa sem tocar no código.

export type RuinKind = 'temple' | 'tower' | 'wall' | 'arch' | 'rubble';
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
  /** Grupos de pedras grandes (cobertura). */
  rockClusters: { x: number; z: number; radius: number; count: number }[];
  /** Pedras soltas pelo mapa. */
  scatteredRocks: number;
  /** Tufos de grama e flores (só visual). */
  grassTufts: number;
  flowers: number;
  /** Onde o jogador nasce e para onde olha (yaw em radianos; 0 = norte). */
  playerSpawn: { x: number; z: number; yaw: number };
  /** Pontos de nascimento de bots (etapa 3). */
  botSpawns: { x: number; z: number }[];
  /** Pontos de nascimento de mobs (etapa 4). */
  mobSpawns: { x: number; z: number }[];
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
    { x: -60, z: -30 },
    { x: 66, z: 20 },
    { x: 26, z: -70 },
    { x: -40, z: 50 },
  ],
};
