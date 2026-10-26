// Arco com tiro automático: segurando o botão, sai uma flecha a cada
// `fireInterval` do arco. Cada flecha acerta na hora o que estiver no centro
// da mira (systems/hitscan.ts); a flecha que se vê é só o rastro visual.
import { ABILITY_TUNING, overclocked } from '../data/abilities';
import { clamp, type Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { getBow, type BowDef } from '../data/bows';
import { getCharacter } from '../data/characters';
import { COMBAT, EFFECTS, FRENZY } from '../data/combat';
import type { CharacterState } from '../entities/CharacterState';
import type { InputCommand } from '../entities/InputCommand';
import { aimDirection, aimOrigin, arrowSpawnPoint } from './aim';
import { raycast } from './collision';
import { traceShot } from './hitscan';
import { abilityDamageScale } from './abilities';
import { dazzleAim, onShotFired } from './abilities2';
import type { ArrowTrail } from '../data/characters';

/**
 * "Carga" para o visual (corda puxando entre uma flecha e outra) e para o
 * anel da mira: 0 logo após um tiro, 1 quando a próxima flecha está pronta.
 */
/** Intervalo entre flechas deste personagem: mais lento normalmente, cadência cheia na Fúria. */
export function fireIntervalOf(c: CharacterState): number {
  const base = getBow(c.bow.bowId).fireInterval * (c.frenzy > 0 ? FRENZY.fireIntervalScale : COMBAT.fireIntervalScale);
  // Sobrecarga (Faísca): cadência bem mais alta enquanto dura.
  return overclocked(c) ? base * ABILITY_TUNING.overclockFireScale : base;
}

export function drawCharge(c: CharacterState): number {
  if (!c.bow.drawing) return 0;
  return clamp(1 - c.bow.cooldown / fireIntervalOf(c), 0, 1);
}

export function stepBow(sim: Simulation, c: CharacterState, cmd: InputCommand, dt: number): void {
  const b = c.bow;
  // A mira deste tick vale já para o tiro (a flecha sai onde a mira está agora).
  c.aimYaw = cmd.aimYaw;
  c.aimPitch = cmd.aimPitch;
  // Não há troca de arco: cada personagem usa o dele (cmd.equipBowId é ignorado).
  const bow = getBow(b.bowId);
  b.cooldown = Math.max(0, b.cooldown - dt);
  b.spread = 0;
  b.swayYaw = 0;
  b.swayPitch = 0;

  b.drawing = cmd.primary && !cmd.secondary && c.health > 0;
  if (!b.drawing) {
    b.drawTime = 0;
    return;
  }
  b.drawTime += dt;
  if (b.cooldown <= 0) {
    // Bots atiram mais devagar e causam menos dano conforme a dificuldade.
    const bot = sim.bots.get(c.id)?.diff;
    fire(sim, c, bow, cmd.aimAssist, bot?.damage ?? 1);
    b.cooldown = fireIntervalOf(c) / (bot?.fireRate ?? 1);
  }
}

function fire(sim: Simulation, c: CharacterState, bow: BowDef, assist: boolean, damageScale: number): void {
  // A linha do tiro sai do mesmo ponto que a câmera (centro da tela).
  const origin = aimOrigin(c);
  let aim = aimDirection(c.aimYaw, c.aimPitch);
  if (assist && !c.isBot) aim = assistDirection(sim, c, origin, aim) ?? aim;
  // Ofuscado pelo Prisma de Luz: o tiro sai torto.
  aim = dazzleAim(sim, c, aim);

  let damage = bow.damage * COMBAT.shotDamageFraction * damageScale * abilityDamageScale(c);
  const multishot = bow.effect === 'multishot';
  const count = multishot ? EFFECTS.multishotCount : 1;
  if (multishot) damage *= EFFECTS.multishotDamageFraction;
  const firstEvent = sim.events.length;
  const shots = shootFan(sim, c, bow, origin, aim, count, COMBAT.multishotFan, damage);
  // Flecha especial da segunda habilidade (maldição, raízes, faísca em cadeia).
  onShotFired(sim, c, shots, firstEvent, damage);
  sim.emit({ type: 'shot', ownerId: c.id, arrowId: 0, charge: 1 });
}

/** Resultado de uma flecha disparada: onde terminou o caminho dela. */
export interface FiredShot {
  end: Vec3;
}

/**
 * `count` flechas em leque (`fan` rad entre elas) a partir da mira: cada uma é
 * conferida na hora (hitscan) e ganha o rastro visual saindo da mão do arco.
 */
export function shootFan(sim: Simulation, c: CharacterState, bow: BowDef, origin: Vec3, aim: Vec3, count: number, fan: number, damage: number, trailOverride?: ArrowTrail): FiredShot[] {
  const spawn = arrowSpawnPoint(c);
  const trail = trailOverride ?? (c.frenzy > 0 ? 'frenzy' : getCharacter(c.characterId).arrowTrail);
  const fired: FiredShot[] = [];
  for (let k = 0; k < count; k++) {
    const offset = (k - (count - 1) / 2) * fan;
    const dir = offset ? rotateY(aim, offset) : aim;
    const shot = traceShot(sim, c.id, origin, dir, damage, bow.effect ?? null);
    fired.push({ end: shot.path[shot.path.length - 1] ?? { ...origin } });
    // Flecha visual: sai da mão do arco e voa pelo caminho do tiro.
    sim.state.arrows.push({
      id: sim.allocArrowId(),
      ownerId: c.id,
      position: { ...spawn },
      velocity: { x: 0, y: 0, z: 0 },
      damage,
      rarity: bow.rarity,
      age: 0,
      stuck: false,
      stuckDir: null,
      stuckToTarget: shot.stickTarget,
      trail,
      effect: bow.effect ?? null,
      path: shot.path,
      endStick: shot.stick,
    });
  }
  return fired;
}

/** Auxílio de mira: inimigo (personagem/mob) quase sob a mira e sem parede no caminho. */
export function assistDirection(sim: Simulation, c: CharacterState, origin: Vec3, aim: Vec3): Vec3 | null {
  let best: { dir: Vec3; angle: number } | null = null;
  for (const hb of sim.shotHitboxes(c.id)) {
    if (hb.id === c.id || hb.kind === 'target' || sim.sameTeam(c.id, hb.id)) continue;
    const body = hb.body;
    const chest = { x: body.x, y: (body.minY + body.maxY) / 2, z: body.z };
    for (const p of [chest, hb.head]) {
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      const dz = p.z - origin.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > COMBAT.aimAssistRange || d < 1) continue;
      const angle = Math.acos(Math.min(1, (dx * aim.x + dy * aim.y + dz * aim.z) / d));
      if (angle > COMBAT.aimAssistAngle || (best && angle >= best.angle)) continue;
      const wall = raycast(sim.world, origin.x, origin.y, origin.z, dx / d, dy / d, dz / d, d);
      if (wall && wall.distance < d - 0.6) continue;
      best = { dir: { x: dx / d, y: dy / d, z: dz / d }, angle };
    }
  }
  return best?.dir ?? null;
}

/** Gira um vetor em torno do eixo vertical. */
function rotateY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

/**
 * Previsão do arco no cliente online (só o visual e a sensação do disparo).
 * Quem decide o tiro de verdade é o servidor. Devolve true quando "atirou".
 */
export function predictBow(c: CharacterState, cmd: InputCommand, dt: number): boolean {
  const b = c.bow;
  b.cooldown = Math.max(0, b.cooldown - dt);
  b.drawing = cmd.primary && !cmd.secondary && c.health > 0;
  if (!b.drawing) {
    b.drawTime = 0;
    return false;
  }
  b.drawTime += dt;
  if (b.cooldown > 0) return false;
  b.cooldown = fireIntervalOf(c);
  return true;
}
