// HUD de combate: vida, dano recebido (com direção), lista de abates, tempo e
// placar, tabela (Tab), tela de eliminado, fim de partida e nomes sobre os bots.
import * as THREE from 'three';
import { getCharacter } from '../data/characters';
import { MOBS } from '../data/mobs';
import type { CharacterState } from '../entities/CharacterState';
import type { MobState } from '../entities/MobState';
import { MATCH } from '../data/match';
import { levelProgress, maxHealthOf } from '../systems/levels';
import { STRUCTURES, SURRENDER, TEAMS, type Team } from '../data/objectives';
import type { StructureState } from '../entities/StructureState';

/** Estado da partida para o HUD (tempo, modo, estruturas, votação). */
export interface MatchView {
  teams: boolean;
  elapsed: number;
  structures: StructureState[];
  /** Último de pé: vivos, zona e colocação (null nos outros modos). */
  royale: { alive: number; total: number; zoneText: string; shrinking: boolean; outside: boolean; place: number; spectating: string | null } | null;
  /** Votação do time do jogador: votos e tempo (null = nenhuma). */
  vote: { yes: number; no: number; total: number; timeLeft: number; myVote: boolean | null; mine: boolean } | null;
}

const FEED_LIFETIME = 5;
/** Avisos de abate na tela ao mesmo tempo. */
const FEED_MAX = 4;

/** Um lado do aviso de abate: nome e foto (chave de Portraits) ou ícone. */
export interface FeedSide {
  name: string;
  portrait?: string | null;
  icon?: string;
}
const NAMEPLATE_RANGE = 45;

interface FeedItem { el: HTMLElement; age: number }

export class CombatHUD {
  private readonly healthFill: HTMLElement;
  private readonly healthText: HTMLElement;
  private readonly levelText: HTMLElement;
  private readonly levelFill: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly indicator: HTMLElement;
  private readonly feed: HTMLElement;
  /** Foto (data URL) da cabeça para uma chave de Portraits, ou null se ainda não há. */
  portraitUrl: (key: string) => string | null = () => null;
  private readonly matchbar: HTMLElement;
  private readonly board: HTMLElement;
  private readonly boardTitle: HTMLElement;
  private readonly boardBody: HTMLElement;
  /** Botões do fim de partida (Jogar de novo / Voltar ao menu). */
  private readonly boardButton: HTMLElement;
  private readonly rewards: HTMLElement;
  private readonly deathScreen: HTMLElement;
  private readonly nameLayer: HTMLElement;
  private readonly plates = new Map<string, HTMLElement>();
  /** Revela inimigos (habilidade da Noctua). */
  reveal = false;
  /** Personagens marcados um a um (maldição, satélite, frenesi): aparecem através das paredes. */
  revealIds = new Set<string>();
  private readonly feedItems: FeedItem[] = [];
  private readonly projected = new THREE.Vector3();
  private hurt = 0;
  private indicatorTime = 0;
  private indicatorAngle = 0;
  private boardHeld = false;
  private online = false;
  private ended = false;
  private readonly voteBox: HTMLElement;
  /** Votar pela tela (toque/clique): true = sim. */
  onVote: ((yes: boolean) => void) | null = null;
  private lastVoteHtml = '';

  private readonly watchButton: HTMLButtonElement;
  private readonly zoneTint: HTMLElement;
  /** "Assistir" (Último de pé, depois de ser eliminado). */
  onWatch: (() => void) | null = null;
  private royaleMode = false;
  private midBoard = false;
  /** Último de pé: colocação de cada um (ordena o placar). */
  placeFn: ((c: CharacterState) => number) | null = null;

  constructor(root: HTMLElement, onRestart: () => void, onMenu: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="nameplates"></div>
      <div class="vignette"></div>
      <div class="damage-indicator"><div class="arc"></div></div>
      <div class="matchbar"></div>
      <div class="killfeed"></div>
      <div class="healthbar"><div class="fill"></div><span class="value"></span></div>
      <div class="level-badge" title="Nível na partida"><span class="lv"></span><div class="lv-bar"><div class="lv-fill"></div></div></div>
      <div class="death-screen" hidden></div>
      <div class="vote-box" hidden></div>
      <div class="win-banner" hidden><div class="win-title"></div><div class="win-sub"></div></div>
      <div class="scoreboard" hidden>
        <div class="board-panel">
          <h2 class="board-title">Placar</h2>
          <table>
            <thead><tr><th>#</th><th>Arqueiro</th><th>Nv</th><th>Abates</th><th>Assist.</th><th>Mortes</th></tr></thead>
            <tbody></tbody>
          </table>
          <p class="rewards" hidden></p>
          <div class="board-actions" hidden>
            <button type="button" class="board-button secondary board-watch" hidden>Assistir</button>
            <button type="button" class="board-button">Jogar de novo</button>
            <button type="button" class="board-button secondary">Voltar ao menu</button>
          </div>
        </div>
      </div>`,
    );
    this.healthFill = root.querySelector('.healthbar .fill')!;
    this.healthText = root.querySelector('.healthbar .value')!;
    this.levelText = root.querySelector('.level-badge .lv')!;
    this.levelFill = root.querySelector('.level-badge .lv-fill')!;
    this.vignette = root.querySelector('.vignette')!;
    this.indicator = root.querySelector('.damage-indicator')!;
    this.feed = root.querySelector('.killfeed')!;
    this.matchbar = root.querySelector('.matchbar')!;
    window.addEventListener('resize', () => this.layoutFeed());
    this.board = root.querySelector('.scoreboard')!;
    this.boardTitle = root.querySelector('.board-title')!;
    this.boardBody = root.querySelector('.scoreboard tbody')!;
    this.boardButton = root.querySelector('.board-actions')!;
    this.rewards = root.querySelector('.scoreboard .rewards')!;
    this.deathScreen = root.querySelector('.death-screen')!;
    this.nameLayer = root.querySelector('.nameplates')!;
    this.voteBox = root.querySelector('.vote-box')!;
    this.voteBox.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-vote]');
      if (b) this.onVote?.(b.dataset.vote === 'yes');
    });
    root.querySelector('.board-button:not(.secondary)')!.addEventListener('click', onRestart);
    root.querySelector('.board-button.secondary:not(.board-watch)')!.addEventListener('click', onMenu);
    this.watchButton = root.querySelector('.board-watch')!;
    this.watchButton.addEventListener('click', () => {
      this.board.hidden = true;
      this.ended = false;
      this.onWatch?.();
    });
    this.zoneTint = document.createElement('div');
    this.zoneTint.className = 'zone-tint';
    this.zoneTint.hidden = true;
    this.zoneTint.innerHTML = '<span>Fora da zona! Volte para o círculo</span>';
    root.appendChild(this.zoneTint);

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

  /**
   * Aviso de abate (topo, no centro): cabeça de quem abateu num círculo azul, a de
   * quem foi abatido num círculo vermelho. Sem foto ainda: a inicial do nome (ou
   * um ícone, para criaturas e torres).
   */
  addKill(killer: FeedSide, victim: FeedSide, headshot: boolean, involvesPlayer: boolean, assists: string[] = []): void {
    const el = document.createElement('div');
    el.className = involvesPlayer ? 'feed-item mine' : 'feed-item';
    const help = assists.length ? `<span class="feed-assist">+ ${assists.map(escapeHtml).join(', ')}</span>` : '';
    el.innerHTML =
      `${this.faceHtml(killer, 'killer')}<b class="feed-name">${escapeHtml(killer.name)}</b>${help}` +
      `<span class="feed-icon">${headshot ? '➶◎' : '➶'}</span>` +
      `<b class="feed-name">${escapeHtml(victim.name)}</b>${this.faceHtml(victim, 'victim')}`;
    this.feed.prepend(el);
    this.feedItems.push({ el, age: 0 });
    while (this.feedItems.length > FEED_MAX) this.feedItems.shift()!.el.remove();
    this.layoutFeed();
  }

  /**
   * Avisos de abate à direita do minimapa, alinhados pelo topo. Se numa tela estreita
   * fossem encostar no tempo da partida (ou na vida, no celular), descem ao lado do
   * mapa até ficarem livres.
   */
  private layoutFeed(): void {
    const map = document.querySelector<HTMLElement>('.minimap');
    if (!map || map.hidden) return;
    const m = map.getBoundingClientRect();
    const avoid = [this.matchbar, this.matchbar.parentElement?.querySelector<HTMLElement>('.healthbar')]
      // Visível = tem tamanho (são fixos na tela, então offsetParent não serve).
      .filter((e): e is HTMLElement => !!e && e.offsetWidth > 0 && e.offsetHeight > 0)
      .map((e) => e.getBoundingClientRect());
    const w = this.feed.offsetWidth;
    const h = this.feed.offsetHeight;
    const x = m.right + 8;
    let y = m.top;
    for (let k = 0; k < 4; k++) {
      const hit = avoid.find((r) => x < r.right + 8 && x + w > r.left - 8 && y < r.bottom + 4 && y + h > r.top - 4);
      if (!hit) break;
      y = hit.bottom + 6;
    }
    this.feed.style.left = `${Math.round(x)}px`;
    this.feed.style.top = `${Math.round(y)}px`;
  }

  /** Foto da cabeça (personagem), ícone (criatura/torre) ou a inicial do nome. */
  private faceHtml(side: FeedSide, role: 'killer' | 'victim'): string {
    const url = side.portrait ? this.portraitUrl(side.portrait) : null;
    const inner = url
      ? `<img src="${url}" alt="">`
      : side.icon
        ? `<i>${side.icon}</i>`
        : `<i>${escapeHtml(side.name.slice(0, 1).toUpperCase())}</i>`;
    const key = side.portrait && !url ? ` data-portrait="${escapeHtml(side.portrait)}"` : '';
    return `<span class="feed-face ${role}"${key}>${inner}</span>`;
  }

  /** A foto de uma cabeça ficou pronta: troca a inicial pela foto nos avisos na tela. */
  portraitReady(key: string, url: string): void {
    this.feed.querySelectorAll<HTMLElement>('.feed-face[data-portrait]').forEach((face) => {
      if (face.dataset.portrait !== key) return;
      face.innerHTML = `<img src="${url}" alt="">`;
      delete face.dataset.portrait;
    });
  }

  /** Online: a próxima partida começa sozinha (sem "Jogar de novo"). */
  setOnline(online: boolean): void {
    this.online = online;
  }

  /** Faixa grande no meio da tela (comemoração do fim do Último de pé). */
  showBanner(title: string, sub: string, won: boolean): void {
    const el = this.board.parentElement!.querySelector<HTMLElement>('.win-banner')!;
    el.querySelector('.win-title')!.textContent = title;
    el.querySelector('.win-sub')!.textContent = sub;
    el.classList.toggle('lost', !won);
    el.hidden = false;
  }

  hideBanner(): void {
    this.board.parentElement!.querySelector<HTMLElement>('.win-banner')!.hidden = true;
  }

  /** Esconde o placar (sem mudar mais nada). */
  hideBoard(): void {
    this.board.hidden = true;
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

  showEnd(characters: CharacterState[], result?: { won: boolean; reason: 'giant' | 'surrender' | null; seconds: number }, opts: { title?: string; won?: boolean; watch?: boolean } = {}): void {
    this.ended = true;
    let title = this.online ? 'Fim de partida — a próxima começa em alguns segundos' : 'Fim de partida';
    if (opts.title) {
      title = opts.title;
      this.board.classList.toggle('won', opts.won === true);
      this.board.classList.toggle('lost', opts.won === false);
    } else if (result) {
      const how = result.reason === 'surrender' ? (result.won ? 'O time rival desistiu' : 'Seu time desistiu') : result.won ? 'Gigante inimigo derrubado' : 'Seu gigante caiu';
      title = `${result.won ? 'Vitória!' : 'Derrota'} — ${how} em ${clock(result.seconds)}`;
    }
    if (!opts.title) {
      this.board.classList.toggle('won', !!result?.won);
      this.board.classList.toggle('lost', !!result && !result.won);
    }
    // Placar no meio da partida (eliminado no Último de pé): quem está vivo ainda não tem colocação.
    this.midBoard = !!opts.watch;
    this.fillBoard(characters, title);
    this.boardButton.hidden = false;
    this.watchButton.hidden = !opts.watch;
    this.board.hidden = false;
  }

  update(
    dt: number,
    player: CharacterState,
    characters: CharacterState[],
    match: MatchView,
    killerName: string | null,
    camera: THREE.Camera,
    mobs: MobState[],
    /** Posição em que cada personagem/mob está desenhado (suavizada); sem ela, usa a da simulação. */
    drawnAt?: (id: string) => { x: number; y: number; z: number } | undefined,
  ): void {
    // Vida.
    const max = maxHealthOf(player);
    const frac = Math.max(0, player.health / max);
    this.healthFill.style.transform = `scaleX(${frac})`;
    this.healthFill.classList.toggle('low', frac < 0.35);
    this.healthText.textContent = `${Math.ceil(player.health)}`;
    // Nível na partida e progresso até o próximo.
    const lv = `Nv ${player.level}`;
    if (this.levelText.textContent !== lv) this.levelText.textContent = lv;
    this.levelFill.style.transform = `scaleX(${levelProgress(player).toFixed(3)})`;

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

    // Tempo e placar. Gigantes: tempo crescente, abates e estruturas de cada time.
    if (match.teams) {
      const side = (t: Team) => {
        const kills = characters.filter((c) => c.team === t).reduce((n, c) => n + c.kills, 0);
        const towers = match.structures.filter((x) => x.kind === 'tower' && x.team === t)
          .map((x) => `<i class="tw${x.destroyed ? ' down' : ''}" title="Torre"></i>`).join('');
        const g = match.structures.find((x) => x.kind === 'giant' && x.team === t);
        const gf = g ? Math.max(0, g.health / g.maxHealth) : 0;
        const giant = `<span class="gi${g && !g.vulnerable ? ' shielded' : ''}" title="Gigante"><span style="transform:scaleX(${gf})"></span></span>`;
        return `<span class="team-side t${t}${t === player.team ? ' mine' : ''}"><b class="tk">${kills}</b>${t === 0 ? towers + giant : giant + towers}</span>`;
      };
      this.setMatchbar(side(0) + `<span class="time">${clock(match.elapsed)}</span>` + side(1) +
        `<span class="kd">${player.kills}/${player.deaths}</span>` + (player.matchXp ? `<span class="xp">+${player.matchXp} XP</span>` : ''));
    } else {
      const ranked = rank(characters);
      const place = ranked.indexOf(player) + 1;
      const timeLeft = Math.max(0, MATCH.duration - match.elapsed);
      this.setMatchbar(
        `<span class="time${timeLeft < 30 ? ' urgent' : ''}">${clock(timeLeft)}</span>` +
        `<span>Abates <b>${player.kills}</b></span><span>Mortes <b>${player.deaths}</b></span>` +
        `<span><b>${place}º</b> de ${characters.length}</span>` +
        (player.matchXp ? `<span class="xp">+${player.matchXp} XP</span>` : ''));
    }
    this.royaleMode = !!match.royale;
    if (match.royale) {
      const r = match.royale;
      this.setMatchbar(
        `<span>Vivos <b>${r.alive}</b>/${r.total}</span>` +
        `<span class="zone${r.shrinking ? ' closing' : ''}">${r.zoneText}</span>` +
        `<span>Abates <b>${player.kills}</b></span>` + (player.matchXp ? `<span class="xp">+${player.matchXp} XP</span>` : ''));
    }
    this.zoneTint.hidden = !match.royale?.outside || player.health <= 0 || this.ended;
    this.matchbar.classList.toggle('teams', match.teams);

    // Votação para desistir (do time do jogador).
    const v = match.vote;
    this.voteBox.hidden = !v || this.ended;
    if (v && !this.ended) {
      const html = `<div class="vote-title">${v.mine ? 'Você pediu para desistir' : 'Seu time quer desistir'}</div>` +
        `<div class="vote-count"><span class="yes">✔ ${v.yes}</span> · <span class="no">✖ ${v.no}</span> · precisa de ${Math.min(SURRENDER.yesNeeded, v.total)} de ${v.total} · ${Math.ceil(v.timeLeft)} s</div>` +
        (v.myVote === null
          ? `<div class="vote-buttons"><button type="button" data-vote="yes">[1] Sim, desistir</button><button type="button" data-vote="no">[2] Não</button></div>`
          : `<div class="vote-mine">Seu voto: ${v.myVote ? 'sim' : 'não'}</div>`);
      if (html !== this.lastVoteHtml) {
        this.voteBox.innerHTML = html;
        this.lastVoteHtml = html;
      }
    }

    // Tela de eliminado.
    const dead = player.health <= 0 && !this.ended;
    this.deathScreen.hidden = !dead;
    if (dead) {
      const r = match.royale;
      const html = `<div class="death-title">Eliminado${r ? ` — ${r.place}º lugar` : ''}</div>` +
        (killerName ? `<div>por <b>${escapeHtml(killerName)}</b></div>` : '') +
        (r
          ? `<div class="death-timer">${r.spectating ? `Assistindo <b>${escapeHtml(r.spectating)}</b> · ` : ''}Esc: menu</div>`
          : `<div class="death-timer">Voltando em ${Math.max(0, player.respawnTimer).toFixed(1)} s</div>`);
      if (this.deathScreen.innerHTML !== html) this.deathScreen.innerHTML = html;
    }

    // Tabela (Tab) durante a partida.
    if (!this.ended) {
      this.board.hidden = !this.boardHeld;
      if (this.boardHeld) this.fillBoard(characters, 'Placar');
    }

    this.teamsMode = match.teams;
    this.updateNameplates(player, characters, camera, mobs, drawnAt, match.structures);
  }

  private teamsMode = false;
  private matchbarHtml = '';

  /** Troca o placar do topo só quando o texto muda (evita refazer o DOM todo quadro). */
  private setMatchbar(html: string): void {
    if (html === this.matchbarHtml) return;
    this.matchbarHtml = html;
    this.matchbar.innerHTML = html;
  }

  private fillBoard(characters: CharacterState[], title: string): void {
    this.boardTitle.textContent = title;
    // Gigantes: separado por time (o do jogador primeiro).
    const place = this.royaleMode ? this.placeFn : null;
    const list = place ? [...characters].sort((a, b) => place(a) - place(b)) : this.teamsMode ? [...rank(characters)].sort((a, b) => Number(a.team !== characters.find((c) => !c.isBot)?.team) - Number(b.team !== characters.find((c) => !c.isBot)?.team)) : rank(characters);
    this.boardBody.innerHTML = list
      .map((c, i) => `<tr class="${c.isBot ? '' : 'me'}${this.teamsMode ? ` team${c.team}` : ''}"><td>${place ? (this.midBoard && c.health > 0 ? '—' : place(c)) : i + 1}</td><td>${escapeHtml(c.name)} <small>${getCharacter(c.characterId).name}${this.teamsMode ? ` · ${TEAMS[c.team].name}` : ''}</small></td><td>${c.level}</td><td>${c.kills}</td><td>${c.assists}</td><td>${c.deaths}</td></tr>`)
      .join('');
  }

  private updateNameplates(
    player: CharacterState,
    characters: CharacterState[],
    camera: THREE.Camera,
    mobs: MobState[],
    drawnAt: ((id: string) => { x: number; y: number; z: number } | undefined) | undefined,
    structures: StructureState[],
  ): void {
    const seen = new Set<string>();
    const side = (team: Team) => (!this.teamsMode ? '' : team === player.team ? 'ally' : 'enemy');
    for (const c of characters) {
      if (c === player) continue;
      const def = getCharacter(c.characterId);
      const el = this.placeNameplate(seen, c.id, c.name, side(c.team), drawnAt?.(c.id) ?? c.position, def.height + 0.25, c.health, maxHealthOf(c), player, camera);
      // Nível ao lado do nome.
      const lvEl = el.querySelector('.np-lv');
      if (lvEl && lvEl.textContent !== String(c.level)) lvEl.textContent = String(c.level);
    }
    for (const m of mobs) {
      if (m.mode === 'dead') continue;
      const def = MOBS[m.typeId];
      // Tropas: barrinha só quando feridas. Mobs: quando feridos ou perseguindo alguém.
      if (m.team !== undefined) {
        if (m.health >= def.maxHealth) continue;
        this.placeNameplate(seen, m.id, '', `minion ${side(m.team)}`, drawnAt?.(m.id) ?? m.position, def.height + 0.3, m.health, Math.max(m.health, def.maxHealth), player, camera);
        continue;
      }
      if (m.health >= def.maxHealth && m.mode !== 'chase' && m.mode !== 'attack') continue;
      this.placeNameplate(seen, m.id, def.name, def.behavior, drawnAt?.(m.id) ?? m.position, def.height + 0.4, m.health, def.maxHealth, player, camera);
    }
    for (const st of structures) {
      if (st.destroyed) continue;
      const def = STRUCTURES[st.kind];
      const name = `${def.name}${st.vulnerable ? '' : ' 🛡'}`;
      const el = this.placeNameplate(seen, st.id, name, `structure ${side(st.team)}`, st.position, def.headY + (st.kind === 'giant' ? 2.2 : 1.6), st.health, st.maxHealth, player, camera, 140);
      el.classList.toggle('shielded', !st.vulnerable);
      const label = el.querySelector('.np-name')!;
      if (label.textContent !== name) label.textContent = name;
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
    maxRange = NAMEPLATE_RANGE,
  ): HTMLElement {
    seen.add(id);
    let el = this.plates.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = `nameplate ${kind}`;
      const isChar = kind === '' || kind === 'ally' || kind === 'enemy';
      el.innerHTML = `<span class="np-name">${isChar ? '<b class="np-lv"></b>' : ''}${escapeHtml(name)}</span><div class="np-bar"><div class="np-fill"></div></div>`;
      this.nameLayer.appendChild(el);
      this.plates.set(id, el);
    }
    const d = Math.hypot(pos.x - player.position.x, pos.z - player.position.z);
    this.projected.set(pos.x, pos.y + height, pos.z).project(camera);
    // Olhar de Coruja: personagens aparecem marcados de longe (e através das paredes).
    const isCharacter = kind === '' || kind === 'ally' || kind === 'enemy';
    const marked = isCharacter && kind !== 'ally' && (this.reveal || this.revealIds.has(id));
    const range = marked ? 160 : maxRange;
    el.classList.toggle('marked', marked);
    const visible = health > 0 && d < range && this.projected.z < 1 && Math.abs(this.projected.x) < 1.1 && Math.abs(this.projected.y) < 1.1;
    // Só mexe no DOM quando algo muda (escrever estilos todo quadro custa caro).
    const display = visible ? '' : 'none';
    if (el.style.display !== display) el.style.display = display;
    if (!visible) return el;
    const x = (this.projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.projected.y * 0.5 + 0.5) * window.innerHeight;
    // Encolhe com a distância (de 100% perto até 65% longe).
    const scale = Math.max(0.65, Math.min(1, 1.1 - d / 70));
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
    const opacity = Math.min(1, (range - d) / 10).toFixed(2);
    if (el.style.opacity !== opacity) el.style.opacity = opacity;
    const fill = `scaleX(${Math.max(0, health / maxHealth).toFixed(3)})`;
    const fillEl = (el.firstElementChild!.nextElementSibling!.firstElementChild as HTMLElement);
    if (fillEl.style.transform !== fill) fillEl.style.transform = fill;
    return el;
  }
}

/** m:ss */
function clock(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Ordena por abates (desempate: menos mortes). */
function rank(characters: CharacterState[]): CharacterState[] {
  return [...characters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}
