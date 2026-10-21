// Drops: sorteio de arco (raridade pelas chances de data/rarities.ts),
// itens no chão, coleta e troca automática por um arco melhor.
import type { Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { BOWS, getBow } from '../data/bows';
import { LOOT, type MobDef } from '../data/mobs';
import { RARITIES, type Rarity } from '../data/rarities';
import { isAlive } from '../entities/CharacterState';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function rollRarity(sim: Simulation): Rarity {
  let r = sim.rng.next();
  for (const rarity of RARITY_ORDER) {
    r -= RARITIES[rarity].dropChance;
    if (r < 0) return rarity;
  }
  return 'common';
}

/** Sorteia um arco; com `rolls` > 1 fica com a melhor raridade. */
export function rollBow(sim: Simulation, rolls: number): string {
  let best: Rarity = 'common';
  for (let i = 0; i < rolls; i++) {
    const r = rollRarity(sim);
    if (RARITY_ORDER.indexOf(r) > RARITY_ORDER.indexOf(best)) best = r;
  }
  // Se não houver arco dessa raridade, desce até achar.
  for (let i = RARITY_ORDER.indexOf(best); i >= 0; i--) {
    const options = Object.values(BOWS).filter((b) => b.rarity === RARITY_ORDER[i]);
    if (options.length) return sim.rng.pick(options).id;
  }
  return Object.keys(BOWS)[0];
}

export function dropFromMob(sim: Simulation, def: MobDef, at: Vec3): void {
  if (sim.rng.next() >= def.dropChance) return;
  const bowId = rollBow(sim, def.lootRolls);
  const id = sim.allocId();
  const position = { x: at.x, y: sim.world.terrain.sample(at.x, at.z), z: at.z };
  sim.state.loot.push({ id, bowId, position, age: 0 });
  sim.emit({ type: 'lootDrop', lootId: id, bowId, position: { ...position } });
}

export const rarityRank = (bowId: string) => RARITY_ORDER.indexOf(getBow(bowId).rarity);

export function stepLoot(sim: Simulation, dt: number): void {
  const taken = new Set<number>();
  for (const item of sim.state.loot) {
    item.age += dt;
    if (item.age > LOOT.lifetime) {
      taken.add(item.id);
      continue;
    }
    // Só jogadores pegam itens (bots ignoram por enquanto).
    for (const c of sim.state.characters) {
      if (c.isBot || !isAlive(c)) continue;
      const d = Math.hypot(c.position.x - item.position.x, c.position.z - item.position.z);
      if (d > LOOT.pickupRadius || Math.abs(c.position.y - item.position.y) > 2) continue;
      // Equipa na hora se for de raridade maior e não estiver puxando o arco.
      const better = rarityRank(item.bowId) > rarityRank(c.bow.bowId) && !c.bow.drawing;
      if (better) c.bow.bowId = item.bowId;
      sim.emit({ type: 'pickup', ownerId: c.id, bowId: item.bowId, equipped: better });
      taken.add(item.id);
      break;
    }
  }
  if (taken.size) sim.state.loot = sim.state.loot.filter((l) => !taken.has(l.id));
}
