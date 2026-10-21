// HUD em HTML/CSS por cima do canvas: mira com carga e dispersão, marcador de
// acerto, números de dano, arco equipado, estatísticas, telas de início/pausa.
import * as THREE from 'three';
import type { BowDef } from '../data/bows';
import { cssColor, RARITIES } from '../data/rarities';

/** Raio do anel de carga em volta da mira (px). */
const CHARGE_R = 17;
const CHARGE_LEN = 2 * Math.PI * CHARGE_R;

interface FloatingNumber {
  el: HTMLElement;
  pos: THREE.Vector3;
  age: number;
}

export interface CrosshairState {
  drawing: boolean;
  /** 0 a 1. */
  charge: number;
  /** Raio da dispersão em pixels de tela. */
  spreadPx: number;
  /** Braço cansado (mira tremendo). */
  tired: boolean;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly overlayTitle: HTMLElement;
  private readonly debug: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly chargeArc: SVGCircleElement;
  private readonly ticks: SVGGElement[];
  private readonly hitMarker: HTMLElement;
  private readonly bowPanel: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly floating: FloatingNumber[] = [];
  private readonly projected = new THREE.Vector3();
  private debugVisible: boolean;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private hitTimer = 0;
  private toastTimer = 0;
  private readonly playLabel: string;
  /** Onde o cartão do perfil é mostrado (tela inicial/pausa). */
  readonly accountSlot: HTMLElement;

  constructor(root: HTMLElement, onPlay: () => void, showDebug: boolean, touch: boolean) {
    this.root = root;
    this.playLabel = touch ? 'Toque para jogar' : 'Clique para jogar';
    root.classList.toggle('touch', touch);
    const tick = (rot: number) =>
      `<g class="tick" data-rot="${rot}"><line x1="0" y1="-4" x2="0" y2="-10" /></g>`;
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="crosshair" aria-hidden="true">
        <svg viewBox="-60 -60 120 120" width="120" height="120">
          <circle class="charge-track" r="${CHARGE_R}" />
          <circle class="charge" r="${CHARGE_R}" stroke-dasharray="0 ${CHARGE_LEN}" transform="rotate(-90)" />
          ${tick(0)}${tick(90)}${tick(180)}${tick(270)}
          <circle class="dot" r="1.6" />
        </svg>
      </div>
      <div class="hitmarker" aria-hidden="true">
        <svg viewBox="-20 -20 40 40" width="40" height="40">
          <path d="M-12 -12 L-5 -5 M12 -12 L5 -5 M-12 12 L-5 5 M12 12 L5 5" />
        </svg>
      </div>
      <div class="stats"></div>
      <div class="toast" hidden></div>
      <div class="bow-panel"></div>
      <div class="debug" hidden></div>
      <div class="hint">F3: informações · Esc: pausar</div>
      <div class="overlay">
        <div class="panel">
          <h1>Arqueiros</h1>
          <p class="subtitle">Ruínas da Clareira</p>
          <p class="overlay-title">${this.playLabel}</p>
          <ul class="controls controls-keys">
            <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> mover</li>
            <li><kbd>Mouse</kbd> mirar / girar a câmera</li>
            <li><kbd>Botão esq.</kbd> segure para puxar, solte para atirar</li>
            <li><kbd>Botão dir.</kbd> cancelar o tiro</li>
            <li><kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular</li>
            <li><kbd>Tab</kbd> placar · <kbd>Esc</kbd> pausar</li>
          </ul>
          <ul class="controls controls-touch">
            <li><kbd>Esquerda</kbd> arraste para andar (até a borda corre)</li>
            <li><kbd>Direita</kbd> arraste para mirar</li>
            <li><kbd>Atirar</kbd> segure para puxar, solte para atirar</li>
            <li>Jogue com o celular deitado.</li>
          </ul>
          <div class="account-slot"></div>
          <p class="tip">Todos contra todos por 5 minutos: elimine os 5 arqueiros rivais. Fique parado para a mira fechar; segurar puxado demais cansa o braço.</p>
          <p class="stage">Etapa 3 — bots, vida e eliminação</p>
        </div>
      </div>`,
    );
    this.overlay = root.querySelector('.overlay')!;
    this.overlayTitle = root.querySelector('.overlay-title')!;
    this.debug = root.querySelector('.debug')!;
    this.crosshair = root.querySelector('.crosshair')!;
    this.chargeArc = root.querySelector('.crosshair .charge')!;
    this.ticks = Array.from(root.querySelectorAll<SVGGElement>('.crosshair .tick'));
    this.hitMarker = root.querySelector('.hitmarker')!;
    this.bowPanel = root.querySelector('.bow-panel')!;
    this.stats = root.querySelector('.stats')!;
    this.toastEl = root.querySelector('.toast')!;
    this.accountSlot = root.querySelector('.account-slot')!;
    this.debugVisible = showDebug;
    this.debug.hidden = !showDebug;
    this.overlay.addEventListener('click', onPlay);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugVisible = !this.debugVisible;
        this.debug.hidden = !this.debugVisible;
      }
    });
    this.setStats(0, 0, 0);
  }

  setPaused(paused: boolean, firstTime: boolean): void {
    this.overlay.classList.toggle('hidden', !paused);
    this.overlayTitle.textContent = firstTime ? this.playLabel : `Pausado — ${this.playLabel.toLowerCase().replace(' jogar', ' continuar')}`;
  }

  setBow(bow: BowDef): void {
    const r = RARITIES[bow.rarity];
    this.bowPanel.style.setProperty('--rarity', cssColor(r.color));
    this.bowPanel.innerHTML = `<span class="bow-name">${bow.name}</span><span class="bow-rarity">${r.name} · dano ${bow.damage}</span>`;
  }

  setStats(shots: number, hits: number, heads: number): void {
    const acc = shots ? Math.round((hits / shots) * 100) : 0;
    this.stats.innerHTML = `Tiros <b>${shots}</b> · Acertos <b>${hits}</b> (${acc}%) · Na cabeça <b>${heads}</b>`;
  }

  updateCrosshair(c: CrosshairState): void {
    const len = CHARGE_LEN * c.charge;
    this.chargeArc.setAttribute('stroke-dasharray', `${len} ${CHARGE_LEN}`);
    this.crosshair.classList.toggle('drawing', c.drawing);
    this.crosshair.classList.toggle('full', c.drawing && c.charge >= 1);
    this.crosshair.classList.toggle('tired', c.tired);
    const gap = Math.min(45, c.spreadPx);
    for (const t of this.ticks) {
      t.setAttribute('transform', `rotate(${t.dataset.rot}) translate(0 ${-gap})`);
    }
  }

  showHitMarker(headshot: boolean): void {
    this.hitTimer = 0.25;
    this.hitMarker.classList.toggle('head', headshot);
    this.hitMarker.classList.add('show');
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    this.toastTimer = 1.6;
  }

  spawnDamageNumber(pos: { x: number; y: number; z: number }, amount: number, headshot: boolean): void {
    const el = document.createElement('div');
    el.className = headshot ? 'damage head' : 'damage';
    el.textContent = String(amount);
    this.root.appendChild(el);
    // Leve deslocamento aleatório para números seguidos não se sobreporem.
    this.floating.push({ el, pos: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.3, pos.y + 0.2, pos.z), age: 0 });
  }

  /** Atualiza tudo que anima por quadro. */
  update(frameDt: number, camera: THREE.Camera, info: () => string): void {
    this.hitTimer -= frameDt;
    if (this.hitTimer <= 0) this.hitMarker.classList.remove('show');
    if (this.toastTimer > 0) {
      this.toastTimer -= frameDt;
      if (this.toastTimer <= 0) this.toastEl.hidden = true;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = this.floating.length - 1; i >= 0; i--) {
      const f = this.floating[i];
      f.age += frameDt;
      const life = 0.9;
      if (f.age >= life) {
        f.el.remove();
        this.floating.splice(i, 1);
        continue;
      }
      this.projected.copy(f.pos);
      this.projected.y += f.age * 0.9;
      this.projected.project(camera);
      const behind = this.projected.z > 1;
      const x = (this.projected.x * 0.5 + 0.5) * w;
      const y = (-this.projected.y * 0.5 + 0.5) * h;
      const scale = f.age < 0.1 ? 1.4 - f.age * 4 : 1;
      f.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
      f.el.style.opacity = behind ? '0' : String(Math.min(1, (life - f.age) * 3));
    }

    this.fpsFrames++;
    this.fpsTime += frameDt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
      if (this.debugVisible) this.debug.textContent = `${this.fps} FPS\n${info()}`;
    }
  }
}
