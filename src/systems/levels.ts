// Nível do personagem na partida (data/levels.ts): XP, subida de nível e os
// bônus de dano e vida. Também a lista de quem causou dano (assistências).
import type { Simulation } from '../core/Simulation';
import { getCharacter } from '../data/characters';
import { MATCH_LEVELS as L, xpForLevel } from '../data/levels';
import { isAlive, type CharacterState } from '../entities/CharacterState';

/** Vida máxima do personagem com o bônus do nível. */
export function maxHealthOf(c: CharacterState): number {
  return getCharacter(c.characterId).maxHealth + L.healthPerLevel * (c.level - 1);
}

/** Multiplicador de dano do nível. */
export function levelDamageScale(c: CharacterState): number {
  return 1 + L.damagePerLevel * (c.level - 1);
}

/** Dá XP de nível; sobe quantos níveis couberem (sem limite) e avisa. */
export function grantLevelXp(sim: Simulation, c: CharacterState, amount: number): void {
  if (amount <= 0) return;
  c.levelXp += amount;
  while (c.levelXp >= xpForLevel(c.level + 1)) {
    c.level++;
    // A vida máxima subiu: ganha o acréscimo e mais um pouco de cura.
    if (isAlive(c)) c.health = Math.min(maxHealthOf(c), c.health + L.healthPerLevel + maxHealthOf(c) * L.levelUpHeal);
    sim.emit({ type: 'levelUp', ownerId: c.id, level: c.level });
  }
}

/** Progresso dentro do nível atual (0 a 1) para o HUD. */
export function levelProgress(c: CharacterState): number {
  const a = xpForLevel(c.level);
  const b = xpForLevel(c.level + 1);
  return Math.max(0, Math.min(1, (c.levelXp - a) / (b - a)));
}
