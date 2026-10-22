// Modo Gigantes: dois times de 5, cada um defendendo um gigante de pedra.
// Para ferir o gigante inimigo é preciso derrubar antes as duas torres dele.
// Tropas (mini golems) saem da base de cada time e seguem pelas trilhas.
// Balanceamento aqui; posições no mapa (data/maps/arena.ts).

export type Team = 0 | 1;

export const TEAMS: { name: string; color: number; css: string }[] = [
  { name: 'Azul', color: 0x3a8cff, css: '#4a9cff' },
  { name: 'Vermelho', color: 0xff3b2e, css: '#ff4a3a' },
];

/** Quantos personagens em cada time (jogador + bots). */
export const TEAM_SIZE = 5;

export type StructureKind = 'tower' | 'giant';

export interface StructureDef {
  name: string;
  maxHealth: number;
  /** Hitbox: cilindro (raio, altura) + "cabeça" (ponto fraco: dano de tiro na cabeça). */
  radius: number;
  height: number;
  headY: number;
  headRadius: number;
  /** Alcance do ataque (m). */
  range: number;
  /** Tempo de preparação do ataque e intervalo entre ataques (s). */
  windup: number;
  cooldown: number;
  /** Dano em personagens e em tropas. */
  damage: number;
  minionDamage: number;
  /** Área do golpe (gigante); 0 = tiro num alvo só (torre). */
  splash: number;
  /** XP para cada um do time que derrubar. */
  xp: number;
  /**
   * Área de ataque (raio em m, a partir do centro): só quem está dentro deste
   * círculo (desenhado no chão) consegue causar dano. De longe não adianta atirar:
   * é preciso entrar, debaixo dos tiros da torre/golpes do gigante, com ajuda das tropas.
   */
  attackArea: number;
}

export const STRUCTURES: Record<StructureKind, StructureDef> = {
  tower: {
    name: 'Torre',
    maxHealth: 550,
    radius: 2.1,
    height: 9,
    headY: 11.2,
    headRadius: 1.0,
    range: 24,
    windup: 0,
    cooldown: 1.2,
    damage: 20,
    minionDamage: 30,
    splash: 0,
    xp: 150,
    attackArea: 22,
  },
  giant: {
    name: 'Gigante',
    maxHealth: 1500,
    radius: 3.0,
    height: 9.5,
    headY: 11.6,
    headRadius: 1.7,
    range: 11,
    windup: 1.3,
    cooldown: 4,
    damage: 45,
    minionDamage: 120,
    splash: 9,
    xp: 400,
    attackArea: 15,
  },
};

/** Multiplicador do dano de flechas/habilidades em torres e gigantes. */
export const STRUCTURE_DAMAGE_SCALE = 1;

export interface MinionWaveDef {
  /** Primeira onda (s depois do início) e intervalo entre ondas (s). */
  firstDelay: number;
  interval: number;
  /** Tropas por trilha em cada onda. */
  perLane: number;
  /** Espaço de tempo entre uma tropa e a próxima da mesma onda (s). */
  stagger: number;
  /** Limite de tropas vivas de cada time. */
  maxAlive: number;
  /** Distância em que a tropa percebe inimigos (m). */
  aggroRange: number;
  /** Tropas causam este multiplicador de dano em torres/gigantes. */
  structureDamage: number;
  /** As tropas ficam mais fortes com o tempo: + esta fração de vida e dano por minuto. */
  growthPerMinute: number;
}

export const MINION_WAVES: MinionWaveDef = {
  firstDelay: 12,
  interval: 25,
  perLane: 3,
  stagger: 1.2,
  maxAlive: 24,
  aggroRange: 10,
  structureDamage: 4,
  growthPerMinute: 0.06,
};

/** Tropa de cada time (tipos em data/mobs.ts). */
export const MINION_TYPE: [string, string] = ['minionBlue', 'minionRed'];

/** Votação para desistir: o time inteiro vota; com `yesNeeded` votos "sim" o time desiste. */
export const SURRENDER = {
  yesNeeded: 3,
  /** Tempo para votar (s); quem não votou conta como "não". */
  voteTime: 20,
  /** Só pode pedir depois deste tempo de partida (s). */
  minTime: 180,
  /** Intervalo entre duas votações do mesmo time (s). */
  cooldown: 60,
};

/** Tempo eliminado: começa em `base` e cresce com a partida, até `max` (s). */
export const RESPAWN = {
  base: 5,
  perMinute: 0.6,
  max: 14,
};
