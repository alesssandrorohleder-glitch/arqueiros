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
  lemur: { kind: 'quickdraw', name: 'Saque Rápido', description: 'Saca e dispara na hora um leque de 5 flechas para onde mira (18 de dano cada).', cooldown: 12, duration: 0, color: 0xffb03a },
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
  /** Saque Rápido: flechas no leque, ângulo entre elas (rad) e dano de cada uma. */
  quickdrawCount: 5,
  quickdrawFan: 0.06,
  quickdrawDamage: 18,
};

/** Sobrecarga (Faísca) ativa agora. */
export function overclocked(c: { characterId: string; abilityActive: number }): boolean {
  return c.abilityActive > 0 && getAbility(c.characterId).kind === 'overclock';
}

export function getAbility(characterId: string): AbilityDef {
  return ABILITIES[characterId] ?? ABILITIES.hunter;
}
