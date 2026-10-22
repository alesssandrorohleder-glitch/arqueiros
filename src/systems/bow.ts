// Mecânica do arco: puxar (carga), mira que abre/fecha, cansaço e disparo.
import { clamp, damp, lerp, type Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { BOWS, getBow, type BowDef } from '../data/bows';
import { getCharacter } from '../data/characters';
import { COMBAT, EFFECTS } from '../data/combat';
import type { CharacterState } from '../entities/CharacterState';
import type { InputCommand } from '../entities/InputCommand';
import { aimDirection, aimOrigin, arrowSpawnPoint } from './aim';
import { raycast } from './collision';
import { launchAngleIfReachable } from './ai/ballistics';
import { raycastHitboxes } from './hitboxes';

/** Alcance máximo do raio que decide para onde a flecha vai (m). */
const AIM_RANGE = 400;

/** Carga atual de 0 a 1. */
export function drawCharge(c: CharacterState): number {
  if (!c.bow.drawing) return 0;
  return clamp(c.bow.drawTime / getBow(c.bow.bowId).drawTime, 0, 1);
}

/** Dispersão que a mira "quer" ter agora, conforme o movimento. */
function targetSpread(c: CharacterState, bow: BowDef): number {
  const hSpeed = Math.hypot(c.velocity.x, c.velocity.z);
  const base = c.grounded ? COMBAT.spreadStill + COMBAT.spreadPerSpeed * hSpeed : COMBAT.spreadAir;
  return base * lerp(COMBAT.spreadScaleUnstable, COMBAT.spreadScaleStable, bow.stability);
}

export function stepBow(sim: Simulation, c: CharacterState, cmd: InputCommand, dt: number): void {
  const b = c.bow;
  // Troca de arco (só com a corda solta).
  if (cmd.equipBowId && !b.drawing && BOWS[cmd.equipBowId]) b.bowId = cmd.equipBowId;
  const bow = getBow(b.bowId);
  b.cooldown = Math.max(0, b.cooldown - dt);
  if (!cmd.primary) b.waitRelease = false;
  const wanted = targetSpread(c, bow);

  if (!b.drawing) {
    b.spread = damp(b.spread, wanted, COMBAT.spreadConvergeRate, dt);
    if (cmd.primary && !b.waitRelease && b.cooldown <= 0 && c.health > 0) {
      b.drawing = true;
      b.drawTime = 0;
      b.spread = Math.max(b.spread, COMBAT.spreadDrawStart * lerp(COMBAT.spreadScaleUnstable, COMBAT.spreadScaleStable, bow.stability));
    }
    return;
  }

  if (cmd.secondary) {
    endDraw(c);
    b.waitRelease = true;
    return;
  }

  if (cmd.primary) {
    b.drawTime += dt;
    b.spread = damp(b.spread, wanted, COMBAT.spreadConvergeRate, dt);
    // Cansaço: depois de segurar no máximo por `holdTime`, a mira treme cada vez mais.
    const tired = b.drawTime - bow.drawTime - bow.holdTime;
    const amp = tired > 0 ? COMBAT.fatigueMaxSway * Math.min(1, tired / COMBAT.fatigueRampTime) * lerp(1.4, 0.6, bow.stability) : 0;
    const t = b.drawTime;
    b.swayYaw = amp * (Math.sin(t * 2.1) * 0.65 + Math.sin(t * 5.3 + 1.3) * 0.35);
    b.swayPitch = amp * (Math.sin(t * 2.9 + 0.7) * 0.6 + Math.sin(t * 6.1) * 0.4);
    return;
  }

  // Soltou o botão: atira (se puxou o suficiente).
  if (b.drawTime >= COMBAT.minDrawToFire) {
    fireArrow(sim, c, bow);
    b.cooldown = bow.cooldown;
  }
  endDraw(c);
}

function endDraw(c: CharacterState): void {
  c.bow.drawing = false;
  c.bow.drawTime = 0;
  c.bow.swayYaw = 0;
  c.bow.swayPitch = 0;
}

function fireArrow(sim: Simulation, c: CharacterState, bow: BowDef): void {
  const b = c.bow;
  const charge = clamp(b.drawTime / bow.drawTime, 0, 1);

  // 1) Descobre o ponto sob a mira (mesma reta da câmera).
  const origin = aimOrigin(c);
  const aim = aimDirection(c.aimYaw + b.swayYaw, c.aimPitch + b.swayPitch);
  let dist = AIM_RANGE;
  const worldHit = raycast(sim.world, origin.x, origin.y, origin.z, aim.x, aim.y, aim.z, dist);
  if (worldHit) dist = worldHit.distance;
  const hbHit = raycastHitboxes(sim.hitboxes(), origin, aim, dist, 0, c.id);
  if (hbHit) dist = hbHit.distance;
  const target = { x: origin.x + aim.x * dist, y: origin.y + aim.y * dist, z: origin.z + aim.z * dist };

  // 2) A flecha sai do arco em direção a esse ponto.
  const spawn = arrowSpawnPoint(c);
  const speed = lerp(bow.minArrowSpeed, bow.maxArrowSpeed, charge);
  let dir = normalize({ x: target.x - spawn.x, y: target.y - spawn.y, z: target.z - spawn.z });
  // Bots já calculam a balística a partir do arco: atiram na direção da mira.
  // Ponto colado no personagem (ex.: parede encostada): também mira direta.
  if (c.isBot || dist < 2) dir = aim;
  // Mira de sniper: se há algo sob a mira, sobe o tiro o suficiente para a
  // flecha cair exatamente nesse ponto (quando estiver ao alcance).
  else if (COMBAT.compensateDrop && (worldHit || hbHit)) {
    const hx = target.x - spawn.x;
    const hz = target.z - spawn.z;
    const pitch = launchAngleIfReachable(Math.hypot(hx, hz), target.y - spawn.y, speed, COMBAT.arrowGravity);
    if (pitch !== null) dir = aimDirection(Math.atan2(-hx, -hz), pitch);
  }

  // 3) Dispersão: desvio aleatório dentro do cone (zero parado).
  dir = applySpread(dir, b.spread, sim.rng.next(), sim.rng.next());

  let damage = bow.damage * lerp(bow.minDamageFraction, 1, charge);
  // Múltiplas flechas: leque horizontal em volta da direção do tiro.
  const multishot = bow.effect === 'multishot';
  const count = multishot ? EFFECTS.multishotCount : 1;
  if (multishot) damage *= EFFECTS.multishotDamageFraction;
  let id = 0;
  for (let k = 0; k < count; k++) {
    const offset = (k - (count - 1) / 2) * EFFECTS.multishotSpread;
    const d = offset ? rotateY(dir, offset) : dir;
    id = sim.allocArrowId();
    sim.state.arrows.push({
      id,
      ownerId: c.id,
      position: { ...spawn },
      velocity: { x: d.x * speed, y: d.y * speed, z: d.z * speed },
      damage,
      rarity: bow.rarity,
      age: 0,
      stuck: false,
      stuckDir: null,
      stuckToTarget: null,
      trail: getCharacter(c.characterId).arrowTrail,
      effect: bow.effect ?? null,
      pierceLeft: bow.effect === 'piercing' ? EFFECTS.piercingCount : 0,
      bouncesLeft: bow.effect === 'ricochet' ? EFFECTS.ricochetBounces : 0,
      hitIds: [],
    });
  }
  sim.emit({ type: 'shot', ownerId: c.id, arrowId: id, charge });
}

/** Gira um vetor em torno do eixo vertical. */
function rotateY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** Gira `dir` por um ângulo aleatório (distribuição uniforme no disco do cone). */
function applySpread(dir: Vec3, spread: number, r1: number, r2: number): Vec3 {
  if (spread <= 0) return dir;
  const angle = spread * Math.sqrt(r1);
  const theta = r2 * Math.PI * 2;
  // Base ortonormal perpendicular à direção.
  const up = Math.abs(dir.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = normalize({ x: up.y * dir.z - up.z * dir.y, y: up.z * dir.x - up.x * dir.z, z: up.x * dir.y - up.y * dir.x });
  const v = { x: dir.y * u.z - dir.z * u.y, y: dir.z * u.x - dir.x * u.z, z: dir.x * u.y - dir.y * u.x };
  const t = Math.tan(angle);
  const cx = Math.cos(theta) * t;
  const cy = Math.sin(theta) * t;
  return normalize({ x: dir.x + u.x * cx + v.x * cy, y: dir.y + u.y * cx + v.y * cy, z: dir.z + u.z * cx + v.z * cy });
}
