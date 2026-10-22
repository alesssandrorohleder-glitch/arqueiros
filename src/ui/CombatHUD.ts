// HUD de combate: vida, dano recebido (com direção), lista de abates, tempo e
// placar, tabela (Tab), tela de eliminado, fim de partida e nomes sobre os bots.
import * as THREE from 'three';
import { getCharacter } from '../data/characters';
import { MOBS } from '../data/mobs';
import type { CharacterState } from '../entities/CharacterState';
import type { MobState } from '../entities/MobState';

const FEED_LIFETIME = 5;
const NAMEPLATE_RANGE = 45;

interface FeedItem { el: HTMLElement; age: number }

export class CombatHUD {
  private readonly healthFill: HTMLElement;
  private readonly healthText: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly indicator: HTMLElement;
  private readonly feed: HTMLElement;
  private readonly matchbar: HTMLElement;
  private readonly board: HTMLElement;
  private readonly boardTitle: HTMLElement;
  private readonly boardBody: HTMLElement;
  private readonly boardButton: HTMLButtonElement;
  private readonly rewards: HTMLElement;
  private readonly deathScreen: HTMLElement;
  private readonly nameLayer: HTMLElement;
  private readonly plates = new Map<string, HTMLElement>();
  /** Revela inimigos (habilidade da Noctua). */
  reveal = false;
  private readonly feedItems: FeedItem[] = [];
  private readonly projected = new THREE.Vector3();
  private hurt = 0;
  private indicatorTime = 0;
  private indicatorAngle = 0;
  private boardHeld = false;
  private online = false;
  private ended = false;

  constructor(root: HTMLElement, onRestart: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="nameplates"></div>
      <div class="vignette"></div>
      <div class="damage-indicator"><div class="arc"></div></div>
      <div class="matchbar"></div>
      <div class="killfeed"></div>
      <div class="healthbar"><div class="fill"></div><span class="value"></span></div>
      <div class="death-screen" hidden></div>
      <div class="scoreboard" hidden>
        <div class="board-panel">
          <h2 class="board-title">Placar</h2>
          <table>
            <thead><tr><th>#</th><th>Arqueiro</th><th>Abates</th><th>Mortes</th></tr></thead>
            <tbody></tbody>
          </table>
          <p class="rewards" hidden></p>
          <button type="button" class="board-button" hidden>Jogar de novo</button>
        </div>
      </div>`,
    );
    this.healthFill = root.querySelector('.healthbar .fill')!;
    this.healthText = root.querySelector('.healthbar .value')!;
    this.vignette = root.querySelector('.vignette')!;
    this.indicator = root.querySelector('.damage-indicator')!;
    this.feed = root.querySelector('.killfeed')!;
    this.matchbar = root.querySelector('.matchbar')!;
    this.board = root.querySelector('.scoreboard')!;
    this.boardTitle = root.querySelector('.board-title')!;
    this.boardBody = root.querySelector('.scoreboard tbody')!;
    this.boardButton = root.querySelector('.board-button')!;
    this.rewards = root.querySelector('.scoreboard .rewards')!;
    this.deathScreen = root.querySelector('.death-screen')!;
    this.nameLayer = root.querySelector('.nameplates')!;
    this.boardButton.addEventListener('click', onRestart);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.boardHeld = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') this.boardHeld = false;
    });
  }

  /** Levou dano: tela vermelha e seta apontando para quem atirou. */
  showDamage(player: CharacterState, attacker: { x: number; z: number } | null, viewYaw: number): void {
    this.hurt = 1;
    if (attacker) {
      const toYaw = Math.atan2(-(attacker.x - player.position.x), -(attacker.z - player.position.z));
      // 0 = em frente; positivo = à esquerda (yaw cresce para a esquerda).
      this.indicatorAngle = -(toYaw - viewYaw);
      this.indicatorTime = 1.4;
    }
  }

  addKill(killer: string, victim: string, headshot: boolean, involvesPlayer: boolean): void {
    const el = document.createElement('div');
    el.className = involvesPlayer ? 'feed-item mine' : 'feed-item';
    el.innerHTML = `<b>${escapeHtml(killer)}</b> <span class="feed-icon">${headshot ? '➶ ◎' : '➶'}</span> <b>${escapeHtml(victim)}</b>`;
    this.feed.prepend(el);
    this.feedItems.push({ el, age: 0 });
    while (this.feedItems.length > 5) this.feedItems.shift()!.el.remove();
  }

  /** Online: a próxima partida começa sozinha (sem "Jogar de novo"). */
  setOnline(online: boolean): void {
    this.online = online;
  }

  /** Mostra o XP ganho no fim da partida. */
  showRewards(html: string): void {
    this.rewards.innerHTML = html;
    this.rewards.hidden = false;
  }

  reset(): void {
    this.ended = false;
    this.rewards.hidden = true;
    this.board.hidden = true;
    this.boardButton.hidden = true;
    for (const f of this.feedItems) f.el.remove();
    this.feedItems.length = 0;
  }

  showEnd(characters: CharacterState[]): void {
    this.ended = true;
    this.fillBoard(characters, this.online ? 'Fim de partida — a próxima começa em instantes' : 'Fim de partida');
    this.boardButton.hidden = this.online;
    this.board.hidden = false;
  }

  update(
    dt: number,
    player: CharacterState,
    characters: CharacterState[],
    timeLeft: number,
    killerName: string | null,
    camera: THREE.Camera,
    mobs: MobState[],
    /** Posição em que cada personagem/mob está desenhado (suavizada); sem ela, usa a da simulação. */
    drawnAt?: (id: string) => { x: number; y: number; z: number } | undefined,
  ): void {
    // Vida.
    const max = getCharacter(player.characterId).maxHealth;
    const frac = Math.max(0, player.health / max);
    this.healthFill.style.transform = `scaleX(${frac})`;
    this.healthFill.classList.toggle('low', frac < 0.35);
    this.healthText.textContent = `${Math.ceil(player.health)}`;

    // Dano recebido.
    this.hurt = Math.max(0, this.hurt - dt * 1.8);
    this.vignette.style.opacity = String(this.hurt * 0.85);
    this.indicatorTime -= dt;
    this.indicator.style.opacity = String(Math.max(0, Math.min(1, this.indicatorTime)));
    this.indicator.style.transform = `translate(-50%, -50%) rotate(${this.indicatorAngle}rad)`;

    // Lista de abates.
    for (let i = this.feedItems.length - 1; i >= 0; i--) {
      const f = this.feedItems[i];
      f.age += dt;
      if (f.age > FEED_LIFETIME) {
        f.el.remove();
        this.feedItems.splice(i, 1);
      } else if (f.age > FEED_LIFETIME - 0.5) {
        f.el.style.opacity = String((FEED_LIFETIME - f.age) * 2);
      }
    }

    // Tempo e posição no placar.
    const ranked = rank(characters);
    const place = ranked.indexOf(player) + 1;
    const m = Math.floor(timeLeft / 60);
    const s = Math.floor(timeLeft % 60);
    this.matchbar.innerHTML =
      `<span class="time${timeLeft < 30 ? ' urgent' : ''}">${m}:${String(s).padStart(2, '0')}</span>` +
      `<span>Abates <b>${player.kills}</b></span><span>Mortes <b>${player.deaths}</b></span>` +
      `<span><b>${place}º</b> de ${characters.length}</span>` +
      (player.matchXp ? `<span class="xp">+${player.matchXp} XP</span>` : '');

    // Tela de eliminado.
    const dead = player.health <= 0 && !this.ended;
    this.deathScreen.hidden = !dead;
    if (dead) {
      this.deathScreen.innerHTML = `<div class="death-title">Eliminado</div>` +
        (killerName ? `<div>por <b>${escapeHtml(killerName)}</b></div>` : '') +
        `<div class="death-timer">Voltando em ${Math.max(0, player.respawnTimer).toFixed(1)} s</div>`;
    }

    // Tabela (Tab) durante a partida.
    if (!this.ended) {
      this.board.hidden = !this.boardHeld;
      if (this.boardHeld) this.fillBoard(characters, 'Placar');
    }

    this.updateNameplates(player, characters, camera, mobs, drawnAt);
  }

  private fillBoard(characters: CharacterState[], title: string): void {
    this.boardTitle.textContent = title;
    this.boardBody.innerHTML = rank(characters)
      .map((c, i) => `<tr class="${c.isBot ? '' : 'me'}"><td>${i + 1}</td><td>${escapeHtml(c.name)} <small>${getCharacter(c.characterId).name}</small></td><td>${c.kills}</td><td>${c.deaths}</td></tr>`)
      .join('');
  }

  private updateNameplates(
    player: CharacterState,
    characters: CharacterState[],
    camera: THREE.Camera,
    mobs: MobState[],
    drawnAt?: (id: string) => { x: number; y: number; z: number } | undefined,
  ): void {
    const seen = new Set<string>();
    for (const c of characters) {
      if (c === player) continue;
      const def = getCharacter(c.characterId);
      this.placeNameplate(seen, c.id, c.name, '', drawnAt?.(c.id) ?? c.position, def.height + 0.25, c.health, def.maxHealth, player, camera);
    }
    for (const m of mobs) {
      if (m.mode === 'dead') continue;
      const def = MOBS[m.typeId];
      // Mobs só mostram nome/vida quando feridos ou perseguindo alguém.
      if (m.health >= def.maxHealth && m.mode !== 'chase' && m.mode !== 'attack') continue;
      this.placeNameplate(seen, m.id, def.name, def.behavior, drawnAt?.(m.id) ?? m.position, def.height + 0.4, m.health, def.maxHealth, player, camera);
    }
    for (const [id, el] of this.plates) {
      if (!seen.has(id)) {
        el.remove();
        this.plates.delete(id);
      }
    }
  }

  private placeNameplate(
    seen: Set<string>,
    id: string,
    name: string,
    kind: string,
    pos: { x: number; y: number; z: number },
    height: number,
    health: number,
    maxHealth: number,
    player: CharacterState,
    camera: THREE.Camera,
  ): void {
    seen.add(id);
    let el = this.plates.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = `nameplate ${kind}`;
      el.innerHTML = `<span class="np-name">${escapeHtml(name)}</span><div class="np-bar"><div class="np-fill"></div></div>`;
      this.nameLayer.appendChild(el);
      this.plates.set(id, el);
    }
    const d = Math.hypot(pos.x - player.position.x, pos.z - player.position.z);
    this.projected.set(pos.x, pos.y + height, pos.z).project(camera);
    // Olhar de Coruja: personagens aparecem marcados de longe (e através das paredes).
    const range = this.reveal && kind === '' ? 160 : NAMEPLATE_RANGE;
    el.classList.toggle('marked', this.reveal && kind === '');
    const visible = health > 0 && d < range && this.projected.z < 1 && Math.abs(this.projected.x) < 1.1 && Math.abs(this.projected.y) < 1.1;
    el.style.display = visible ? '' : 'none';
    if (!visible) return;
    const x = (this.projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.projected.y * 0.5 + 0.5) * window.innerHeight;
    // Encolhe com a distância (de 100% perto até 65% longe).
    const scale = Math.max(0.65, Math.min(1, 1.1 - d / 70));
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
    el.style.opacity = String(Math.min(1, (range - d) / 10));
    (el.querySelector('.np-fill') as HTMLElement).style.transform = `scaleX(${Math.max(0, health / maxHealth)})`;
  }
}

/** Ordena por abates (desempate: menos mortes). */
function rank(characters: CharacterState[]): CharacterState[] {
  return [...characters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}
