// HUD em HTML/CSS por cima do canvas: mira, tela de início/pausa e depuração.
export class HUD {
  private readonly overlay: HTMLElement;
  private readonly overlayTitle: HTMLElement;
  private readonly debug: HTMLElement;
  private debugVisible: boolean;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private readonly playLabel: string;

  constructor(root: HTMLElement, onPlay: () => void, showDebug: boolean, touch: boolean) {
    this.playLabel = touch ? 'Toque para jogar' : 'Clique para jogar';
    root.classList.toggle('touch', touch);
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="crosshair" aria-hidden="true">
        <svg viewBox="-20 -20 40 40" width="40" height="40">
          <circle class="ring" r="9" />
          <circle class="dot" r="1.6" />
        </svg>
      </div>
      <div class="debug" hidden></div>
      <div class="hint">F3: informações · Esc: pausar</div>
      <div class="overlay">
        <div class="panel">
          <h1>Arqueiros</h1>
          <p class="subtitle">Ruínas da Clareira</p>
          <p class="overlay-title">Clique para jogar</p>
          <ul class="controls controls-keys">
            <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> mover</li>
            <li><kbd>Mouse</kbd> mirar / girar a câmera</li>
            <li><kbd>Shift</kbd> correr</li>
            <li><kbd>Espaço</kbd> pular</li>
            <li><kbd>Esc</kbd> pausar</li>
          </ul>
          <ul class="controls controls-touch">
            <li><kbd>Esquerda</kbd> arraste para andar (até a borda corre)</li>
            <li><kbd>Direita</kbd> arraste para mirar</li>
            <li><kbd>Pular</kbd> botão no canto</li>
            <li>Jogue com o celular deitado.</li>
          </ul>
          <p class="stage">Etapa 1 — movimento e mapa</p>
        </div>
      </div>`,
    );
    this.overlay = root.querySelector('.overlay')!;
    this.overlayTitle = root.querySelector('.overlay-title')!;
    this.debug = root.querySelector('.debug')!;
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
  }

  setPaused(paused: boolean, firstTime: boolean): void {
    this.overlay.classList.toggle('hidden', !paused);
    this.overlayTitle.textContent = firstTime ? this.playLabel : `Pausado — ${this.playLabel.toLowerCase().replace(' jogar', ' continuar')}`;
  }

  update(frameDt: number, info: () => string): void {
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
