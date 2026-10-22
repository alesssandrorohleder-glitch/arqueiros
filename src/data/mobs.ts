// Mobs (criaturas): atributos, comportamento, XP e chance de deixar arcos.
export type MobBehavior = 'neutral' | 'hostile';
export type MobShape = 'boar' | 'wolf' | 'golem';

export interface MobDef {
  id: string;
  name: string;
  shape: MobShape;
  /** Neutro só ataca depois de ser atacado; hostil ataca quem chegar perto. */
  behavior: MobBehavior;
  maxHealth: number;
  /** Velocidade andando à toa e perseguindo (m/s). */
  wanderSpeed: number;
  chaseSpeed: number;
  /** Ataque corpo a corpo. */
  attackDamage: number;
  attackRange: number;
  /** Tempo de preparação do golpe (dá para fugir) e intervalo entre golpes (s). */
  attackWindup: number;
  attackCooldown: number;
  /** Distância em que percebe um alvo (hostil) (m). */
  aggroRange: number;
  /** Se ficar mais longe que isto da área de origem, desiste e volta (m). */
  leashRange: number;
  /** Hitbox: raio, altura do corpo; cabeça (raio, altura e quanto fica à frente). */
  radius: number;
  height: number;
  headRadius: number;
  headHeight: number;
  headForward: number;
  /** XP para quem eliminar. */
  xp: number;
  /** Chance de deixar um arco (0 a 1). */
  dropChance: number;
  /** Sorteios de raridade (pega o melhor): 1 = normal, 2 = mais sorte. */
  lootRolls: number;
  /** Escala do modelo. */
  scale: number;
  /** Brilho (cor emissiva) do corpo, para mobs especiais. */
  glow?: number;
  /** Quem matar ganha a Fúria (data/combat.ts → FRENZY). */
  grantsFrenzy?: boolean;
}

export const MOBS: Record<string, MobDef> = {
  boar: {
    id: 'boar',
    name: 'Javali',
    shape: 'boar',
    behavior: 'neutral',
    maxHealth: 70,
    wanderSpeed: 1.6,
    chaseSpeed: 6.8,
    attackDamage: 18,
    attackRange: 1.6,
    attackWindup: 0.45,
    attackCooldown: 1.4,
    aggroRange: 0,
    leashRange: 35,
    radius: 0.55,
    height: 1.0,
    headRadius: 0.28,
    headHeight: 0.7,
    headForward: 0.75,
    xp: 40,
    dropChance: 0.18,
    lootRolls: 1,
    scale: 1,
  },
  wolf: {
    id: 'wolf',
    name: 'Lobo sombrio',
    shape: 'wolf',
    behavior: 'hostile',
    maxHealth: 45,
    wanderSpeed: 2.0,
    chaseSpeed: 7.4,
    attackDamage: 11,
    attackRange: 1.5,
    attackWindup: 0.35,
    attackCooldown: 1.1,
    aggroRange: 18,
    leashRange: 40,
    radius: 0.45,
    height: 0.95,
    headRadius: 0.22,
    headHeight: 0.85,
    headForward: 0.7,
    xp: 50,
    dropChance: 0.22,
    lootRolls: 1,
    scale: 1,
  },
  golem: {
    id: 'golem',
    name: 'Golem de pedra',
    shape: 'golem',
    behavior: 'hostile',
    maxHealth: 220,
    wanderSpeed: 1.0,
    chaseSpeed: 3.6,
    attackDamage: 32,
    attackRange: 2.6,
    attackWindup: 0.9,
    attackCooldown: 2.2,
    aggroRange: 16,
    leashRange: 28,
    radius: 0.85,
    height: 2.4,
    headRadius: 0.38,
    headHeight: 2.75,
    headForward: 0.1,
    xp: 160,
    dropChance: 0.85,
    lootRolls: 2,
    scale: 1,
  },
  emberWolf: {
    id: 'emberWolf',
    name: 'Lobo de brasa',
    shape: 'wolf',
    behavior: 'hostile',
    maxHealth: 90,
    wanderSpeed: 2.4,
    chaseSpeed: 7.8,
    attackDamage: 14,
    attackRange: 1.6,
    attackWindup: 0.35,
    attackCooldown: 1.0,
    aggroRange: 20,
    leashRange: 45,
    radius: 0.5,
    height: 1.05,
    headRadius: 0.24,
    headHeight: 0.95,
    headForward: 0.78,
    xp: 120,
    dropChance: 0.3,
    lootRolls: 1,
    scale: 1.15,
    glow: 0xff5a00,
    grantsFrenzy: true,
  },
};

/**
 * Mob especial que dá a Fúria: só um vivo por vez, nasce num ponto de mobs
 * sorteado. Tempos em segundos.
 */
export const FRENZY_MOB = {
  typeId: 'emberWolf',
  /** Primeiro surgimento depois do início da partida. */
  firstDelay: 30,
  /** Tempo para nascer outro depois que o anterior morre/some. */
  interval: 45,
};

/** Ritmo de surgimento dos mobs. */
export const MOB_SPAWNING = {
  /** Primeiro surgimento depois do início da partida (s). */
  firstDelay: 4,
  /** Intervalo entre surgimentos em cada ponto (s) no início e no fim da partida. */
  intervalStart: 22,
  intervalEnd: 10,
  /** Máximo de mobs vivos no mapa inteiro. */
  globalMax: 14,
  /** Tempo que o corpo fica no chão antes de sumir (s). */
  corpseTime: 3,
};

/** Itens largados no chão. */
export const LOOT = {
  /** Distância para pegar passando por cima (m). */
  pickupRadius: 1.6,
  /** Tempo até o item sumir (s). */
  lifetime: 60,
};
