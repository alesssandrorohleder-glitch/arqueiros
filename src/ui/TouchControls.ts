// Controles de toque para celular: joystick à esquerda (empurrar até a borda
// corre), arrastar no lado direito para mirar e botão de pular.
import type { Input } from '../core/Input';

/** Raio do joystick em pixels. */
const STICK_RADIUS = 56;
/** A partir desta fração do raio o personagem corre. */
const SPRINT_THRESHOLD = 0.92;

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

  constructor(root: HTMLElement, private readonly input: Input, private readonly lookScale: () => number, onPause: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="touch-layer" hidden>
        <div class="stick-base" hidden><div class="stick-knob"></div></div>
        <button class="touch-btn fire-btn" type="button" aria-label="Atirar">Atirar</button>
        <button class="touch-btn jump-btn" type="button" aria-label="Pular">Pular</button>
        <button class="touch-btn pause-btn" type="button" aria-label="Pausar">II</button>
      </div>`,
    );
    this.layer = root.querySelector('.touch-layer')!;
    this.stickBase = this.layer.querySelector('.stick-base')!;
    this.stickKnob = this.layer.querySelector('.stick-knob')!;

    const jump = this.layer.querySelector<HTMLElement>('.jump-btn')!;
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.press('Space');
    });
    // Atirar: segurar puxa a corda, soltar dispara.
    const fire = this.layer.querySelector<HTMLElement>('.fire-btn')!;
    const release = () => {
      this.input.virtualPrimary = false;
      fire.classList.remove('active');
    };
    fire.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fire.setPointerCapture(e.pointerId);
      this.input.virtualPrimary = true;
      fire.classList.add('active');
    });
    fire.addEventListener('pointerup', release);
    fire.addEventListener('pointercancel', release);

    const pause = this.layer.querySelector<HTMLElement>('.pause-btn')!;
    pause.addEventListener('pointerdown', (e) => e.stopPropagation());
    pause.addEventListener('click', () => onPause());

    this.layer.addEventListener('pointerdown', (e) => this.onDown(e));
    this.layer.addEventListener('pointermove', (e) => this.onMove(e));
    this.layer.addEventListener('pointerup', (e) => this.onUp(e));
    this.layer.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  setVisible(visible: boolean): void {
    this.layer.hidden = !visible;
    if (!visible) {
      this.moveId = null;
      this.lookId = null;
      this.stickBase.hidden = true;
    }
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
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
