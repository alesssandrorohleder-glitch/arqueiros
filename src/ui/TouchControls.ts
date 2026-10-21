// Controles de toque para celular: joystick à esquerda (empurrar até a borda
// corre), arrastar no lado direito para mirar, botão Atirar (segurar, arrastar
// para mirar, soltar), pular, trocar de arco e pausar.
import type { Input } from '../core/Input';

/** Raio do joystick em pixels. */
const STICK_RADIUS = 56;
/** A partir desta fração do raio o personagem corre. */
const SPRINT_THRESHOLD = 0.92;
/** Sensibilidade ao mirar arrastando o botão Atirar (relativa à do lado direito da tela). */
const FIRE_AIM_SCALE = 1.2;
/** Distância (px) do ponto de toque a partir da qual a mira gira sozinha, e até onde acelera. */
const AIM_STICK_DEADZONE = 45;
const AIM_STICK_RANGE = 90;

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
  private fireOrigin = { x: 0, y: 0 };
  /** Círculo que segue o dedo do Atirar (mostra que está mirando). */
  private readonly aimRing: HTMLElement;

  constructor(root: HTMLElement, private readonly input: Input, private readonly lookScale: () => number, onPause: () => void, onSwitchBow: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="touch-layer" hidden>
        <div class="stick-base" hidden><div class="stick-knob"></div></div>
        <div class="aim-ring" hidden></div>
        <button class="touch-btn fire-btn" type="button" aria-label="Atirar">Atirar</button>
        <button class="touch-btn jump-btn" type="button" aria-label="Pular">Pular</button>
        <button class="touch-btn bow-btn" type="button" aria-label="Trocar arco">Arco</button>
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
    // Atirar: segurar puxa a corda, arrastar o mesmo dedo mira, soltar dispara.
    // O dedo é acompanhado na tela inteira (pode sair de cima do botão), então
    // dá para corrigir a mira enquanto carrega, com o outro polegar no joystick.
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
      this.fireOrigin = { x: e.clientX, y: e.clientY };
      this.input.virtualPrimary = true;
      fire.classList.add('active');
      this.showAimRing(e.clientX, e.clientY);
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.fireId || !this.fireLast) return;
      const k = this.lookScale() * FIRE_AIM_SCALE;
      this.input.addLook((e.clientX - this.fireLast.x) * k, (e.clientY - this.fireLast.y) * k);
      this.fireLast = { x: e.clientX, y: e.clientY };
      // Longe do ponto onde tocou: além de mover, a mira continua girando
      // para aquele lado (não fica limitada pela borda da tela).
      const ox = e.clientX - this.fireOrigin.x;
      const oy = e.clientY - this.fireOrigin.y;
      const dist = Math.hypot(ox, oy);
      const push = Math.max(0, Math.min(1, (dist - AIM_STICK_DEADZONE) / AIM_STICK_RANGE));
      this.input.virtualLook.x = dist > 0 ? (ox / dist) * push : 0;
      this.input.virtualLook.y = dist > 0 ? (oy / dist) * push : 0;
      this.showAimRing(e.clientX, e.clientY);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.fireId) return;
      this.fireId = null;
      this.fireLast = null;
      this.input.virtualPrimary = false;
      this.input.virtualLook.x = 0;
      this.input.virtualLook.y = 0;
      fire.classList.remove('active');
      this.aimRing.hidden = true;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    const bowBtn = this.layer.querySelector<HTMLElement>('.bow-btn')!;
    bowBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSwitchBow();
    });

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
      this.input.virtualLook.x = 0;
      this.input.virtualLook.y = 0;
      this.aimRing.hidden = true;
      this.stickBase.hidden = true;
    }
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
