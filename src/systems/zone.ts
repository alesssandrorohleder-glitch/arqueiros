// Modo "Último de pé": a zona que fecha (círculos sorteados, um dentro do
// outro), o dano fora dela e o fim da partida quando sobra um só.
import type { Simulation } from '../core/Simulation';
import { ROYALE } from '../data/royale';
import { isAlive } from '../entities/CharacterState';
import { applyDamage } from './combat';

export interface ZoneState {
  /** Círculo atual (centro e raio, m). */
  cx: number;
  cz: number;
  r: number;
  /** Círculo de onde está fechando e para onde vai (o próximo). */
  fromCx: number;
  fromCz: number;
  fromR: number;
  toCx: number;
  toCz: number;
  toR: number;
  /** Fase atual (índice em ROYALE.phases); = phases.length quando já fechou tudo. */
  phase: number;
  /** Fechando agora (senão, esperando). */
  shrinking: boolean;
  /** Tempo restante da espera ou do fechamento (s). */
  timer: number;
  /** Tempo até o próximo pulso de dano (s). */
  tick: number;
}

/** Id usado como "atacante" no dano da zona. */
export const ZONE_ID = 'zone';

/** Zona nova: cobre o mapa todo; o primeiro círculo é sorteado. */
export function newZone(sim: Simulation): ZoneState {
  const z: ZoneState = {
    cx: 0, cz: 0, r: ROYALE.startRadius,
    fromCx: 0, fromCz: 0, fromR: ROYALE.startRadius,
    toCx: 0, toCz: 0, toR: ROYALE.startRadius,
    phase: 0, shrinking: false, timer: ROYALE.phases[0].wait, tick: ROYALE.damageTick,
  };
  pickNext(sim, z);
  return z;
}

/**
 * Sorteia o próximo círculo: inteiro dentro do atual e dentro da área jogável.
 * Assim o fim pode cair no centro ou em qualquer canto do mapa.
 */
function pickNext(sim: Simulation, z: ZoneState): void {
  const phase = ROYALE.phases[z.phase];
  if (!phase) return;
  const newR = phase.radius;
  const limit = sim.map.playableHalfSize - ROYALE.edgePadding;
  const rng = sim.zoneRng;
  let best = { x: z.cx, z: z.cz };
  for (let i = 0; i < 30; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * Math.max(0, z.r - newR);
    const x = z.cx + Math.cos(a) * d;
    const y = z.cz + Math.sin(a) * d;
    if (Math.abs(x) > limit || Math.abs(y) > limit) continue;
    best = { x, z: y };
    break;
  }
  // Se o atual ainda é maior que o mapa, o centro sorteado pode ficar em qualquer lugar da área jogável.
  z.toCx = Math.max(-limit, Math.min(limit, best.x));
  z.toCz = Math.max(-limit, Math.min(limit, best.z));
  z.toR = newR;
}

/** Está dentro da zona? */
export function insideZone(z: ZoneState, x: number, zz: number, margin = 0): boolean {
  return Math.hypot(x - z.cx, zz - z.cz) <= z.r - margin;
}

/** Fase da zona, dano fora dela e fim da partida (último vivo). */
export function stepRoyale(sim: Simulation, dt: number): void {
  const match = sim.state.match;
  const z = match.zone;
  if (!z || match.ended) return;
  const phases = ROYALE.phases;
  if (z.phase < phases.length) {
    z.timer -= dt;
    if (!z.shrinking && z.timer <= 0) {
      z.shrinking = true;
      z.timer = phases[z.phase].shrink;
      z.fromCx = z.cx;
      z.fromCz = z.cz;
      z.fromR = z.r;
      sim.emit({ type: 'zoneShrink', phase: z.phase });
    } else if (z.shrinking) {
      const t = Math.min(1, 1 - z.timer / phases[z.phase].shrink);
      z.cx = z.fromCx + (z.toCx - z.fromCx) * t;
      z.cz = z.fromCz + (z.toCz - z.fromCz) * t;
      z.r = z.fromR + (z.toR - z.fromR) * t;
      if (z.timer <= 0) {
        z.cx = z.toCx;
        z.cz = z.toCz;
        z.r = z.toR;
        z.phase++;
        z.shrinking = false;
        if (z.phase < phases.length) {
          z.timer = phases[z.phase].wait;
          pickNext(sim, z);
        }
      }
    }
  }
  // Dano fora da zona (em pulsos).
  z.tick -= dt;
  if (z.tick <= 0) {
    z.tick = ROYALE.damageTick;
    const dps = phases[Math.min(z.phase, phases.length - 1)].damage;
    for (const c of sim.state.characters) {
      if (!isAlive(c) || insideZone(z, c.position.x, c.position.z)) continue;
      applyDamage(sim, c.id, 'character', dps * ROYALE.damageTick, false, ZONE_ID, { x: c.position.x, y: c.position.y + 1, z: c.position.z });
    }
  }
  // Sobrou um (ou ninguém): fim.
  const alive = sim.state.characters.filter(isAlive);
  if (alive.length <= 1 && sim.state.characters.length > 1) {
    match.ended = true;
    match.winnerId = alive[0]?.id ?? match.out[match.out.length - 1] ?? null;
    sim.emit({ type: 'matchEnd' });
  }
}

/** Colocação de um personagem (1 = vencedor). */
export function placeOf(sim: Simulation, id: string): number {
  const out = sim.state.match.out;
  const i = out.indexOf(id);
  // Ainda vivo (ou o vencedor): 1º por enquanto.
  return i < 0 ? 1 : sim.state.characters.length - i;
}
