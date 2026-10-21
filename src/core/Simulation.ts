// Simulação da partida: estado puro + passo fixo. Não conhece Three.js nem o
// DOM, então pode rodar igual num servidor no futuro.
import { getCharacter } from '../data/characters';
import { COMBAT } from '../data/combat';
import type { MapDef } from '../data/maps/arena';
import type { ArrowState } from '../entities/ArrowState';
import { createCharacterState, type CharacterState } from '../entities/CharacterState';
import type { InputCommand } from '../entities/InputCommand';
import type { TargetState } from '../entities/TargetState';
import { stepBow } from '../systems/bow';
import type { CollisionWorld } from '../systems/collision';
import { stepTargets } from '../systems/combat';
import { characterHitbox, targetHitbox, type Hitbox } from '../systems/hitboxes';
import { stepCharacter } from '../systems/movement';
import { stepArrows } from '../systems/projectiles';
import type { GameEvent } from './events';
import { Random } from './random';

export interface GameState {
  tick: number;
  characters: CharacterState[];
  arrows: ArrowState[];
  targets: TargetState[];
}

export class Simulation {
  readonly state: GameState = { tick: 0, characters: [], arrows: [], targets: [] };
  /** Eventos do último tick. */
  events: GameEvent[] = [];
  readonly rng: Random;
  private nextArrowId = 1;

  constructor(readonly world: CollisionWorld, map: MapDef) {
    this.rng = new Random(map.seed ^ 0xa770);
    const sp = map.playerSpawn;
    map.targets.forEach((t, i) => {
      this.state.targets.push({
        id: `dummy-${i}`,
        position: { x: t.x, y: world.terrain.sample(t.x, t.z), z: t.z },
        yaw: Math.atan2(-(sp.x - t.x), -(sp.z - t.z)),
        health: COMBAT.dummyHealth,
        maxHealth: COMBAT.dummyHealth,
        respawnTimer: 0,
      });
    });
  }

  addCharacter(id: string, characterId: string, bowId: string, x: number, z: number, yaw: number): CharacterState {
    const c = createCharacterState(id, getCharacter(characterId), bowId, x, this.world.terrain.sample(x, z), z, yaw);
    this.state.characters.push(c);
    return c;
  }

  getCharacter(id: string): CharacterState | undefined {
    return this.state.characters.find((c) => c.id === id);
  }

  allocArrowId(): number {
    return this.nextArrowId++;
  }

  /** Tudo que pode ser atingido agora. */
  hitboxes(): Hitbox[] {
    const list: Hitbox[] = [];
    for (const t of this.state.targets) if (t.respawnTimer <= 0) list.push(targetHitbox(t));
    for (const c of this.state.characters) if (c.health > 0) list.push(characterHitbox(c));
    return list;
  }

  emit(e: GameEvent): void {
    this.events.push(e);
  }

  step(commands: Map<string, InputCommand>, dt: number): void {
    this.events = [];
    for (const c of this.state.characters) {
      const cmd = commands.get(c.id);
      if (!cmd) continue;
      stepBow(this, c, cmd, dt);
      stepCharacter(c, cmd, this.world, dt);
    }
    stepArrows(this, dt);
    stepTargets(this, dt);
    this.state.tick++;
  }
}
