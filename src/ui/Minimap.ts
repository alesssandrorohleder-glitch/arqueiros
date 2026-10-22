// Minimapa (canto superior esquerdo): o mapa visto de cima, com trilhas,
// florestas, ruínas, torres e gigantes de cada time, você (seta para onde a
// câmera olha), aliados e tropas aliadas. Inimigos só aparecem quando você ou
// alguém do seu time consegue vê-los (linha de visão, ou bem perto).
// O fundo é desenhado uma vez; os pontos, algumas vezes por segundo.
import type { Simulation } from '../core/Simulation';
import type { MapDef } from '../data/maps/arena';
import { STRUCTURES, TEAMS } from '../data/objectives';
import { isAlive, type CharacterState } from '../entities/CharacterState';
import { raycast } from '../systems/collision';

/** Até onde um aliado "enxerga" um inimigo para mostrá-lo no minimapa (m). */
const SPOT_RANGE = 55;
/** Perto assim, o inimigo aparece mesmo sem linha de visão (m). */
const HEAR_RANGE = 12;
/** Atualizações dos inimigos visíveis por segundo (os raios de visão custam). */
const SPOT_RATE = 4;

export class Minimap {
  private readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement | null = null;
  private map: MapDef | null = null;
  private readonly size: number;
  private spotTimer = 0;
  /** Inimigos (personagens e tropas) visíveis para o time do jogador. */
  private spotted = new Set<string>();

  constructor(root: HTMLElement, small: boolean) {
    this.size = small ? 118 : 160;
    root.insertAdjacentHTML('beforeend', `<div class="minimap" aria-hidden="true"><canvas></canvas></div>`);
    this.el = root.querySelector('.minimap')!;
    this.canvas = this.el.querySelector('canvas')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = this.canvas.height = Math.round(this.size * dpr);
    this.canvas.style.width = this.canvas.style.height = `${this.size}px`;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  setVisible(v: boolean): void {
    this.el.hidden = !v;
  }

  /** Mundo (x, z) → pixel. Norte (-Z) para cima. */
  private toPx(x: number, z: number): [number, number] {
    const half = this.map!.playableHalfSize;
    return [((x + half) / (half * 2)) * this.size, ((z + half) / (half * 2)) * this.size];
  }

  /** Desenha o fundo (terreno, trilhas, florestas, ruínas) quando o mapa muda. */
  private drawBackground(map: MapDef): void {
    this.map = map;
    const c = document.createElement('canvas');
    c.width = c.height = this.canvas.width;
    const g = c.getContext('2d')!;
    const k = c.width / this.size;
    g.scale(k, k);
    const S = this.size;
    const half = map.playableHalfSize;
    const px = (m: number) => (m / (half * 2)) * S;
    g.fillStyle = '#3f5a2c';
    g.fillRect(0, 0, S, S);
    // Lados dos times (modo Gigantes): metade de cima vermelha, de baixo azul, bem de leve.
    if (map.structures.length) {
      g.fillStyle = 'rgba(255, 60, 40, 0.10)';
      g.fillRect(0, 0, S, S / 2);
      g.fillStyle = 'rgba(60, 140, 255, 0.10)';
      g.fillRect(0, S / 2, S, S / 2);
    }
    for (const f of map.forests) {
      const [x, y] = this.toPx(f.x, f.z);
      g.fillStyle = 'rgba(20, 40, 18, 0.55)';
      g.beginPath();
      g.arc(x, y, px(f.radius), 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(190, 160, 110, 0.75)';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const p of map.paths) {
      g.lineWidth = Math.max(1.5, px(p.width));
      g.beginPath();
      p.points.forEach(([x, z], i) => {
        const [a, b] = this.toPx(x, z);
        if (i === 0) g.moveTo(a, b);
        else g.lineTo(a, b);
      });
      g.stroke();
    }
    g.fillStyle = 'rgba(205, 200, 185, 0.8)';
    for (const r of map.ruins) {
      const [x, y] = this.toPx(r.x, r.z);
      const s = Math.max(2.5, px(r.kind === 'temple' ? 16 : 6));
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
    g.fillStyle = 'rgba(120, 90, 50, 0.9)';
    for (const t of map.climbTrees) {
      const [x, y] = this.toPx(t.x, t.z);
      g.beginPath();
      g.arc(x, y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    this.background = c;
  }

  /** Quais inimigos o time do jogador está vendo agora. */
  private spot(sim: Simulation, me: CharacterState): void {
    const set = new Set<string>();
    const watchers = sim.state.characters.filter((c) => isAlive(c) && (c === me || sim.sameTeam(c.id, me.id)));
    const sees = (x: number, y: number, z: number): boolean => {
      for (const w of watchers) {
        const dx = x - w.position.x;
        const dy = y - (w.position.y + 1.6);
        const dz = z - w.position.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < HEAR_RANGE) return true;
        if (d > SPOT_RANGE) continue;
        const hit = raycast(sim.world, w.position.x, w.position.y + 1.6, w.position.z, dx / d, dy / d, dz / d, d);
        if (!hit || hit.distance > d - 0.5) return true;
      }
      return false;
    };
    for (const c of sim.state.characters) {
      if (c === me || !isAlive(c) || sim.sameTeam(c.id, me.id)) continue;
      if (sees(c.position.x, c.position.y + 1.2, c.position.z)) set.add(c.id);
    }
    for (const m of sim.state.mobs) {
      if (m.mode === 'dead' || m.team === undefined || m.team === me.team) continue;
      if (sees(m.position.x, m.position.y + 0.8, m.position.z)) set.add(m.id);
    }
    this.spotted = set;
  }

  update(dt: number, sim: Simulation, me: CharacterState, viewYaw: number): void {
    if (this.el.hidden) return;
    if (this.map !== sim.map) {
      this.drawBackground(sim.map);
      this.spotTimer = 0;
    }
    this.spotTimer -= dt;
    if (this.spotTimer <= 0) {
      this.spotTimer = 1 / SPOT_RATE;
      this.spot(sim, me);
    }
    const g = this.ctx;
    const S = this.size;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.background!, 0, 0, S, S);

    // Torres e gigantes.
    for (const st of sim.state.structures) {
      const [x, y] = this.toPx(st.position.x, st.position.z);
      const color = TEAMS[st.team].css;
      if (st.destroyed) {
        g.strokeStyle = 'rgba(30, 30, 30, 0.8)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x - 3, y - 3);
        g.lineTo(x + 3, y + 3);
        g.moveTo(x + 3, y - 3);
        g.lineTo(x - 3, y + 3);
        g.stroke();
        continue;
      }
      // Círculo de ataque, bem fraco.
      g.strokeStyle = color;
      g.globalAlpha = 0.35;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, (STRUCTURES[st.kind].attackArea / (sim.map.playableHalfSize * 2)) * S, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = color;
      g.strokeStyle = '#111';
      g.lineWidth = 1;
      if (st.kind === 'giant') {
        // Gigante: losango grande com contorno claro se está vulnerável.
        g.beginPath();
        g.moveTo(x, y - 6);
        g.lineTo(x + 6, y);
        g.lineTo(x, y + 6);
        g.lineTo(x - 6, y);
        g.closePath();
        g.fill();
        g.strokeStyle = st.vulnerable ? '#fff' : '#111';
        g.stroke();
      } else {
        g.fillRect(x - 3.5, y - 3.5, 7, 7);
        g.strokeRect(x - 3.5, y - 3.5, 7, 7);
      }
    }

    // Tropas (aliadas sempre; inimigas só se vistas).
    for (const m of sim.state.mobs) {
      if (m.mode === 'dead' || m.team === undefined) continue;
      if (m.team !== me.team && !this.spotted.has(m.id)) continue;
      const [x, y] = this.toPx(m.position.x, m.position.z);
      g.fillStyle = TEAMS[m.team].css;
      g.fillRect(x - 1, y - 1, 2, 2);
    }

    // Personagens: aliados sempre (azul); inimigos só se vistos (vermelho).
    for (const c of sim.state.characters) {
      if (c === me || !isAlive(c)) continue;
      const ally = sim.sameTeam(c.id, me.id);
      if (!ally && !this.spotted.has(c.id)) continue;
      const [x, y] = this.toPx(c.position.x, c.position.z);
      g.fillStyle = ally ? TEAMS[0].css : TEAMS[1].css;
      g.strokeStyle = '#000';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    // Você: cone de visão e seta para onde a câmera olha.
    const [px, py] = this.toPx(me.position.x, me.position.z);
    // yaw 0 = norte (-Z, para cima na tela); cresce para a esquerda.
    const ang = -Math.PI / 2 - viewYaw;
    g.fillStyle = 'rgba(255, 240, 200, 0.16)';
    g.beginPath();
    g.moveTo(px, py);
    g.arc(px, py, 26, ang - 0.6, ang + 0.6);
    g.closePath();
    g.fill();
    g.save();
    g.translate(px, py);
    g.rotate(ang + Math.PI / 2);
    g.fillStyle = isAlive(me) ? '#ffd76a' : '#888';
    g.strokeStyle = '#000';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(0, 2.5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
