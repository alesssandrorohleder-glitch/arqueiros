// Controles de toque para celular: joystick à esquerda (empurrar até a borda
// corre), arrastar no lado direito para mirar, botão Atirar (segurar, arrastar
// para mirar, soltar), pular, trocar de arco e pausar.
import type { Input } from '../core/Input';

/** Raio do joystick em pixels. */
const STICK_RADIUS = 56;
/** A partir desta fração do raio o personagem corre. */
const SPRINT_THRESHOLD = 0.92;
/** Movimento do dedo nos últimos ms antes de soltar é desfeito (evita tiro torto). */
const RELEASE_IGNORE_MS = 70;

export const isTouchDevice = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;

export class TouchControls {
  private readonly layer: HTMLElement;
  private readonly stickBase: HTMLElement;
  private readonly stickKnob: HTMLElement;
  private moveId: number | null = null;
  private lookId: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private fireId: number | null = null;
  private fireLast: { x: number; y: number } | null = null;
  /** Movimentos recentes do dedo do Atirar (para desfazer o escorregão ao soltar). */
  private readonly recentAim: { t: number; dx: number; dy: number }[] = [];
  /** Círculo que segue o dedo do Atirar (mostra que está mirando). */
  private readonly aimRing: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly input: Input,
    private readonly lookScale: () => number,
    private readonly fireAimScale: () => number,
    onPause: () => void,
  ) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="touch-layer" hidden>
        <div class="stick-base" hidden><div class="stick-knob"></div></div>
        <div class="aim-ring" hidden></div>
        <button class="touch-btn fire-btn" type="button" aria-label="Atirar">Atirar</button>
        <button class="touch-btn jump-btn" type="button" aria-label="Pular">Pular</button>
        <button class="touch-btn ability-btn ab1" type="button" aria-label="Habilidade"><span class="ab-label">Hab.</span></button>
        <button class="touch-btn ability-btn ab2" type="button" aria-label="Segunda habilidade"><span class="ab-label">Hab. 2</span></button>
        <button class="touch-btn pause-btn" type="button" aria-label="Pausar">II</button>
      </div>`,
    );
    this.layer = root.querySelector('.touch-layer')!;
    this.stickBase = this.layer.querySelector('.stick-base')!;
    this.stickKnob = this.layer.querySelector('.stick-knob')!;
    this.aimRing = this.layer.querySelector('.aim-ring')!;

    const jump = this.layer.querySelector<HTMLElement>('.jump-btn')!;
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.press('Space');
    });
    // Atirar (como a sniper do COD Mobile): tocar puxa a corda e o MESMO dedo
    // vira a mira na hora — arrastar move a mira, soltar dispara. O dedo é
    // acompanhado na tela inteira (pode sair de cima do botão).
    const fire = this.layer.querySelector<HTMLElement>('.fire-btn')!;
    fire.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        fire.setPointerCapture(e.pointerId);
      } catch {
        // sem captura: os eventos ainda chegam pela janela
      }
      this.fireId = e.pointerId;
      this.fireLast = { x: e.clientX, y: e.clientY };
      this.recentAim.length = 0;
      this.input.virtualPrimary = true;
      fire.classList.add('active');
      this.showAimRing(e.clientX, e.clientY);
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.fireId || !this.fireLast) return;
      const k = this.lookScale() * this.fireAimScale();
      const dx = (e.clientX - this.fireLast.x) * k;
      const dy = (e.clientY - this.fireLast.y) * k;
      this.input.addLook(dx, dy);
      this.recentAim.push({ t: performance.now(), dx, dy });
      this.fireLast = { x: e.clientX, y: e.clientY };
      this.showAimRing(e.clientX, e.clientY);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.fireId) return;
      // Ao levantar o dedo ele costuma escorregar: desfaz o movimento dos
      // últimos instantes para o tiro sair onde a mira estava.
      const since = performance.now() - RELEASE_IGNORE_MS;
      let ux = 0;
      let uy = 0;
      for (const m of this.recentAim) {
        if (m.t >= since) {
          ux += m.dx;
          uy += m.dy;
        }
      }
      this.input.addLook(-ux, -uy);
      // O disparo espera essa correção ser aplicada à mira (próximo quadro).
      this.input.releaseVirtualPrimary();
      this.fireId = null;
      this.fireLast = null;
      fire.classList.remove('active');
      this.aimRing.hidden = true;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    for (const [sel, key] of [['.ability-btn.ab1', 'KeyE'], ['.ability-btn.ab2', 'KeyQ']] as const) {
      this.layer.querySelector<HTMLElement>(sel)!.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.input.press(key);
      });
    }

    const pause = this.layer.querySelector<HTMLElement>('.pause-btn')!;
    pause.addEventListener('pointerdown', (e) => e.stopPropagation());
    pause.addEventListener('click', () => onPause());

    this.layer.addEventListener('pointerdown', (e) => this.onDown(e));
    this.layer.addEventListener('pointermove', (e) => this.onMove(e));
    this.layer.addEventListener('pointerup', (e) => this.onUp(e));
    this.layer.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  private showAimRing(x: number, y: number): void {
    this.aimRing.hidden = false;
    this.aimRing.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  setVisible(visible: boolean): void {
    this.layer.hidden = !visible;
    if (!visible) {
      this.moveId = null;
      this.lookId = null;
      this.fireId = null;
      this.fireLast = null;
      this.input.virtualPrimary = false;
      this.aimRing.hidden = true;
      this.stickBase.hidden = true;
    }
  }

  /** Botão da habilidade: nome curto, cor e anel de recarga (0 = pronta, 1 = acabou de usar). */
  setAbility(label: string, color: string, cooldownFrac: number, slot: 1 | 2 = 1): void {
    const btn = this.layer.querySelector<HTMLElement>(`.ability-btn.ab${slot}`)!;
    const lab = btn.querySelector<HTMLElement>('.ab-label')!;
    if (lab.textContent !== label) lab.textContent = label;
    btn.style.setProperty('--ab-color', color);
    btn.style.setProperty('--ab-cd', String(Math.max(0, Math.min(1, cooldownFrac))));
    btn.classList.toggle('ready', cooldownFrac <= 0);
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    if (e.pointerId === this.fireId) return;
    this.layer.setPointerCapture(e.pointerId);
    if (e.clientX < window.innerWidth * 0.45 && this.moveId === null) {
      this.moveId = e.pointerId;
      this.moveOrigin = { x: e.clientX, y: e.clientY };
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
      this.stickBase.hidden = false;
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId === this.moveId) {
      let dx = e.clientX - this.moveOrigin.x;
      let dy = e.clientY - this.moveOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.input.virtualMove.x = dx / STICK_RADIUS;
      this.input.virtualMove.y = -dy / STICK_RADIUS;
      this.input.virtualSprint = len / STICK_RADIUS >= SPRINT_THRESHOLD && dy < 0;
    } else if (e.pointerId === this.lookId) {
      const k = this.lookScale();
      this.input.addLook((e.clientX - this.lookLast.x) * k, (e.clientY - this.lookLast.y) * k);
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId === this.moveId) {
      this.moveId = null;
      this.stickBase.hidden = true;
      this.input.virtualMove.x = 0;
      this.input.virtualMove.y = 0;
      this.input.virtualSprint = false;
    } else if (e.pointerId === this.lookId) {
      this.lookId = null;
    }
  }
}
