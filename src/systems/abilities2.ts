// Segunda habilidade dos personagens (tecla Q / segundo botão; data/abilities.ts →
// ABILITIES2): ativação, flechas especiais, minas, maldição e o que acontece a cada
// tick. Roda na simulação, igual para jogador e bots (e no servidor online).
import type { Vec3 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { ABILITY2_TUNING as T, getAbility2 } from '../data/abilities';
import { getBow } from '../data/bows';
import { getCharacter } from '../data/characters';
import { isAlive, type CharacterState } from '../entities/CharacterState';
import type { InputCommand } from '../entities/InputCommand';
import { aimDirection, aimOrigin } from './aim';
import { shootFan, type FiredShot } from './bow';
import { raycast } from './collision';
import { applyDamage } from './combat';

/** Alvo vivo (personagem inimigo ou mob) com posição e tipo. */
interface Foe {
  id: string;
  kind: 'character' | 'mob';
  position: Vec3;
  /** Altura do meio do corpo acima dos pés. */
  mid: number;
}

/** Inimigos vivos de `c` (personagens de outro time e mobs). */
function foes(sim: Simulation, c: CharacterState): Foe[] {
  const out: Foe[] = [];
  for (const o of sim.state.characters) {
    if (o === c || !isAlive(o) || o.protection > 0 || sim.sameTeam(c.id, o.id)) continue;
    out.push({ id: o.id, kind: 'character', position: o.position, mid: getCharacter(o.characterId).height * 0.55 });
  }
  for (const m of sim.state.mobs) {
    if (m.mode === 'dead') continue;
    out.push({ id: m.id, kind: 'mob', position: m.position, mid: 0.6 });
  }
  return out;
}

const center = (f: Foe): Vec3 => ({ x: f.position.x, y: f.position.y + f.mid, z: f.position.z });

/** Inimigo mais perto do centro da mira, dentro de `range` m e `cone` rad, sem parede no caminho. */
function aimedFoe(sim: Simulation, c: CharacterState, origin: Vec3, aim: Vec3, range: number, cone: number): Foe | null {
  let best: { f: Foe; score: number } | null = null;
  for (const f of foes(sim, c)) {
    const p = center(f);
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    const dz = p.z - origin.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > range || d < 0.5) continue;
    const angle = Math.acos(Math.min(1, (dx * aim.x + dy * aim.y + dz * aim.z) / d));
    if (angle > cone) continue;
    const wall = raycast(sim.world, origin.x, origin.y, origin.z, dx / d, dy / d, dz / d, d);
    if (wall && wall.distance < d - 0.6) continue;
    // Prefere quem está mais no centro da mira; desempata pela distância.
    const score = angle + d * 0.004;
    if (!best || score < best.score) best = { f, score };
  }
  return best?.f ?? null;
}

/** Aplica `fn` a todos os inimigos a até `radius` m (no plano) de `p`. */
function foesAround(sim: Simulation, c: CharacterState, p: Vec3, radius: number, fn: (f: Foe) => void, maxDy = 3): void {
  for (const f of foes(sim, c)) {
    if (Math.hypot(f.position.x - p.x, f.position.z - p.z) > radius || Math.abs(f.position.y - p.y) > maxDy) continue;
    fn(f);
  }
}

function slow(sim: Simulation, f: Foe, seconds: number): void {
  if (f.kind === 'character') {
    const o = sim.getCharacter(f.id);
    if (o) o.slowTimer = Math.max(o.slowTimer, seconds);
  } else {
    const m = sim.state.mobs.find((x) => x.id === f.id);
    if (m) m.slowTimer = Math.max(m.slowTimer, seconds);
  }
}

export function stepAbility2(sim: Simulation, c: CharacterState, cmd: InputCommand, dt: number): void {
  const def = getAbility2(c.characterId);
  c.ability2Cooldown = Math.max(0, c.ability2Cooldown - dt);
  c.ability2Active = Math.max(0, c.ability2Active - dt);
  if (!cmd.ability2 || c.ability2Cooldown > 0 || !isAlive(c) || sim.state.match.ended) return;
  c.ability2Cooldown = def.cooldown;
  c.ability2Active = def.duration;
  const p = c.position;
  const from = { x: p.x, y: p.y + 1.1, z: p.z };
  let to: Vec3 = { ...from };
  const origin = aimOrigin(c);
  const aim = aimDirection(cmd.aimYaw, cmd.aimPitch);
  const bow = getBow(c.bow.bowId);

  switch (def.kind) {
    case 'orb': {
      // Orbe teleguiado: vai no inimigo mais perto da mira; sem ninguém, sai reto.
      const f = aimedFoe(sim, c, origin, aim, T.orbRange, T.orbCone);
      let dir = aim;
      if (f) {
        const q = center(f);
        const d = Math.hypot(q.x - origin.x, q.y - origin.y, q.z - origin.z);
        dir = { x: (q.x - origin.x) / d, y: (q.y - origin.y) / d, z: (q.z - origin.z) / d };
      }
      const shot = shootFan(sim, c, bow, origin, dir, 1, 0, T.orbDamage, 'magic')[0];
      to = shot.end;
      break;
    }
    case 'feathers': {
      const shots = shootFan(sim, c, bow, origin, aim, T.feathers, T.featherFan, T.featherDamage);
      to = shots[Math.floor(shots.length / 2)].end;
      break;
    }
    case 'tailspin':
      foesAround(sim, c, p, T.tailspinRadius, (f) => {
        applyDamage(sim, f.id, f.kind, T.tailspinDamage, false, c.id, center(f));
        if (f.kind !== 'character') return;
        const o = sim.getCharacter(f.id);
        if (!o || !isAlive(o)) return;
        // Empurrão para fora (usa a "arrancada" forçada; dashHit evita a mordida da Investida).
        const dx = o.position.x - p.x;
        const dz = o.position.z - p.z;
        const l = Math.hypot(dx, dz) || 1;
        o.dashTime = T.tailspinPushTime;
        o.dashVel = { x: (dx / l) * T.tailspinPush, z: (dz / l) * T.tailspinPush };
        o.dashHit = true;
      }, 2);
      break;
    case 'roar':
      foesAround(sim, c, p, T.roarRadius, (f) => {
        slow(sim, f, T.roarSlow);
        applyDamage(sim, f.id, f.kind, T.roarDamage, false, c.id, center(f));
      });
      break;
    case 'prism': {
      // Clarão em cone na frente: ofusca quem estiver dentro (sem parede no meio).
      const fx = -Math.sin(c.aimYaw);
      const fz = -Math.cos(c.aimYaw);
      for (const o of sim.state.characters) {
        if (o === c || !isAlive(o) || sim.sameTeam(c.id, o.id)) continue;
        const dx = o.position.x - p.x;
        const dz = o.position.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > T.prismRange || d < 0.1 || Math.abs(o.position.y - p.y) > 4) continue;
        if (Math.acos(Math.min(1, (dx * fx + dz * fz) / d)) > T.prismCone) continue;
        const wall = raycast(sim.world, p.x, p.y + 1.2, p.z, dx / d, 0, dz / d, d);
        if (wall && wall.distance < d - 0.5) continue;
        o.dazzle = T.prismDuration;
      }
      to = { x: p.x + fx * T.prismRange, y: p.y + 1.2, z: p.z + fz * T.prismRange };
      break;
    }
    case 'mine': {
      const mine = sim.state.mines.filter((m) => m.ownerId === c.id);
      if (mine.length >= T.mineMax) sim.state.mines = sim.state.mines.filter((m) => m !== mine[0]);
      sim.state.mines.push({ id: sim.allocArrowId(), ownerId: c.id, position: { x: p.x, y: p.y, z: p.z }, age: 0 });
      to = { ...p };
      break;
    }
    case 'lasso': {
      const f = aimedFoe(sim, c, origin, aim, T.lassoRange, T.lassoCone);
      if (!f) {
        // Errou: o laço sai para a frente e a recarga é bem menor.
        c.ability2Cooldown = def.cooldown * 0.3;
        to = { x: origin.x + aim.x * T.lassoRange, y: origin.y + aim.y * T.lassoRange, z: origin.z + aim.z * T.lassoRange };
        break;
      }
      to = center(f);
      if (f.kind === 'character') {
        const o = sim.getCharacter(f.id)!;
        o.rooted = Math.max(o.rooted, T.lassoRoot);
        o.velocity.x = o.velocity.z = 0;
        o.dashTime = 0;
      } else slow(sim, f, T.lassoRoot * 2);
      break;
    }
    default:
      break; // curse, roots, chain (próxima flecha), tracker e bloodfrenzy: só a duração
  }
  sim.emit({ type: 'ability2', ownerId: c.id, kind: def.kind, from, to });
}

/**
 * Depois de cada tiro normal: se a flecha especial estiver armada (Flecha Maldita,
 * Raízes, Faísca em Cadeia), ela é gasta neste tiro. `firstEvent`: índice dos
 * eventos antes do tiro (para achar os acertos dele).
 */
export function onShotFired(sim: Simulation, c: CharacterState, shots: FiredShot[], firstEvent: number, damage: number): void {
  if (c.ability2Active <= 0) return;
  const def = getAbility2(c.characterId);
  if (def.kind !== 'curse' && def.kind !== 'roots' && def.kind !== 'chain') return;
  c.ability2Active = 0;
  const hit = sim.events.slice(firstEvent).find((e) => e.type === 'hit' && e.ownerId === c.id);
  const hitTarget = hit && hit.type === 'hit' ? hit : null;
  const end = shots[0]?.end ?? c.position;

  if (def.kind === 'roots') {
    const at = hitTarget ? hitTarget.position : end;
    foesAround(sim, c, at, T.rootsRadius, (f) => slow(sim, f, T.rootsSlow));
    sim.emit({ type: 'ability2', ownerId: c.id, kind: 'roots', from: at, to: at, hit: true });
    return;
  }
  if (!hitTarget) return;
  if (def.kind === 'curse') {
    const o = sim.getCharacter(hitTarget.targetId);
    if (o && isAlive(o)) {
      o.curse = T.curseDuration;
      o.curseOwner = c.id;
    } else applyDamage(sim, hitTarget.targetId, 'mob', T.curseDamage, false, c.id, hitTarget.position);
    sim.emit({ type: 'ability2', ownerId: c.id, kind: 'curse', from: hitTarget.position, to: hitTarget.position, hit: true });
    return;
  }
  // Faísca em Cadeia: salta do alvo para os inimigos mais próximos dele.
  const near = foes(sim, c)
    .filter((f) => f.id !== hitTarget.targetId)
    .map((f) => ({ f, d: Math.hypot(f.position.x - hitTarget.position.x, f.position.y - hitTarget.position.y, f.position.z - hitTarget.position.z) }))
    .filter((x) => x.d <= T.chainRadius)
    .sort((a, b) => a.d - b.d)
    .slice(0, T.chainTargets);
  const points: Vec3[] = [];
  for (const { f } of near) {
    const q = center(f);
    points.push(q);
    applyDamage(sim, f.id, f.kind, damage * T.chainFraction, false, c.id, q);
  }
  sim.emit({ type: 'ability2', ownerId: c.id, kind: 'chain', from: hitTarget.position, to: points[0] ?? hitTarget.position, points, hit: true });
}

/** Desvio do tiro de quem está ofuscado (Prisma de Luz). */
export function dazzleAim(sim: Simulation, c: CharacterState, aim: Vec3): Vec3 {
  if (c.dazzle <= 0) return aim;
  const a = sim.rng.range(-T.prismScatter, T.prismScatter);
  const b = sim.rng.range(-T.prismScatter, T.prismScatter) * 0.6;
  const cy = Math.cos(a);
  const sy = Math.sin(a);
  const x = aim.x * cy + aim.z * sy;
  const z = -aim.x * sy + aim.z * cy;
  const y = aim.y + b;
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
}

/** Tick de tudo que não depende do comando: maldição, laço, ofuscamento e minas. */
export function stepAbility2World(sim: Simulation, dt: number): void {
  for (const c of sim.state.characters) {
    c.rooted = Math.max(0, c.rooted - dt);
    c.dazzle = Math.max(0, c.dazzle - dt);
    if (c.curse <= 0) continue;
    if (!isAlive(c)) {
      c.curse = 0;
      continue;
    }
    // Dano da maldição em pulsos de 1 s (curseDamage no total).
    const before = Math.ceil(c.curse);
    c.curse = Math.max(0, c.curse - dt);
    if (Math.ceil(c.curse) < before && c.curseOwner) {
      applyDamage(sim, c.id, 'character', T.curseDamage / T.curseDuration, false, c.curseOwner, { x: c.position.x, y: c.position.y + 1.6, z: c.position.z });
    }
  }

  if (!sim.state.mines.length) return;
  const keep = [];
  for (const m of sim.state.mines) {
    m.age += dt;
    const owner = sim.getCharacter(m.ownerId);
    if (!owner || m.age > T.mineLife) continue;
    if (m.age >= T.mineArm) {
      let boom = false;
      foesAround(sim, owner, m.position, T.mineRadius * 0.7, () => (boom = true), 2);
      if (boom) {
        foesAround(sim, owner, m.position, T.mineRadius, (f) => {
          slow(sim, f, T.mineSlow);
          applyDamage(sim, f.id, f.kind, T.mineDamage, false, owner.id, center(f));
        }, 2.5);
        sim.emit({ type: 'explosion', position: { x: m.position.x, y: m.position.y + 0.3, z: m.position.z }, radius: T.mineRadius });
        continue;
      }
    }
    keep.push(m);
  }
  sim.state.mines = keep;
}
