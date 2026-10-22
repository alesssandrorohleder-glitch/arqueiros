// Menu principal (também é a tela de pausa): Jogar/Continuar, Personagens,
// Arsenal e Configurações.
import type { AccountService } from '../account/AccountService';
import { BOWS, EFFECT_INFO, type BowDef } from '../data/bows';
import { CHARACTERS, getCharacter } from '../data/characters';
import { cssColor, RARITIES, RARITY_ORDER } from '../data/rarities';
import { saveSettings, type Settings } from '../data/settings';
import { CharacterPreview } from './CharacterPreview';
import { ProfileCard } from './ProfileCard';

type View = 'main' | 'characters' | 'arsenal' | 'settings';

export interface MenuActions {
  play(): void;
  chooseCharacter(id: string): void;
  equipBow(id: string): void;
  /** Arco equipado agora (pode ser um arco de teste fora da conta). */
  currentBow(): string;
  currentCharacter(): string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export class Menu {
  private readonly el: HTMLElement;
  private readonly views: Record<View, HTMLElement>;
  private readonly playBtn: HTMLButtonElement;
  private readonly profileCard: ProfileCard;
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
            <p class="subtitle">Ruínas da Clareira</p>
            <div class="menu-buttons">
              <button type="button" class="primary-btn menu-play">Jogar</button>
              <button type="button" class="menu-btn" data-go="characters">Personagens</button>
              <button type="button" class="menu-btn" data-go="arsenal">Arsenal</button>
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
                      <li><kbd>Atirar</kbd> toque e segure: o mesmo dedo mira; solte para atirar</li>
                      <li><kbd>Arco</kbd> troca de arco · <kbd>Pular</kbd> · <kbd>II</kbd> pausa</li>
                      <li>Jogue com o celular deitado.</li>
                    </ul>`
                  : `<ul class="controls">
                      <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> mover · <kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular</li>
                      <li><kbd>Mouse</kbd> mirar · <kbd>Botão esq.</kbd> segure e solte para atirar · <kbd>Botão dir.</kbd> cancela</li>
                      <li><kbd>Q</kbd> trocar arco · <kbd>Tab</kbd> placar · <kbd>Esc</kbd> pausar</li>
                    </ul>`
              }
              <p class="tip">Todos contra todos por 5 minutos: elimine os arqueiros rivais e cace criaturas para ganhar XP e arcos.</p>
            </details>
            <p class="stage">Etapa 7 — sons, efeitos e otimização · versão ${__BUILD__}</p>
          </section>

          <section class="menu-view" data-view="characters" hidden>
            <header class="menu-head"><button type="button" class="link-btn" data-go="main">← Voltar</button><h2>Personagens</h2></header>
            <div class="char-layout">
              <div class="char-stage">
                <div class="char-preview-slot"></div>
                <div class="char-info"></div>
              </div>
              <div class="char-grid"></div>
            </div>
          </section>

          <section class="menu-view" data-view="arsenal" hidden>
            <header class="menu-head"><button type="button" class="link-btn" data-go="main">← Voltar</button><h2>Arsenal</h2></header>
            <p class="menu-note">Arcos caem de criaturas. Os que você ainda não encontrou aparecem apagados.</p>
            <div class="bow-grid"></div>
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
    this.views = { main: q('main'), characters: q('characters'), arsenal: q('arsenal'), settings: q('settings') };
    this.playBtn = this.el.querySelector('.menu-play')!;
    this.playBtn.addEventListener('click', () => actions.play());
    this.el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go as View)));
    this.profileCard = new ProfileCard(this.el.querySelector('.account-slot')!, accounts);
    this.el.querySelector('.char-preview-slot')!.appendChild(this.preview.canvas);
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  /** Mostra o menu: 'start' antes da partida, 'pause' durante. */
  show(mode: 'start' | 'pause'): void {
    this.playBtn.textContent = mode === 'start' ? 'Jogar' : 'Continuar';
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
      this.renderCharacters();
      this.preview.start();
    } else {
      this.preview.stop();
    }
    if (view === 'arsenal') this.renderArsenal();
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
    this.preview.setCharacter(this.selectedCharacter);

    const def = getCharacter(this.selectedCharacter);
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
      <button type="button" class="primary-btn char-choose" ${inUse ? 'disabled' : ''}>${inUse ? 'Em uso' : 'Escolher'}</button>`;
    info.querySelector('.char-choose')!.addEventListener('click', () => {
      this.actions.chooseCharacter(def.id);
      this.renderCharacters();
    });
  }

  // ------------------------------------------------------------- arsenal

  private renderArsenal(): void {
    const owned = new Set(this.accounts.profile?.ownedBows ?? []);
    const current = this.actions.currentBow();
    owned.add(current);
    const bows = Object.values(BOWS).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    const grid = this.views.arsenal.querySelector('.bow-grid')!;
    grid.innerHTML = bows.map((b) => this.bowCard(b, owned.has(b.id), b.id === current)).join('');
    grid.querySelectorAll<HTMLButtonElement>('.bow-equip').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.actions.equipBow(btn.dataset.id!);
        this.renderArsenal();
      }),
    );
  }

  private bowCard(b: BowDef, owned: boolean, equipped: boolean): string {
    const r = RARITIES[b.rarity];
    const strongest = Object.values(BOWS).reduce((m, x) => Math.max(m, x.damage), 0);
    const fastest = Object.values(BOWS).reduce((m, x) => Math.max(m, x.maxArrowSpeed), 0);
    const bar = (label: string, frac: number, text: string) =>
      `<div class="stat"><span>${label}</span><div class="stat-bar"><div style="transform:scaleX(${Math.max(0.05, Math.min(1, frac))})"></div></div><b>${text}</b></div>`;
    const action = !owned
      ? '<span class="bow-locked">Ainda não encontrado</span>'
      : equipped
        ? '<span class="bow-equipped">Equipado</span>'
        : `<button type="button" class="menu-btn bow-equip" data-id="${b.id}">Equipar</button>`;
    return `
      <div class="bow-card${owned ? '' : ' locked'}${equipped ? ' equipped' : ''}" style="--rarity:${cssColor(r.color)}">
        <div class="bow-card-head">
          <svg class="bow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2 Q20 12 6 22" /><path d="M6 2 L6 22" class="string" /><path d="M3 12 L21 12" class="arrow" /></svg>
          <div><div class="bow-name">${esc(b.name)}</div><div class="bow-rarity">${r.name}</div></div>
        </div>
        ${bar('Dano', b.damage / strongest, String(b.damage))}
        ${bar('Carga', 0.6 / b.drawTime, `${b.drawTime.toFixed(2)} s`)}
        ${bar('Velocidade', b.maxArrowSpeed / fastest, `${b.maxArrowSpeed} m/s`)}
        ${bar('Estabilidade', b.stability, `${Math.round(b.stability * 100)}%`)}
        ${b.effect ? `<p class="bow-effect">✦ ${EFFECT_INFO[b.effect].name}: ${EFFECT_INFO[b.effect].description}</p>` : ''}
        ${action}
      </div>`;
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
      <label class="field setting check" for="set-invert"><input id="set-invert" name="invert" type="checkbox" ${s.invertY ? 'checked' : ''} /> <span>Inverter eixo vertical</span></label>
      ${slider('volume', 'Volume', 0, 1, 0.05, s.volume, pct)}
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
      s.invertY = data.get('invert') === 'on';
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
    form.querySelector('.reload-btn')!.addEventListener('click', () => location.reload());
    form.querySelector('.reset-btn')!.addEventListener('click', () => {
      Object.assign(s, { mouseSensitivity: 0.0022, touchLookMultiplier: 1.8, touchFireAimMultiplier: 1.2, invertY: false, volume: 0.8 });
      saveSettings(s);
      this.renderSettings();
    });
  }
}
