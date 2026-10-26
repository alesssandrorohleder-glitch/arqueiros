// Habilidade única de cada personagem (tecla E / botão na tela). Balanceamento aqui.

export type AbilityKind =
  | 'lifesteal' // Kael: flechas curam
  | 'dash' // Sylwen: arrancada
  | 'shield' // Eldrin: escudo que absorve dano
  | 'jetpack' // Fenna: propulsor (pulo enorme + planar)
  | 'hawkeye' // Noctua: mais dano e inimigos marcados
  | 'emp' // Cobalto: pulso de energia em volta
  | 'regen' // Raszar: recupera vida
  | 'charge' // Squalo: investida com mordida
  | 'bonearmor' // Ossurso: recebe menos dano
  | 'blink' // Áurion: teleporte
  | 'overclock' // Faísca: atira e anda mais rápido
  | 'quickdraw'; // Ringo: leque de flechas na hora

export interface AbilityDef {
  kind: AbilityKind;
  name: string;
  description: string;
  /** Recarga (s), contada a partir do uso. */
  cooldown: number;
  /** Duração do efeito (s), para habilidades que duram. */
  duration: number;
  /** Cor do brilho/efeito. */
  color: number;
}

export const ABILITIES: Record<string, AbilityDef> = {
  hunter: { kind: 'lifesteal', name: 'Sede de Sangue', description: 'Por 6 s, suas flechas curam 35% do dano causado.', cooldown: 20, duration: 6, color: 0xd01020 },
  elf: { kind: 'dash', name: 'Passo Élfico', description: 'Arrancada rápida de ~8 m na direção em que anda.', cooldown: 7, duration: 0.3, color: 0x6affb0 },
  mage: { kind: 'shield', name: 'Escudo Arcano', description: 'Bolha que absorve até 45 de dano por 6 s.', cooldown: 18, duration: 6, color: 0xb48cff },
  fox: { kind: 'jetpack', name: 'Propulsor', description: 'O jato da mochila lança você bem alto e plana na descida.', cooldown: 10, duration: 1.8, color: 0xff8a2a },
  owl: { kind: 'hawkeye', name: 'Olhar de Coruja', description: 'Por 8 s: +30% de dano e inimigos marcados através das paredes.', cooldown: 20, duration: 8, color: 0xffc020 },
  robot: { kind: 'emp', name: 'Pulso EMP', description: 'Explosão de energia: 22 de dano e lentidão nos inimigos a até 8 m.', cooldown: 16, duration: 0, color: 0x3ff0ff },
  lizard: { kind: 'regen', name: 'Regeneração', description: 'Recupera 50 de vida em 4 s.', cooldown: 20, duration: 4, color: 0x7aff5a },
  shark: { kind: 'charge', name: 'Investida', description: 'Dispara para a frente e morde o primeiro inimigo no caminho (35 de dano).', cooldown: 10, duration: 0.4, color: 0x4aa8ff },
  skelbear: { kind: 'bonearmor', name: 'Armadura de Ossos', description: 'Por 6 s, recebe só metade do dano.', cooldown: 18, duration: 6, color: 0xe8e0c8 },
  goldbird: { kind: 'blink', name: 'Teleporte Estelar', description: 'Some e reaparece até 10 m à frente.', cooldown: 9, duration: 0, color: 0x3affc8 },
  lemur: { kind: 'quickdraw', name: 'Saque Rápido', description: 'Rolagem rápida disparando 4 flechas para onde mira (12 de dano cada). Se as 4 acertarem o mesmo alvo, estoura um poder nele (+30 de dano).', cooldown: 10, duration: 0.45, color: 0xffb03a },
  redpanda: { kind: 'overclock', name: 'Sobrecarga', description: 'Por 5 s, o núcleo biônico acelera: atira 50% mais rápido e anda 15% mais rápido.', cooldown: 18, duration: 5, color: 0x3ad8ff },
};

/** Valores de cada efeito. */
export const ABILITY_TUNING = {
  lifestealFraction: 0.35,
  dashSpeed: 26,
  shieldAmount: 45,
  jetpackVelocity: 17,
  /** Gravidade enquanto plana (fração da normal). */
  glideGravity: 0.3,
  hawkeyeDamage: 1.3,
  empRadius: 8,
  empDamage: 22,
  empSlow: 3,
  regenTotal: 50,
  chargeSpeed: 20,
  chargeDamage: 35,
  chargeReach: 1.7,
  bonearmorFactor: 0.5,
  blinkDistance: 10,
  /** Sobrecarga: intervalo entre flechas × isto (0,67 ≈ 50% mais tiros) e velocidade × isto. */
  overclockFireScale: 0.67,
  overclockSpeed: 1.15,
  /**
   * Saque Rápido (rolagem): velocidade da rolagem (m/s, dura a `duration` da
   * habilidade: ~5 m), flechas disparadas durante ela, dano de cada uma e o
   * estouro no alvo que levar todas.
   */
  rollSpeed: 10,
  rollArrows: 4,
  rollDamage: 12,
  rollBurstHits: 4,
  rollBurstDamage: 30,
  rollBurstRadius: 1.6,
};

/** Sobrecarga (Faísca) ativa agora. */
export function overclocked(c: { characterId: string; abilityActive: number }): boolean {
  return c.abilityActive > 0 && getAbility(c.characterId).kind === 'overclock';
}

export function getAbility(characterId: string): AbilityDef {
  return ABILITIES[characterId] ?? ABILITIES.hunter;
}

// ------------------------------------------------------------------ segunda habilidade (tecla Q)
// Mais fraca que a habilidade principal e com recarga maior: um recurso tático,
// não um segundo golpe forte.

export type Ability2Kind =
  | 'curse' // Kael: Flecha Maldita (próxima flecha amaldiçoa)
  | 'roots' // Sylwen: Raízes de Lethariel (próxima flecha prende raízes)
  | 'orb' // Eldrin: Orbe Arcano (teleguiado)
  | 'tailspin' // Raszar: Cauda Giratória
  | 'mine' // Cobalto: Mina de Choque
  | 'tracker' // Fenna: Satélite de Rastreio
  | 'feathers' // Noctua: Rajada de Penas
  | 'prism' // Áurion: Prisma de Luz
  | 'roar' // Ossurso: Rugido Gelado
  | 'bloodfrenzy' // Squalo: Frenesi
  | 'chain' // Faísca: Faísca em Cadeia (próxima flecha salta)
  | 'lasso'; // Ringo: Laço

export interface Ability2Def {
  kind: Ability2Kind;
  name: string;
  description: string;
  cooldown: number;
  /** Duração do efeito (s); nas "próxima flecha", o tempo para atirar antes de perder. */
  duration: number;
  color: number;
}

export const ABILITIES2: Record<string, Ability2Def> = {
  hunter: { kind: 'curse', name: 'Flecha Maldita', description: 'A próxima flecha amaldiçoa o alvo: 15 de dano em 5 s e ele fica marcado através das paredes.', cooldown: 16, duration: 6, color: 0x8a1aff },
  elf: { kind: 'roots', name: 'Raízes de Lethariel', description: 'A próxima flecha faz brotar raízes onde cair: inimigos a até 3 m ficam lentos por 2,5 s.', cooldown: 16, duration: 6, color: 0x5ad84a },
  mage: { kind: 'orb', name: 'Orbe Arcano', description: 'Lança um orbe que vai sozinho no inimigo mais perto da mira (até 30 m): 20 de dano.', cooldown: 14, duration: 0, color: 0xc49cff },
  lizard: { kind: 'tailspin', name: 'Cauda Giratória', description: 'Gira a cauda: 15 de dano e empurra os inimigos a até 2,5 m.', cooldown: 14, duration: 0.4, color: 0x9ad84a },
  robot: { kind: 'mine', name: 'Mina de Choque', description: 'Deixa uma mina no chão (até 2): quem pisar leva 18 de dano e fica lento por 2 s. Dura 20 s.', cooldown: 16, duration: 0, color: 0xffb03a },
  fox: { kind: 'tracker', name: 'Satélite de Rastreio', description: 'Mostra através das paredes os inimigos a até 15 m por 5 s.', cooldown: 18, duration: 5, color: 0x8ad8ff },
  owl: { kind: 'feathers', name: 'Rajada de Penas', description: 'Leque de 5 penas afiadas para onde mira: 8 de dano cada.', cooldown: 14, duration: 0, color: 0xe8d8b0 },
  goldbird: { kind: 'prism', name: 'Prisma de Luz', description: 'Clarão em cone (até 9 m): ofusca os inimigos por 2 s, e os tiros deles saem tortos.', cooldown: 16, duration: 0, color: 0xfff4a0 },
  skelbear: { kind: 'roar', name: 'Rugido Gelado', description: 'Rugido que congela: 10 de dano e lentidão por 2,5 s nos inimigos a até 5 m.', cooldown: 15, duration: 0, color: 0x9ae0ff },
  shark: { kind: 'bloodfrenzy', name: 'Frenesi', description: 'Por 5 s: anda 20% mais rápido e vê através das paredes quem está com menos de metade da vida.', cooldown: 18, duration: 5, color: 0xff3a3a },
  redpanda: { kind: 'chain', name: 'Faísca em Cadeia', description: 'A próxima flecha, se acertar, solta uma faísca que salta para até 2 inimigos perto do alvo (50% do dano).', cooldown: 16, duration: 6, color: 0x6ae8ff },
  lemur: { kind: 'lasso', name: 'Laço', description: 'Laça o inimigo mais perto da mira (até 10 m) e o prende no lugar por 1 s.', cooldown: 16, duration: 0, color: 0xd8a860 },
};

export const ABILITY2_TUNING = {
  curseDamage: 15,
  curseDuration: 5,
  rootsRadius: 3,
  rootsSlow: 2.5,
  orbDamage: 20,
  orbRange: 30,
  /** Cone (rad) em volta da mira em que o orbe/laço procuram alvo. */
  orbCone: 0.42,
  tailspinRadius: 2.5,
  tailspinDamage: 15,
  /** Empurrão: velocidade (m/s) por quanto tempo (s). */
  tailspinPush: 12,
  tailspinPushTime: 0.2,
  mineDamage: 18,
  mineSlow: 2,
  mineRadius: 1.8,
  mineLife: 20,
  mineMax: 2,
  /** Tempo até a mina armar (s). */
  mineArm: 0.8,
  trackerRadius: 15,
  feathers: 5,
  featherDamage: 8,
  featherFan: 0.07,
  prismRange: 9,
  prismCone: 0.6,
  prismDuration: 2,
  /** Desvio máximo (rad) dos tiros de quem está ofuscado. */
  prismScatter: 0.09,
  roarRadius: 5,
  roarDamage: 10,
  roarSlow: 2.5,
  frenzySpeed: 1.2,
  chainTargets: 2,
  chainRadius: 8,
  chainFraction: 0.5,
  lassoRange: 10,
  lassoCone: 0.3,
  lassoRoot: 1,
};

export function getAbility2(characterId: string): Ability2Def {
  return ABILITIES2[characterId] ?? ABILITIES2.hunter;
}
