// Cérebro de um bot: percebe inimigos, decide o que fazer e gera um
// InputCommand por tick — exatamente o mesmo tipo de comando do jogador.
// Estados: patrulha → combate ↔ cobertura → busca → patrulha.
import { approachAngle, clamp, wrapAngle, type Vec3 } from '../../core/math';
import type { Random } from '../../core/random';
import type { Simulation } from '../../core/Simulation';
import { BOT_CLIMB, DIFFICULTIES, type Difficulty, type DifficultyDef } from '../../data/bots';
import { ABILITY_TUNING, getAbility } from '../../data/abilities';
import { MOBS } from '../../data/mobs';
import { STRUCTURES } from '../../data/objectives';
import type { StructureState } from '../../entities/StructureState';
import { insideAttackArea } from '../objectives';
import { maxHealthOf } from '../levels';
import { ROYALE } from '../../data/royale';
import { isAlive, type CharacterState } from '../../entities/CharacterState';
import type { Combatant } from '../../entities/Combatant';
import { emptyCommand, type InputCommand } from '../../entities/InputCommand';
import { aimOrigin } from '../aim';
import { collidersNear, raycast, raycastColliders, type Collider } from '../collision';

/** climb = subindo a escada de uma árvore anciã; perch = no alto da árvore, atirando. */
export type BotMode = 'patrol' | 'engage' | 'cover' | 'search' | 'climb' | 'perch';

/** Intervalo entre "pensamentos" (percepção/decisão), s. */
const THINK_INTERVAL = 0.1;
/** Distância de teste à frente para desviar de obstáculos (m). */
const PROBE = 2.4;
const AVOID_ANGLES = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6];

export class BotBrain {
  mode: BotMode = 'patrol';
  readonly diff: DifficultyDef;
  private targetId: string | null = null;
  private targetVisible = false;
  private lastSeen: Vec3 | null = null;
  private lastSeenAge = Infinity;
  private waypoint: { x: number; z: number } | null = null;
  private coverPoint: { x: number; z: number } | null = null;
  private coverWait = 0;
  /** Tempo máximo tentando chegar na cobertura (s): se não chegar, desiste. */
  private coverTimeout = 0;
  private coverCooldown = 0;
  private reaction = 0;
  private aimTime = 0;
  private errYaw = 0;
  private errPitch = 0;
  private errTimer = 0;
  private strafeDir = 1;
  private strafeTimer = 0;
  private thinkTimer: number;
  private stuckTimer = 0;
  private stuckRef = { x: 0, z: 0 };
  private avoidBias = 1;
  private yaw = 0;
  private pitch = 0;
  private jumpNext = false;
  /** Árvore que está subindo/ocupando (índice em sim.climbPaths). */
  climbTree: number | null = null;
  private climbStep = 0;
  private climbStuck = 0;
  private perchTimer = 0;
  private abilityThink = 0;
  /** > 0 logo depois de levar dano (s). */
  private hurtRecently = 0;
  /** Modo Gigantes: trilha que o bot empurra (0 = oeste, 1 = leste). */
  private lane = 0;

  constructor(readonly id: string, difficulty: Difficulty, private readonly rng: Random) {
    this.diff = DIFFICULTIES[difficulty];
    this.thinkTimer = rng.range(0, THINK_INTERVAL);
    this.avoidBias = rng.chance(0.5) ? 1 : -1;
  }

  /** Levou dano: fica sabendo de onde veio e talvez procure cobertura. */
  onDamaged(sim: Simulation, self: CharacterState, attackerId: string): void {
    const attacker = sim.getCombatant(attackerId);
    if (!attacker || attacker === self) return;
    // Gigante protegido pelas torres: não adianta revidar.
    if ((attacker as StructureState).kind && !(attacker as StructureState).vulnerable) return;
    this.hurtRecently = 1.5;
    if (!this.targetVisible || this.targetId === null) {
      this.targetId = attackerId;
      this.lastSeen = { ...attacker.position };
      this.lastSeenAge = 0;
      if (this.mode === 'patrol') this.mode = 'search';
    }
    // Subindo ou lá no alto: fica onde está (a árvore já é a posição boa).
    if (this.mode === 'climb' || this.mode === 'perch') return;
    if (this.mode !== 'cover' && this.coverCooldown <= 0 && this.rng.chance(this.diff.coverChance)) {
      this.startCover(sim, self, attacker.position);
    }
  }

  reset(self: CharacterState): void {
    this.lane = this.rng.chance(0.5) ? 0 : 1;
    this.mode = 'patrol';
    this.targetId = null;
    this.targetVisible = false;
    this.lastSeen = null;
    this.waypoint = null;
    this.coverPoint = null;
    this.climbTree = null;
    this.yaw = self.aimYaw;
    this.pitch = 0;
  }

  command(sim: Simulation, self: CharacterState, dt: number): InputCommand {
    const cmd = emptyCommand();
    if (!isAlive(self)) return cmd;

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer += THINK_INTERVAL;
      this.think(sim, self, THINK_INTERVAL);
    }
    this.coverCooldown -= dt;
    this.lastSeenAge += dt;

    const target = this.targetId ? sim.getCombatant(this.targetId) : undefined;
    let moveX = 0;
    let moveZ = 0;
    let lookYaw = this.yaw;
    let lookPitch = 0;
    let sprint = false;

    switch (this.mode) {
      case 'patrol': {
        if (sim.teams) {
          // Modo Gigantes: o objetivo decide para onde ir (refaz a cada pouco).
          if (!this.waypoint || dist2(self.position, this.waypoint) < 9 || this.rng.chance(dt * 0.3)) this.waypoint = this.objectiveWaypoint(sim, self);
          sprint = dist2(self.position, this.waypoint) > 400;
        } else if (!this.waypoint || dist2(self.position, this.waypoint) < 4) {
          if (this.waypoint && this.rng.chance(BOT_CLIMB.chance) && this.startClimb(sim, self)) break;
          this.waypoint = this.randomWaypoint(sim);
        }
        [moveX, moveZ] = this.steer(sim, self, this.waypoint.x, this.waypoint.z);
        break;
      }
      case 'climb': {
        // Segue a escada degrau a degrau (sem desvio: os degraus contariam como obstáculo).
        const path = sim.climbPaths[this.climbTree ?? -1];
        if (!path) {
          this.mode = 'patrol';
          break;
        }
        let p = path[this.climbStep];
        const first = this.climbStep === 0;
        // Até o pé da escada: dá a volta no tronco por fora (não passa por baixo da espiral).
        if (first) {
          const c = sim.climbCenters[this.climbTree!];
          const angSelf = Math.atan2(self.position.z - c.z, self.position.x - c.x);
          const angGoal = Math.atan2(p.z - c.z, p.x - c.x);
          const diff = wrapAngle(angGoal - angSelf);
          const r = Math.hypot(self.position.x - c.x, self.position.z - c.z);
          if (Math.abs(diff) > 0.5 && r < 14) {
            const a = angSelf + Math.sign(diff) * 0.6;
            const ring = Math.max(5.6, Math.min(r, 7));
            [moveX, moveZ] = this.steer(sim, self, c.x + Math.cos(a) * ring, c.z + Math.sin(a) * ring);
          } else {
            [moveX, moveZ] = this.steer(sim, self, p.x, p.z);
          }
        }
        else {
          const dx = p.x - self.position.x;
          const dz = p.z - self.position.z;
          const d = Math.hypot(dx, dz) || 1;
          moveX = dx / d;
          moveZ = dz / d;
        }
        if (dist2(self.position, p) < (first ? 2.5 : 0.5) && self.position.y > p.y - 0.6) {
          this.climbStep++;
          this.climbStuck = 0;
          if (this.climbStep >= path.length) {
            this.mode = 'perch';
            this.perchTimer = this.rng.range(BOT_CLIMB.perchTime[0], BOT_CLIMB.perchTime[1]);
            break;
          }
          p = path[this.climbStep];
        }
        // Caiu da escada ou ficou preso: desiste.
        this.climbStuck += dt;
        if (this.climbStuck > (first ? 25 : 4) || (!first && self.position.y < p.y - 3)) {
          this.climbTree = null;
          this.mode = 'patrol';
          this.waypoint = this.randomWaypoint(sim);
        }
        break;
      }
      case 'perch': {
        // No alto: parado atirando. Acabou o tempo (e ninguém à vista) → pula o parapeito para descer.
        this.perchTimer -= dt;
        if (this.perchTimer <= 0 && !this.targetVisible) {
          const path = sim.climbPaths[this.climbTree ?? -1];
          this.climbTree = null;
          this.mode = 'patrol';
          if (path) {
            const top = path[path.length - 1];
            const base = path[0];
            // Ponto bem para fora da árvore, na direção do parapeito.
            this.waypoint = { x: top.x + (top.x - base.x) * 3, z: top.z + (top.z - base.z) * 3 };
          }
        }
        break;
      }
      case 'search': {
        if (this.lastSeen) {
          [moveX, moveZ] = this.steer(sim, self, this.lastSeen.x, this.lastSeen.z);
          sprint = true;
          if (dist2(self.position, this.lastSeen) < 6) this.lastSeen = null;
        } else {
          this.mode = 'patrol';
        }
        break;
      }
      case 'cover': {
        this.coverTimeout -= dt;
        if (this.coverTimeout <= 0) this.coverPoint = null;
        if (this.coverPoint) {
          if (dist2(self.position, this.coverPoint) > 1.5) {
            [moveX, moveZ] = this.steer(sim, self, this.coverPoint.x, this.coverPoint.z);
            sprint = true;
          } else {
            this.coverWait -= dt;
          }
        }
        if (!this.coverPoint || this.coverWait <= 0) {
          this.mode = this.targetVisible ? 'engage' : 'search';
          this.coverCooldown = 6;
        }
        break;
      }
      case 'engage': {
        if (!target || target.health <= 0) {
          this.mode = 'patrol';
          break;
        }
        // Mantém a distância preferida; perto dela, anda de lado. Torre/gigante: fica dentro do círculo.
        const d = Math.sqrt(dist2(self.position, target.position));
        const sk = (target as StructureState).kind;
        const range = sk ? STRUCTURES[sk].attackArea - 7 : this.diff.preferredRange;
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeTimer = this.rng.range(1.2, 3);
          this.strafeDir = this.rng.chance(0.5) ? 1 : -1;
        }
        const toX = (target.position.x - self.position.x) / Math.max(d, 0.01);
        const toZ = (target.position.z - self.position.z) / Math.max(d, 0.01);
        let wx = 0;
        let wz = 0;
        const far = sk ? 4 : 10;
        const near = sk ? Math.min(range - 2, 4) : 12;
        if (d > range + far) { wx = toX; wz = toZ; }
        else if (d < range - near) { wx = -toX; wz = -toZ; }
        wx += -toZ * this.strafeDir * 0.8;
        wz += toX * this.strafeDir * 0.8;
        [moveX, moveZ] = this.steer(sim, self, self.position.x + wx * 5, self.position.z + wz * 5);
        break;
      }
    }

    // Último de pé: fora da zona (ou quase na borda) corre para dentro, mesmo lutando.
    const zone = sim.state.match.zone;
    if (zone && this.mode !== 'perch' && this.mode !== 'climb') {
      const dz = Math.hypot(self.position.x - zone.cx, self.position.z - zone.cz);
      if (dz > zone.r - ROYALE.botEdgeMargin) {
        // Vai para o centro do próximo círculo (que fica dentro do atual).
        [moveX, moveZ] = this.steer(sim, self, zone.toCx, zone.toCz);
        sprint = !self.bow.drawing;
      }
    }

    // Olha para onde anda, a menos que esteja mirando.
    if (moveX !== 0 || moveZ !== 0) lookYaw = Math.atan2(-moveX, -moveZ);

    // ---- Arco (tiro automático) ----
    // Depois do tempo de reação, mira no peito e segura o tiro enquanto vê o
    // alvo. O erro de mira muda a cada pouco tempo (rajadas não são perfeitas).
    let primary = false;
    const secondary = false;
    // Na árvore (subindo ou no alto) também atira em quem estiver à vista.
    const onTree = this.mode === 'climb' || this.mode === 'perch';
    const engaging = (this.mode === 'engage' || (onTree && this.targetVisible)) && target && target.health > 0;
    if (engaging && target) {
      if (this.targetVisible) this.reaction += dt;
      else this.reaction = Math.min(this.reaction, this.diff.reactionTime * 0.5);
      this.aimTime += dt;
      this.errTimer -= dt;
      if (this.errTimer <= 0) {
        this.errTimer = 0.35;
        this.resampleError(self, target);
      }
      const shot = this.aimSolution(self, target);
      const settle = clamp(this.aimTime / this.diff.settleTime, 0, 1);
      const errScale = 1 + 1.5 * (1 - settle);
      lookYaw = shot.yaw + this.errYaw * errScale;
      lookPitch = shot.pitch + this.errPitch * errScale;
      primary = this.targetVisible && this.reaction >= this.diff.reactionTime;
    } else {
      this.reaction = 0;
      this.aimTime = 0;
    }

    // Gira a mira com velocidade limitada (bots não viram instantaneamente).
    const turn = (engaging ? 7 : 4) * dt;
    this.yaw = approachAngle(this.yaw, lookYaw, turn);
    this.pitch += clamp(lookPitch - this.pitch, -turn, turn);

    // Converte o movimento (mundo) para frente/lado relativos à mira.
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    cmd.forward = moveX * fx + moveZ * fz;
    cmd.right = moveX * -fz + moveZ * fx;
    cmd.sprint = sprint && !self.bow.drawing;
    cmd.aimYaw = this.yaw;
    cmd.aimPitch = this.pitch;
    cmd.primary = primary;
    cmd.secondary = secondary;
    cmd.jump = this.jumpNext;
    this.jumpNext = false;
    cmd.ability = this.decideAbility(self, target, dt);
    return cmd;
  }

  /** Quando usar a habilidade do personagem (data/abilities.ts). */
  private decideAbility(self: CharacterState, target: Combatant | undefined, dt: number): boolean {
    this.hurtRecently = Math.max(0, this.hurtRecently - dt);
    this.abilityThink -= dt;
    if (this.abilityThink > 0 || self.abilityCooldown > 0) return false;
    this.abilityThink = 0.4;
    const ab = getAbility(self.characterId);
    const hp = self.health / maxHealthOf(self);
    const seen = this.targetVisible && !!target && target.health > 0;
    const d = target ? Math.hypot(target.position.x - self.position.x, target.position.z - self.position.z) : Infinity;
    const onTree = this.mode === 'climb' || this.mode === 'perch';
    switch (ab.kind) {
      case 'shield':
      case 'bonearmor':
      case 'regen':
        return hp < 0.6 && (seen || this.hurtRecently > 0);
      case 'lifesteal':
      case 'hawkeye':
      case 'overclock':
        return seen && this.rng.chance(0.6);
      case 'emp':
        return seen && d < ABILITY_TUNING.empRadius - 0.5;
      case 'charge':
        return seen && !onTree && d > 2 && d < 9;
      case 'dash':
      case 'blink':
      case 'jetpack':
        return !onTree && this.hurtRecently > 0 && this.rng.chance(0.45);
    }
  }

  // ------------------------------------------------------------------ percepção

  private think(sim: Simulation, self: CharacterState, dt: number): void {
    // Preso? Pula e muda de rumo.
    const moved = Math.hypot(self.position.x - this.stuckRef.x, self.position.z - this.stuckRef.z);
    this.stuckTimer += dt;
    if (this.stuckTimer > 1.2) {
      const parked = this.mode === 'engage' || this.mode === 'perch' || (this.mode === 'climb' && this.climbStep > 0) || (this.mode === 'cover' && this.coverWait < 3);
      if (moved < 0.6 && !parked) {
        this.jumpNext = true;
        this.avoidBias *= -1;
        this.waypoint = null;
      }
      this.stuckTimer = 0;
      this.stuckRef = { x: self.position.x, z: self.position.z };
    }

    const seen = this.findVisibleEnemy(sim, self);
    this.targetVisible = !!seen;
    if (seen) {
      if (seen.id !== this.targetId) {
        this.reaction = 0;
        this.targetId = seen.id;
      }
      this.lastSeen = { ...seen.position };
      this.lastSeenAge = 0;
      const lowHealth = self.health / maxHealthOf(self) < this.diff.lowHealth;
      if (this.mode === 'climb' || this.mode === 'perch') {
        // continua na árvore, só atualiza o alvo
      } else if (this.mode !== 'cover') {
        if (lowHealth && this.coverCooldown <= 0 && !self.bow.drawing) this.startCover(sim, self, seen.position);
        else this.mode = 'engage';
      }
    } else if (this.mode === 'engage') {
      this.mode = this.lastSeen && this.lastSeenAge < 6 ? 'search' : 'patrol';
    }
  }

  private findVisibleEnemy(sim: Simulation, self: CharacterState): Combatant | null {
    let best: Combatant | null = null;
    let bestD = Infinity;
    const eyeY = self.position.y + 1.6;
    for (const c of sim.state.characters) {
      if (c === self || !isAlive(c) || sim.sameTeam(self.id, c.id)) continue;
      const dx = c.position.x - self.position.x;
      const dz = c.position.z - self.position.z;
      const d = Math.hypot(dx, dz);
      if (d > this.diff.visionRange || d >= bestD) continue;
      // Campo de visão (perto demais = "ouve").
      const angle = Math.abs(wrapAngle(Math.atan2(-dx, -dz) - this.yaw));
      if (d > 8 && angle > (this.diff.visionFov * Math.PI) / 360) continue;
      if (!this.lineOfSight(sim, self.position.x, eyeY, self.position.z, c.position.x, c.position.y + 1.3, c.position.z)) continue;
      best = c;
      bestD = d;
    }
    // Mobs: só os que estão atacando este bot ou hostis bem perto.
    for (const m of sim.state.mobs) {
      if (m.mode === 'dead' || sim.sameTeam(self.id, m.id)) continue;
      const d = Math.hypot(m.position.x - self.position.x, m.position.z - self.position.z);
      // Tropas inimigas (modo Gigantes) também são alvo quando estão perto.
      const threat = m.targetId === self.id || (MOBS[m.typeId].behavior === 'hostile' && d < (m.team !== undefined ? 18 : 15));
      // Prefere personagens: mobs "parecem" 6 m mais longe.
      if (!threat || d > 30 || d + 6 >= bestD) continue;
      if (!this.lineOfSight(sim, self.position.x, eyeY, self.position.z, m.position.x, m.position.y + 0.6, m.position.z)) continue;
      best = m;
      bestD = d + 6;
    }
    // Torres e gigante inimigos (se já dá para ferir): de perto (até 30 m) têm prioridade sobre
    // personagens, como num MOBA (o objetivo vale mais); de longe, "parecem" 10 m mais longe.
    for (const st of sim.state.structures) {
      if (st.destroyed || !st.vulnerable || st.team === self.team) continue;
      const def = STRUCTURES[st.kind];
      const d = Math.hypot(st.position.x - self.position.x, st.position.z - self.position.z) - def.radius;
      // Só adianta atirar de dentro do círculo de ataque da estrutura.
      if (!insideAttackArea(st, self.position)) continue;
      const score = d < 30 ? d - 25 : d + 10;
      if (score >= bestD) continue;
      if (!this.lineOfSight(sim, self.position.x, eyeY, self.position.z, st.position.x, st.position.y + def.height * 0.6, st.position.z)) continue;
      best = st;
      bestD = score;
    }
    return best;
  }

  /**
   * Modo Gigantes: para onde ir. Pouca vida → volta para a base; estrutura do
   * time atacada → defende; senão, avança pela trilha até a próxima torre
   * inimiga (ou o gigante, quando as torres caírem), parando a uma distância de tiro.
   */
  private objectiveWaypoint(sim: Simulation, self: CharacterState): { x: number; z: number } {
    const p = self.position;
    const own = self.team;
    const back = own === 0 ? 1 : -1; // direção (z) da própria base
    if (self.health / maxHealthOf(self) < this.diff.lowHealth) {
      const sp = sim.teamSpawn(own, 0);
      return { x: sp.x, z: sp.z };
    }
    // Defesa: estrutura do time com inimigos em volta.
    let defend: StructureState | null = null;
    let defendD = 70 * 70;
    for (const st of sim.state.structures) {
      if (st.destroyed || st.team !== own) continue;
      const near = (q: { x: number; z: number }) => Math.hypot(q.x - st.position.x, q.z - st.position.z) < 24;
      const threatened = sim.state.characters.some((c) => c.team !== own && isAlive(c) && near(c.position))
        || sim.state.mobs.some((m) => m.mode !== 'dead' && m.team !== undefined && m.team !== own && near(m.position));
      const d = dist2(p, st.position);
      if (threatened && d < defendD) {
        defendD = d;
        defend = st;
      }
    }
    if (defend) return { x: defend.position.x + this.rng.range(-6, 6), z: defend.position.z + back * this.rng.range(4, 10) };
    // Ataque: torre inimiga da trilha (ou da outra), depois o gigante.
    const towers = sim.state.structures.filter((st) => st.kind === 'tower' && st.team !== own && !st.destroyed);
    const inLane = towers.filter((t) => (this.lane === 0 ? t.position.x < 0 : t.position.x > 0));
    const goal = inLane[0] ?? towers[0] ?? sim.state.structures.find((st) => st.kind === 'giant' && st.team !== own);
    if (!goal) return { x: p.x, z: p.z };
    // Ponto dentro do círculo de ataque (do lado da própria base).
    const area = STRUCTURES[goal.kind].attackArea;
    return { x: goal.position.x + this.rng.range(-4, 4), z: goal.position.z + back * this.rng.range(area * 0.45, area - 4) };
  }

  private lineOfSight(sim: Simulation, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    const hit = raycast(sim.world, ax, ay, az, dx / len, dy / len, dz / len, len);
    return !hit || hit.distance > len - 0.3;
  }

  // ------------------------------------------------------------------ mira

  private resampleError(self: CharacterState, target: Combatant): void {
    const d = Math.sqrt(dist2(self.position, target.position));
    const sigma = this.diff.aimError * (1 + d / 70);
    this.errYaw = gaussian(this.rng) * sigma;
    this.errPitch = gaussian(this.rng) * sigma * 0.8;
  }

  /** Ângulos (a partir do ponto da mira) para o peito do alvo: o tiro é instantâneo. */
  private aimSolution(self: CharacterState, target: Combatant) {
    const from = aimOrigin(self);
    const mobType = (target as { typeId?: string }).typeId;
    const structure = (target as StructureState).kind;
    const aimHeight = structure ? STRUCTURES[structure].height * 0.6 : mobType ? MOBS[mobType].height * 0.55 : 1.15;
    const dx = target.position.x - from.x;
    const dz = target.position.z - from.z;
    const dy = target.position.y + aimHeight - from.y;
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  }

  // ------------------------------------------------------------------ movimento

  /** Direção (unitária no plano) para ir até (gx, gz) desviando de obstáculos. */
  private steer(sim: Simulation, self: CharacterState, gx: number, gz: number): [number, number] {
    const dx = gx - self.position.x;
    const dz = gz - self.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) return [0, 0];
    const base = Math.atan2(dz, dx);
    const y = self.position.y;
    for (const off of AVOID_ANGLES) {
      const a = base + off * this.avoidBias;
      const ux = Math.cos(a);
      const uz = Math.sin(a);
      const blockedLow = raycastColliders(sim.world, self.position.x, y + 0.6, self.position.z, ux, 0, uz, PROBE) >= 0;
      const blockedHigh = raycastColliders(sim.world, self.position.x, y + 1.4, self.position.z, ux, 0, uz, PROBE) >= 0;
      if (!blockedLow && !blockedHigh) return [ux, uz];
      // Obstáculo baixo (só embaixo): pula por cima.
      if (off === 0 && blockedLow && !blockedHigh) {
        this.jumpNext = true;
        return [ux, uz];
      }
    }
    return [Math.cos(base), Math.sin(base)];
  }

  /** Escolhe a árvore livre mais próxima e começa a subir. */
  private startClimb(sim: Simulation, self: CharacterState): boolean {
    let best = -1;
    let bestD = BOT_CLIMB.maxDistance ** 2;
    sim.climbPaths.forEach((path, i) => {
      for (const b of sim.bots.values()) if (b !== this && b.climbTree === i) return; // já ocupada
      const d = dist2(self.position, path[0]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) return false;
    this.climbTree = best;
    this.climbStep = 0;
    this.climbStuck = 0;
    this.mode = 'climb';
    return true;
  }

  private randomWaypoint(sim: Simulation): { x: number; z: number } {
    // Último de pé: passeia dentro do próximo círculo da zona.
    const zone = sim.state.match.zone;
    if (zone) {
      const r = Math.max(3, Math.min(zone.r, zone.toR) * 0.8);
      const a = this.rng.range(0, Math.PI * 2);
      const d = Math.sqrt(this.rng.next()) * r;
      return { x: zone.toCx + Math.cos(a) * d, z: zone.toCz + Math.sin(a) * d };
    }
    const b = sim.world.bounds - 8;
    return { x: this.rng.range(-b, b), z: this.rng.range(-b, b) };
  }

  /** Procura um ponto atrás de algo (árvore, pedra, muro) em relação à ameaça. */
  private startCover(sim: Simulation, self: CharacterState, threat: Vec3): void {
    const candidates: { c: Collider; d: number }[] = [];
    const p = self.position;
    for (const c of collidersNear(sim.world, p.x - 22, p.z - 22, p.x + 22, p.z + 22)) {
      if (c.bound < 0.25 || c.bound > 7 || c.maxY - c.minY < 1.4) continue;
      const d = Math.hypot(c.x - self.position.x, c.z - self.position.z);
      if (d < 22) candidates.push({ c, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const { c } of candidates.slice(0, 20)) {
      const ax = c.x - threat.x;
      const az = c.z - threat.z;
      const al = Math.hypot(ax, az) || 1;
      const off = c.bound + 0.4 + 0.7;
      const px = c.x + (ax / al) * off;
      const pz = c.z + (az / al) * off;
      if (Math.abs(px) > sim.world.bounds - 2 || Math.abs(pz) > sim.world.bounds - 2) continue;
      const py = sim.world.terrain.sample(px, pz);
      if (!this.lineOfSight(sim, threat.x, threat.y + 1.6, threat.z, px, py + 1.2, pz)) {
        this.coverPoint = { x: px, z: pz };
        this.coverWait = this.rng.range(1.5, 3.5);
        this.coverTimeout = 8;
        this.mode = 'cover';
        return;
      }
    }
  }
}

function dist2(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

/** Normal padrão (Box-Muller) a partir do gerador com semente. */
function gaussian(rng: Random): number {
  const u = Math.max(1e-6, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
