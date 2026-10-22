// Menu principal (também é a tela de pausa): Jogar/Continuar, Personagens,
// Skins (coleção) e Configurações.
import type { AccountService } from '../account/AccountService';
import { characterBowId, EFFECT_INFO, getBow } from '../data/bows';
import { COMBAT } from '../data/combat';
import { applySkin, getSkin, ownsSkin, SKIN_TIERS, SKINS_FREE_FOR_NOW, skinsOf } from '../data/skins';
import { CHARACTERS, getCharacter } from '../data/characters';
import { getAbility } from '../data/abilities';
import { cssColor } from '../data/rarities';
import { MODES, type ModeId } from '../data/modes';
import { saveSettings, type Settings } from '../data/settings';
import { CharacterPreview } from './CharacterPreview';
import { ProfileCard } from './ProfileCard';

type View = 'main' | 'characters' | 'skins' | 'settings';

export interface MenuActions {
  play(): void;
  chooseCharacter(id: string): void;
  /** Equipa uma skin no personagem (null = aparência original). */
  equipSkin(characterId: string, skinId: string | null): void;
  /** Skin equipada no personagem (null = original). */
  currentSkin(characterId: string): string | null;
  currentCharacter(): string;
  /** Jogar online (null se não houver servidor configurado). */
  playOnline: (() => void) | null;
  /** Troca o modo de jogo (refaz o mapa e recomeça a partida). */
  chooseMode(id: ModeId): void;
  currentMode(): ModeId;
  /** Pede a votação para o time desistir; devolve a mensagem para mostrar. */
  surrender(): string;
}

const MODE_ICON: Record<ModeId, string> = { ffa: '⚔', royale: '👑', giants: '🗿' };
const MODE_SHORT: Record<ModeId, string> = { ffa: 'Cada um por si · 5 min', royale: '1 vida · zona fecha', giants: '5 contra 5 · sem tempo' };

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export class Menu {
  private readonly el: HTMLElement;
  private readonly views: Record<View, HTMLElement>;
  private readonly playBtn: HTMLButtonElement;
  private readonly onlineBtn: HTMLButtonElement;
  private readonly statusEl: HTMLElement;
  private onlineMode = false;
  private offlineNeedsReload = false;
  private readonly profileCard: ProfileCard;
  private readonly surrenderBtn: HTMLButtonElement;
  private paused = false;
  private readonly preview = new CharacterPreview();
  private selectedCharacter = '';

  constructor(
    root: HTMLElement,
    private readonly accounts: AccountService,
    private readonly settings: Settings,
    private readonly touch: boolean,
    private readonly actions: MenuActions,
  ) {
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="menu-screen">
        <div class="panel menu-panel">
          <section class="menu-view" data-view="main">
            <h1>Arqueiros</h1>
            <p class="subtitle"></p>
            <div class="mode-picker" role="radiogroup" aria-label="Modo de jogo"></div>
            <div class="menu-buttons">
              <button type="button" class="primary-btn menu-online" hidden>Jogar online</button>
              <button type="button" class="primary-btn menu-play">Jogar</button>
              <p class="menu-status" role="status" hidden></p>
              <button type="button" class="menu-btn menu-surrender" hidden>🏳 Desistir (votação do time)</button>
              <button type="button" class="menu-btn" data-go="characters">Personagens</button>
              <button type="button" class="menu-btn" data-go="skins">Skins</button>
              <button type="button" class="menu-btn" data-go="settings">Configurações</button>
            </div>
            <div class="account-slot"></div>
            <details class="controls-help">
              <summary>Controles</summary>
              ${
                touch
                  ? `<ul class="controls">
                      <li><kbd>Esquerda</kbd> arraste para andar (até a borda corre)</li>
                      <li><kbd>Direita</kbd> arraste para olhar em volta</li>
                      <li><kbd>Atirar</kbd> segure para atirar sem parar; arraste o mesmo dedo para mirar</li>
                      <li><kbd>Hab.</kbd> habilidade · <kbd>Pular</kbd> · <kbd>II</kbd> pausa</li>
                      <li>Jogue com o celular deitado.</li>
                    </ul>`
                  : `<ul class="controls">
                      <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> mover · <kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular</li>
                      <li><kbd>Mouse</kbd> mirar · <kbd>Botão esq.</kbd> segure para atirar sem parar</li>
                      <li><kbd>E</kbd> habilidade · <kbd>Tab</kbd> placar · <kbd>Esc</kbd> pausar</li>
                      <li>Votação para desistir (modo Gigantes): <kbd>1</kbd> sim · <kbd>2</kbd> não</li>
                    </ul>`
              }
              <p class="tip mode-tip"></p>
            </details>
            <p class="stage">Etapa 8 — multiplayer online · versão ${__BUILD__}</p>
          </section>

          <section class="menu-view" data-view="characters" hidden>
            <header class="menu-head"><button type="button" class="link-btn" data-go="main">← Voltar</button><h2>Personagens</h2></header>
            <div class="char-layout">
              <div class="char-stage">
                <div class="char-preview-slot"></div>
                <p class="char-drag-hint">↔ Arraste para girar</p>
                <div class="char-info"></div>
              </div>
              <div class="char-grid"></div>
            </div>
          </section>

          <section class="menu-view" data-view="skins" hidden>
            <header class="menu-head"><button type="button" class="link-btn" data-go="main">← Voltar</button><h2>Skins</h2></header>
            <p class="menu-note">Visuais alternativos dos personagens (só aparência: atributos, arco e habilidade não mudam).</p>
            <div class="char-layout">
              <div class="char-stage">
                <div class="skin-preview-slot"></div>
                <p class="char-drag-hint">↔ Arraste para girar</p>
                <div class="skin-info"></div>
              </div>
              <div class="skin-grid"></div>
            </div>
          </section>

          <section class="menu-view" data-view="settings" hidden>
            <header class="menu-head"><button type="button" class="link-btn" data-go="main">← Voltar</button><h2>Configurações</h2></header>
            <form class="settings-form"></form>
          </section>
        </div>
      </div>`,
    );
    this.el = root.querySelector('.menu-screen')!;
    const q = (v: View) => this.el.querySelector<HTMLElement>(`[data-view="${v}"]`)!;
    this.views = { main: q('main'), characters: q('characters'), skins: q('skins'), settings: q('settings') };
    this.playBtn = this.el.querySelector('.menu-play')!;
    this.playBtn.addEventListener('click', () => {
      // Depois de cair do online, o treino offline recomeça do zero.
      if (this.offlineNeedsReload) location.reload();
      else actions.play();
    });
    this.onlineBtn = this.el.querySelector('.menu-online')!;
    this.statusEl = this.el.querySelector('.menu-status')!;
    if (actions.playOnline) {
      const go = actions.playOnline;
      this.onlineBtn.hidden = false;
      this.onlineBtn.addEventListener('click', () => {
        this.onlineBtn.disabled = true;
        go();
      });
    }
    this.el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go as View)));
    this.profileCard = new ProfileCard(this.el.querySelector('.account-slot')!, accounts);
    this.surrenderBtn = this.el.querySelector('.menu-surrender')!;
    this.surrenderBtn.addEventListener('click', () => this.setStatus(actions.surrender()));
    this.renderModes();
    this.el.querySelector('.char-preview-slot')!.appendChild(this.preview.canvas);
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  /** Mensagem de conexão (vazio esconde). */
  setStatus(text: string): void {
    this.statusEl.textContent = text;
    this.statusEl.hidden = !text;
    if (text.includes('caiu') || text.includes('Não foi possível') || text.includes('desatualizada')) {
      this.onlineBtn.disabled = false;
      if (this.onlineMode) this.offlineNeedsReload = true;
      this.onlineMode = false;
    }
  }

  /** Entrou numa sala online: "Jogar" vira "Continuar" e some o botão online. */
  setOnline(): void {
    this.onlineMode = true;
    this.onlineBtn.hidden = true;
    this.renderModes();
  }

  /** Cartões dos modos de jogo (escolher troca o mapa na hora). */
  private renderModes(): void {
    const current = this.actions.currentMode();
    const picker = this.el.querySelector<HTMLElement>('.mode-picker')!;
    picker.hidden = this.onlineMode;
    picker.innerHTML = Object.values(MODES)
      .map((m) => `<button type="button" class="mode-card${m.id === current ? ' selected' : ''}" role="radio" aria-checked="${m.id === current}" data-mode="${m.id}">
          <b>${MODE_ICON[m.id]} ${esc(m.name)}</b><small>${esc(MODE_SHORT[m.id])}</small></button>`)
      .join('');
    picker.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.mode as ModeId;
        if (id === this.actions.currentMode()) return;
        this.actions.chooseMode(id);
        this.setStatus(this.paused ? `Modo ${MODES[id].name}: a partida recomeçou.` : '');
        this.renderModes();
      }),
    );
    const mode = MODES[current];
    this.el.querySelector('.subtitle')!.textContent = `${mode.name} · ${mode.map.name}`;
    this.el.querySelector('.mode-tip')!.textContent = mode.royale
      ? 'Último de pé: 10 arqueiros, cada um com uma vida só — não dá para renascer. Vence quem sobrar. A zona roxa fecha aos poucos num lugar sorteado do mapa (pode ser o centro ou um canto): fora dela você perde vida, e cada vez mais rápido. Fique de olho no minimapa (círculo branco = próxima zona).'
      : mode.teams
      ? 'Gigantes: você e 4 aliados (azul) contra 5 rivais (vermelho). Cada time tem 2 torres e um gigante de pedra. Derrube as duas torres inimigas para o gigante perder a redoma, e então derrube o gigante para vencer. Mini golems saem da base a cada 25 s e ajudam a empurrar. O tempo conta para cima; a partida só acaba quando um gigante cai ou um time desiste (3 votos "sim").'
      : 'Todos contra todos por 5 minutos: elimine os arqueiros rivais e cace criaturas para ganhar XP e arcos. A flecha acerta exatamente onde está a mira; ela fica vermelha quando há um inimigo embaixo.';
    this.surrenderBtn.hidden = !(this.paused && mode.teams && !this.onlineMode);
  }

  /** Mostra o menu: 'start' antes da partida, 'pause' durante. */
  show(mode: 'start' | 'pause'): void {
    this.paused = mode === 'pause';
    this.renderModes();
    const withOnline = !!this.actions.playOnline && !this.onlineMode && mode === 'start';
    this.onlineBtn.hidden = !withOnline;
    this.playBtn.textContent = this.onlineMode ? 'Continuar' : mode === 'start' ? (withOnline ? 'Treino offline (bots)' : 'Jogar') : 'Continuar';
    this.playBtn.classList.toggle('primary-btn', !withOnline);
    this.playBtn.classList.toggle('menu-btn', withOnline);
    this.el.hidden = false;
    this.go('main');
    this.profileCard.render();
  }

  hide(): void {
    this.el.hidden = true;
    this.preview.stop();
  }

  refreshProfile(): void {
    this.profileCard.render();
  }

  private go(view: View): void {
    for (const [k, el] of Object.entries(this.views)) el.hidden = k !== view;
    if (view === 'characters') {
      this.selectedCharacter = this.actions.currentCharacter();
      // A prévia 3D é uma só: vai para a tela aberta.
      this.el.querySelector('.char-preview-slot')!.appendChild(this.preview.canvas);
      this.renderCharacters();
      this.preview.start();
    } else if (view === 'skins') {
      const cur = this.actions.currentCharacter();
      this.selectedSkin = this.actions.currentSkin(cur) ?? `original:${cur}`;
      this.el.querySelector('.skin-preview-slot')!.appendChild(this.preview.canvas);
      this.renderSkins();
      this.preview.start();
    } else {
      this.preview.stop();
    }
    if (view === 'settings') this.renderSettings();
    if (view === 'main') this.profileCard.render();
    this.el.querySelector('.menu-panel')!.scrollTop = 0;
  }

  // ------------------------------------------------------------- personagens

  private renderCharacters(): void {
    const grid = this.views.characters.querySelector('.char-grid')!;
    const current = this.actions.currentCharacter();
    grid.innerHTML = Object.values(CHARACTERS)
      .map((c) => `
        <button type="button" class="char-card${c.id === this.selectedCharacter ? ' selected' : ''}" data-id="${c.id}">
          <span class="char-swatch" style="--c1:${cssColor(c.palette.primary)};--c2:${cssColor(c.palette.skin)}"></span>
          <span class="char-name">${esc(c.name)}</span>
          ${c.id === current ? '<span class="char-tag">Em uso</span>' : ''}
        </button>`)
      .join('');
    grid.querySelectorAll<HTMLButtonElement>('.char-card').forEach((b) =>
      b.addEventListener('click', () => {
        this.selectedCharacter = b.dataset.id!;
        this.renderCharacters();
      }),
    );
    this.preview.setCharacter(this.selectedCharacter, this.actions.currentSkin(this.selectedCharacter));

    const def = getCharacter(this.selectedCharacter);
    const bow = getBow(characterBowId(def.id));
    const skin = getSkin(this.actions.currentSkin(def.id));
    const base = getCharacter('hunter');
    const bar = (label: string, value: number, ref: number, text: string) =>
      `<div class="stat"><span>${label}</span><div class="stat-bar"><div style="transform:scaleX(${Math.min(1, value / (ref * 1.3))})"></div></div><b>${text}</b></div>`;
    const info = this.views.characters.querySelector('.char-info')!;
    const inUse = def.id === current;
    info.innerHTML = `
      <h3>${esc(def.name)}</h3>
      <p>${esc(def.description)}</p>
      ${bar('Vida', def.maxHealth, base.maxHealth, String(def.maxHealth))}
      ${bar('Velocidade', def.speedMultiplier, 1, `${Math.round(def.speedMultiplier * 100)}%`)}
      ${bar('Pulo', def.jumpMultiplier, 1, `${Math.round(def.jumpMultiplier * 100)}%`)}
      ${def.arrowTrail === 'magic' ? '<p class="char-perk">✦ Flechas com rastro mágico</p>' : ''}
      <p class="char-ability" style="--ab-color:${cssColor(getAbility(def.id).color)}"><b>Habilidade (E): ${esc(getAbility(def.id).name)}</b><br>${esc(getAbility(def.id).description)} <small>Recarga ${getAbility(def.id).cooldown} s.</small></p>
      <p class="char-bow" style="--bow-color:${cssColor(bow.look.glow ?? bow.look.accent)}"><b>🏹 ${esc(bow.name)}</b><br>${Math.round(bow.damage * COMBAT.shotDamageFraction)} por flecha · ${(1 / (bow.fireInterval * COMBAT.fireIntervalScale)).toFixed(1)} flechas/s${bow.effect ? ` · <span class="bow-effect">✦ ${EFFECT_INFO[bow.effect].name}: ${esc(EFFECT_INFO[bow.effect].description)}</span>` : ''}</p>
      <p class="char-skin-line">Skin: <b>${skin ? esc(skin.name) : 'Original'}</b> · <button type="button" class="link-btn char-skins-link">trocar em Skins</button></p>
      <details class="char-story" open><summary>História</summary><p>${esc(def.story)}</p></details>
      <button type="button" class="primary-btn char-choose" ${inUse ? 'disabled' : ''}>${inUse ? 'Em uso' : 'Escolher'}</button>`;
    info.querySelector('.char-skins-link')!.addEventListener('click', () => {
      this.go('skins');
      this.selectedSkin = this.actions.currentSkin(def.id) ?? `original:${def.id}`;
      this.renderSkins();
    });
    info.querySelector('.char-choose')!.addEventListener('click', () => {
      this.actions.chooseCharacter(def.id);
      this.renderCharacters();
    });
  }

  // ------------------------------------------------------------- skins

  /** Skin selecionada na coleção (id da skin, ou "original:<personagem>"). */
  private selectedSkin = '';

  private renderSkins(): void {
    const owned = this.accounts.profile?.ownedSkins ?? [];
    const grid = this.views.skins.querySelector('.skin-grid')!;
    // Para cada personagem: a aparência original e as skins dele.
    grid.innerHTML = Object.values(CHARACTERS)
      .map((c) => {
        const equipped = this.actions.currentSkin(c.id);
        const card = (id: string, name: string, sub: string, color: string, palette: { primary: number; skin: number }, isEquipped: boolean, locked: boolean) => `
          <button type="button" class="skin-card${id === this.selectedSkin ? ' selected' : ''}${locked ? ' locked' : ''}" data-id="${id}" style="--tier:${color}">
            <span class="char-swatch" style="--c1:${cssColor(palette.primary)};--c2:${cssColor(palette.skin)}"></span>
            <span class="skin-text"><span class="char-name">${esc(name)}</span><small>${esc(sub)}</small></span>
            ${isEquipped ? '<span class="char-tag">Equipada</span>' : ''}
          </button>`;
        return `<div class="skin-group"><div class="skin-group-name">${esc(c.name)}</div>` +
          card(`original:${c.id}`, 'Original', 'Padrão', '#8a8a8a', c.palette, !equipped, false) +
          skinsOf(c.id).map((sk) => {
            const pal = applySkin(c, sk.id).palette;
            return card(sk.id, sk.name, sk.tier[0].toUpperCase() + sk.tier.slice(1), SKIN_TIERS[sk.tier].color, pal, equipped === sk.id, !ownsSkin(sk, owned));
          }).join('') + '</div>';
      })
      .join('');
    grid.querySelectorAll<HTMLButtonElement>('.skin-card').forEach((b) =>
      b.addEventListener('click', () => {
        this.selectedSkin = b.dataset.id!;
        this.renderSkins();
      }),
    );

    // Selecionada: prévia 3D e detalhes.
    const original = this.selectedSkin.startsWith('original:');
    const skin = original ? undefined : getSkin(this.selectedSkin);
    const characterId = original ? this.selectedSkin.slice('original:'.length) : skin?.characterId ?? this.actions.currentCharacter();
    const def = getCharacter(characterId);
    this.preview.setCharacter(def.id, skin?.id ?? null);
    const equipped = this.actions.currentSkin(def.id);
    const isEquipped = original ? !equipped : equipped === skin?.id;
    const canUse = !skin || ownsSkin(skin, owned);
    const price = skin
      ? SKINS_FREE_FOR_NOW
        ? `<p class="skin-price"><s>${skin.price} moedas</s> <b>Grátis durante os testes</b></p>`
        : `<p class="skin-price"><b>${skin.price} moedas</b></p>`
      : '';
    const info = this.views.skins.querySelector('.skin-info')!;
    info.innerHTML = `
      <h3>${esc(skin ? skin.name : `${def.name} — Original`)}</h3>
      ${skin ? `<span class="skin-tier" style="--tier:${SKIN_TIERS[skin.tier].color}">Skin ${skin.tier}</span>` : ''}
      <p>${esc(skin ? skin.description : def.description)}</p>
      ${price}
      <button type="button" class="primary-btn skin-equip" ${isEquipped || !canUse ? 'disabled' : ''}>${isEquipped ? 'Equipada' : canUse ? `Equipar em ${esc(def.name)}` : 'Bloqueada'}</button>`;
    info.querySelector('.skin-equip')!.addEventListener('click', () => {
      this.actions.equipSkin(def.id, skin?.id ?? null);
      this.renderSkins();
    });
  }

  // ------------------------------------------------------------- configurações

  private renderSettings(): void {
    const s = this.settings;
    const form = this.views.settings.querySelector<HTMLFormElement>('.settings-form')!;
    const slider = (id: string, label: string, min: number, max: number, step: number, value: number, fmt: (v: number) => string) => `
      <label class="field setting" for="set-${id}">
        <span>${label} <b data-out="${id}">${fmt(value)}</b></span>
        <input id="set-${id}" name="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
      </label>`;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    form.innerHTML = `
      ${this.touch ? '' : slider('mouse', 'Sensibilidade do mouse', 0.0008, 0.005, 0.0001, s.mouseSensitivity, (v) => pct(v / 0.0022))}
      ${slider('touchLook', 'Sensibilidade do toque (olhar)', 0.5, 4, 0.1, s.touchLookMultiplier, (v) => pct(v / 1.8))}
      ${slider('touchFire', 'Sensibilidade ao mirar com o Atirar', 0.4, 2.5, 0.1, s.touchFireAimMultiplier, (v) => pct(v / 1.2))}
      <label class="field setting check" for="set-assist"><input id="set-assist" name="assist" type="checkbox" ${(s.aimAssist ?? this.touch) ? 'checked' : ''} /> <span>Auxílio de mira (a flecha vai no inimigo quase sob a mira)</span></label>
      <label class="field setting check" for="set-vibration"><input id="set-vibration" name="vibration" type="checkbox" ${s.vibration ? 'checked' : ''} /> <span>Vibrar e dar tranco na câmera ao atirar</span></label>
      <label class="field setting check" for="set-invert"><input id="set-invert" name="invert" type="checkbox" ${s.invertY ? 'checked' : ''} /> <span>Inverter eixo vertical</span></label>
      ${slider('volume', 'Volume', 0, 1, 0.05, s.volume, pct)}
      ${slider('music', 'Música', 0, 1, 0.05, s.music, pct)}
      <label class="field setting" for="set-bots">
        <span>Dificuldade dos bots (treino offline)</span>
        <select id="set-bots" name="bots">
          ${(['easy', 'normal', 'hard'] as const).map((l) => `<option value="${l}" ${s.botLevel === l ? 'selected' : ''}>${{ easy: 'Fácil', normal: 'Normal', hard: 'Difícil' }[l]}</option>`).join('')}
        </select>
      </label>
      <p class="menu-note bots-note" hidden>A dificuldade nova vale na próxima partida. <button type="button" class="link-btn reload-btn">Recomeçar agora</button></p>
      <label class="field setting" for="set-graphics">
        <span>Gráficos</span>
        <select id="set-graphics" name="graphics">
          ${(['auto', 'low', 'medium', 'high'] as const).map((g) => `<option value="${g}" ${s.graphics === g ? 'selected' : ''}>${{ auto: 'Automático', low: 'Baixo (mais leve)', medium: 'Médio', high: 'Alto' }[g]}</option>`).join('')}
        </select>
      </label>
      <p class="menu-note graphics-note" hidden>A qualidade nova vale depois de recarregar. <button type="button" class="link-btn reload-btn">Recarregar agora</button></p>
      <button type="button" class="link-btn reset-btn">Voltar ao padrão</button>`;

    const update = () => {
      const data = new FormData(form);
      const num = (k: string, fallback: number) => (data.has(k) ? Number(data.get(k)) : fallback);
      s.mouseSensitivity = num('mouse', s.mouseSensitivity);
      s.touchLookMultiplier = num('touchLook', s.touchLookMultiplier);
      s.touchFireAimMultiplier = num('touchFire', s.touchFireAimMultiplier);
      s.volume = num('volume', s.volume);
      s.music = num('music', s.music);
      s.invertY = data.get('invert') === 'on';
      s.aimAssist = data.get('assist') === 'on';
      s.vibration = data.get('vibration') === 'on';
      const lvl = String(data.get('bots')) as Settings['botLevel'];
      if (lvl !== s.botLevel) {
        s.botLevel = lvl;
        form.querySelector<HTMLElement>('.bots-note')!.hidden = false;
      }
      const g = String(data.get('graphics')) as Settings['graphics'];
      if (g !== s.graphics) {
        s.graphics = g;
        form.querySelector<HTMLElement>('.graphics-note')!.hidden = false;
      }
      saveSettings(s);
      form.querySelectorAll<HTMLElement>('[data-out]').forEach((o) => {
        const input = form.querySelector<HTMLInputElement>(`[name="${o.dataset.out}"]`)!;
        const v = Number(input.value);
        o.textContent = o.dataset.out === 'mouse' ? pct(v / 0.0022) : o.dataset.out === 'touchLook' ? pct(v / 1.8) : o.dataset.out === 'touchFire' ? pct(v / 1.2) : pct(v);
      });
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.querySelectorAll('.reload-btn').forEach((b) => b.addEventListener('click', () => location.reload()));
    form.querySelector('.reset-btn')!.addEventListener('click', () => {
      Object.assign(s, { mouseSensitivity: 0.0022, touchLookMultiplier: 1.8, touchFireAimMultiplier: 1.2, invertY: false, aimAssist: null, vibration: true, volume: 0.8, music: 0.5 });
      saveSettings(s);
      this.renderSettings();
    });
  }
}
