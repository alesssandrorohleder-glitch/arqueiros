// Loop com passo fixo para a simulação (determinística, pronta para rede) e
// renderização livre, interpolando entre os dois últimos estados.
export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

export class GameLoop {
  private accumulator = 0;
  private last = 0;
  private running = false;
  /** Câmera lenta: < 1 deixa a simulação mais devagar (só no modo offline). */
  timeScale = 1;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private errors = 0;

  private frame = (now: number): void => {
    if (!this.running) return;
    const frameDt = Math.max(0, Math.min((now - this.last) / 1000, 0.25));
    this.last = now;
    this.accumulator += frameDt * this.timeScale;
    // O próximo quadro é pedido antes: um erro neste quadro não pode congelar o jogo.
    requestAnimationFrame(this.frame);
    try {
      let steps = 0;
      while (this.accumulator >= TICK_DT && steps < MAX_STEPS_PER_FRAME) {
        this.step(TICK_DT);
        this.accumulator -= TICK_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0; // evita "espiral da morte"
      this.render(this.accumulator / TICK_DT, frameDt);
    } catch (err) {
      this.accumulator = 0;
      if (this.errors++ < 5) console.error('Erro no quadro do jogo (o jogo continua):', err);
    }
  };
}
