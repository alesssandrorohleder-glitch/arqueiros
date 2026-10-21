// Captura teclado e mouse. Usa `event.code` (posição física da tecla), então
// WASD funciona igual em teclados ABNT2, US, AZERTY etc.
export class Input {
  private readonly keys = new Set<string>();
  private readonly pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private buttons = 0;
  /** true quando o mouse está capturado (pointer lock). */
  locked = false;
  /** Modo de teste: aceita teclado sem pointer lock (?nolock=1). */
  allowUnlocked = false;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    element.addEventListener('mousedown', (e) => {
      if (this.active) this.buttons |= 1 << e.button;
    });
    window.addEventListener('mouseup', (e) => (this.buttons &= ~(1 << e.button)));
    element.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
      if (!this.locked) this.reset();
    });
  }

  get active(): boolean {
    return this.locked || this.allowUnlocked;
  }

  requestLock(): void {
    const req = this.element.requestPointerLock() as unknown as Promise<void> | undefined;
    req?.catch?.(() => undefined);
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** Tecla apertada desde a última chamada de `endFrame`. */
  wasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  mouseButton(button: number): boolean {
    return (this.buttons & (1 << button)) !== 0;
  }

  /** Lê e zera o movimento acumulado do mouse. */
  consumeMouse(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  endFrame(): void {
    this.pressed.clear();
  }

  private reset(): void {
    this.keys.clear();
    this.pressed.clear();
    this.buttons = 0;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
