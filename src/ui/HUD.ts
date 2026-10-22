// HUD em HTML/CSS por cima do canvas: mira com carga e dispersão, marcador de
// acerto, números de dano, arco equipado, estatísticas, telas de início/pausa.
import * as THREE from 'three';
import { EFFECT_INFO, type BowDef } from '../data/bows';
import { COMBAT } from '../data/combat';
import { cssColor, RARITIES } from '../data/rarities';

/** Ícone de arco (cor da raridade via CSS). */
const BOW_ICON = '<svg class="bow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2 Q20 12 6 22" /><path d="M6 2 L6 22" class="string" /><path d="M3 12 L21 12" class="arrow" /></svg>';

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
  /** Inimigo sob a mira (a mira fica vermelha). */
  onTarget: boolean;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly debug: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly chargeArc: SVGCircleElement;
  private readonly ticks: SVGGElement[];
  private readonly hitMarker: HTMLElement;
  private readonly bowPanel: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly frenzyGlow: HTMLElement;
  private readonly frenzyBadge: HTMLElement;
  private readonly hasteBadge: HTMLElement;
  private buffsShown = '';
  private headshotTime = -1;
  private readonly floating: FloatingNumber[] = [];
  private readonly projected = new THREE.Vector3();
  private debugVisible: boolean;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private hitTimer = 0;
  private toastTimer = 0;
  private readonly touchMode: boolean;

  constructor(root: HTMLElement, showDebug: boolean, touch: boolean) {
    this.root = root;
    this.touchMode = touch;
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
      <div class="headshot-flash"></div>
      <div class="headshot-banner"><span class="hs-skull">💀</span><span class="hs-text">HEADSHOT!</span></div>
      <div class="frenzy-glow" hidden></div>
      <div class="buff-badges"><div class="frenzy-badge" hidden></div><div class="haste-badge" hidden></div></div>
      <div class="ability-panel"><span class="ab-key">E</span><div class="ab-text"><span class="ab-name"></span><span class="ab-state"></span></div></div>
      <div class="bow-panel"></div>
      <div class="debug" hidden></div>
      <div class="hint">E: habilidade · F3: informações · Esc: pausar</div>
`,
    );
    this.debug = root.querySelector('.debug')!;
    this.crosshair = root.querySelector('.crosshair')!;
    this.chargeArc = root.querySelector('.crosshair .charge')!;
    this.ticks = Array.from(root.querySelectorAll<SVGGElement>('.crosshair .tick'));
    this.hitMarker = root.querySelector('.hitmarker')!;
    this.bowPanel = root.querySelector('.bow-panel')!;
    this.stats = root.querySelector('.stats')!;
    this.toastEl = root.querySelector('.toast')!;
    this.frenzyGlow = root.querySelector('.frenzy-glow')!;
    this.frenzyBadge = root.querySelector('.frenzy-badge')!;
    this.hasteBadge = root.querySelector('.haste-badge')!;
    this.debugVisible = showDebug;
    this.debug.hidden = !showDebug;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugVisible = !this.debugVisible;
        this.debug.hidden = !this.debugVisible;
      }
    });
    this.setStats(0, 0, 0);
  }

  setBow(bow: BowDef, ownedCount = 1): void {
    const r = RARITIES[bow.rarity];
    this.bowPanel.style.setProperty('--rarity', cssColor(r.color));
    const effect = bow.effect ? `<span class="bow-effect">✦ ${EFFECT_INFO[bow.effect].name}</span>` : '';
    const swap = ownedCount > 1 ? `<span class="bow-swap">${this.touchMode ? 'Botão Arco' : 'Q'}: trocar (${ownedCount} arcos)</span>` : '';
    this.bowPanel.innerHTML = `${BOW_ICON}<div class="bow-text"><span class="bow-name">${bow.name}</span><span class="bow-rarity">${r.name} · ${Math.round(bow.damage * COMBAT.shotDamageFraction)} por flecha · ${(1 / (bow.fireInterval * COMBAT.fireIntervalScale)).toFixed(1)}/s</span>${effect}${swap}</div>`;
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
    this.crosshair.classList.toggle('on-target', c.onTarget);
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

  /**
   * Poderes do jogador (segundos restantes, 0 = sem): borda brilhante na tela
   * (laranja = Fúria, azul = Velocidade) e um contador para cada um.
   */
  setBuffs(frenzy: number, haste: number): void {
    const f = Math.ceil(frenzy);
    const h = Math.ceil(haste);
    const key = `${f}:${h}`;
    if (key === this.buffsShown) return;
    this.buffsShown = key;
    this.frenzyGlow.hidden = f <= 0 && h <= 0;
    this.frenzyGlow.classList.toggle('haste', f <= 0 && h > 0);
    this.frenzyBadge.hidden = f <= 0;
    this.frenzyBadge.textContent = `FÚRIA · ${f}s`;
    this.frenzyBadge.classList.toggle('ending', f <= 3);
    this.hasteBadge.hidden = h <= 0;
    this.hasteBadge.textContent = `VELOCIDADE · ${h}s`;
    this.hasteBadge.classList.toggle('ending', h <= 3);
  }

  /** Abate com tiro na cabeça: faixa dourada gigante + clarão nas bordas da tela. */
  headshotKill(streak: number): void {
    const banner = this.root.querySelector('.headshot-banner') as HTMLElement;
    (banner.querySelector('.hs-text') as HTMLElement).textContent = streak > 1 ? `HEADSHOT ×${streak}!` : 'HEADSHOT!';
    this.headshotTime = 0;
  }

  /** Anima a faixa "HEADSHOT!" (feito aqui, quadro a quadro, para não depender de animação CSS). */
  private animateHeadshot(dt: number): void {
    if (this.headshotTime < 0) return;
    this.headshotTime += dt;
    const banner = this.root.querySelector('.headshot-banner') as HTMLElement;
    const flash = this.root.querySelector('.headshot-flash') as HTMLElement;
    const t = this.headshotTime / 1.6;
    const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, Math.max(0, k));
    // Entra grande e girado, "bate" na tela, dá um pulinho e some subindo.
    let scale: number;
    let rot = 0;
    let y = 0;
    let opacity = 1;
    if (t < 0.12) {
      const k = 1 - (1 - t / 0.12) ** 3;
      scale = lerp(2.6, 0.92, k);
      rot = lerp(-6, 2, k);
      opacity = k;
    } else if (t < 0.2) {
      scale = lerp(0.92, 1.08, (t - 0.12) / 0.08);
      rot = lerp(2, -1, (t - 0.12) / 0.08);
    } else if (t < 0.28) {
      scale = lerp(1.08, 1, (t - 0.2) / 0.08);
      rot = lerp(-1, 0, (t - 0.2) / 0.08);
    } else {
      const k = Math.max(0, (t - 0.75) / 0.25);
      scale = 1 + 0.15 * k;
      y = -30 * k;
      opacity = 1 - k;
    }
    banner.style.opacity = String(Math.max(0, opacity));
    banner.style.transform = `translate(-50%, ${y}px) scale(${scale}) rotate(${rot}deg)`;
    flash.style.opacity = String(Math.max(0, 1 - this.headshotTime / 0.9));
    if (t >= 1) {
      this.headshotTime = -1;
      banner.style.opacity = '0';
      flash.style.opacity = '0';
    }
  }

  /** Painel da habilidade (PC): nome, tecla e recarga. */
  setAbility(name: string, color: string, cooldown: number, cooldownFrac: number, active: number): void {
    const panel = this.root.querySelector<HTMLElement>('.ability-panel')!;
    const key = `${name}|${Math.ceil(cooldown)}|${Math.ceil(active * 2)}`;
    if (panel.dataset.key === key) return;
    panel.dataset.key = key;
    panel.style.setProperty('--ab-color', color);
    panel.style.setProperty('--ab-cd', String(cooldownFrac));
    (panel.querySelector('.ab-name') as HTMLElement).textContent = name;
    (panel.querySelector('.ab-state') as HTMLElement).textContent = active > 0 ? `ativa · ${active.toFixed(1)}s` : cooldown > 0 ? `recarga ${Math.ceil(cooldown)}s` : 'pronta';
    panel.classList.toggle('ready', cooldown <= 0);
  }

  toast(text: string, color?: string): void {
    this.toastEl.textContent = text;
    this.toastEl.style.color = color ?? '';
    this.toastEl.hidden = false;
    this.toastTimer = 1.6;
  }

  spawnDamageNumber(pos: { x: number; y: number; z: number }, amount: number | string, headshot: boolean, kind: 'damage' | 'xp' = 'damage'): void {
    const el = document.createElement('div');
    el.className = kind === 'xp' ? 'damage xp' : headshot ? 'damage head' : 'damage';
    el.textContent = String(amount);
    this.root.appendChild(el);
    // Leve deslocamento aleatório para números seguidos não se sobreporem.
    this.floating.push({ el, pos: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.3, pos.y + 0.2, pos.z), age: 0 });
  }

  /** Atualiza tudo que anima por quadro. */
  update(frameDt: number, camera: THREE.Camera, info: () => string): void {
    this.animateHeadshot(frameDt);
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
