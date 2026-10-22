// Sons gerados por síntese (Web Audio): nada é baixado. Cada som é montado na
// hora com osciladores e ruído filtrado. Sons com posição saem do lado certo
// (pan estéreo) e ficam mais baixos com a distância.
import type { Vec3 } from './math';

type Pos = { x: number; y: number; z: number };

export type SoundName =
  | 'draw' | 'release' | 'hitBody' | 'hitHead' | 'hitMarker' | 'arrowStick' | 'kill' | 'death'
  | 'explosion' | 'frost' | 'ricochet' | 'step' | 'jump' | 'land' | 'hurt' | 'pickup' | 'click'
  | 'wolf' | 'boar' | 'golem' | 'mobDeath' | 'fanfare';

/** Distância (m) em que um som cai para metade do volume. */
const HALF_DISTANCE = 10;
/** Além disto, sons com posição nem tocam. */
const MAX_DISTANCE = 80;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private listener = { x: 0, z: 0, yaw: 0 };
  private ambientGain: GainNode | null = null;
  private birdTimer = 4;
  private volume = 0.8;

  /** Precisa ser chamado a partir de um toque/clique (regra dos navegadores). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    // Compressor: evita estouro quando muitos sons tocam juntos.
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /** Posição e direção de quem ouve (a câmera). */
  setListener(p: Pos, yaw: number): void {
    this.listener.x = p.x;
    this.listener.z = p.z;
    this.listener.yaw = yaw;
  }

  update(dt: number): void {
    if (!this.ctx) return;
    // Pássaros aleatórios em volta.
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 4 + Math.random() * 8;
      const a = Math.random() * Math.PI * 2;
      const d = 15 + Math.random() * 30;
      this.bird({ x: this.listener.x + Math.cos(a) * d, y: 0, z: this.listener.z + Math.sin(a) * d });
    }
  }

  play(name: SoundName, pos?: Vec3, intensity = 1): void {
    const out = this.output(pos, intensity);
    if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    const r = () => 0.92 + Math.random() * 0.16; // variação para não soar repetido
    switch (name) {
      case 'draw':
        this.noise(out, t, 0.7, 'bandpass', 700 * r(), 1500, 6, 0.18);
        this.tone(out, t, 0.6, 'sawtooth', 70, 95, 0.03);
        break;
      case 'release':
        this.tone(out, t, 0.28, 'triangle', 210 * intensity * r() + 60, 90, 0.5);
        this.noise(out, t, 0.06, 'highpass', 3500, 3500, 1, 0.35);
        this.noise(out, t + 0.02, 0.25, 'bandpass', 1800, 600, 2, 0.12); // assobio da flecha
        break;
      case 'hitBody':
        this.noise(out, t, 0.12, 'lowpass', 900, 300, 1, 0.6);
        this.tone(out, t, 0.12, 'sine', 120 * r(), 60, 0.5);
        break;
      case 'hitHead':
        this.noise(out, t, 0.1, 'lowpass', 1200, 400, 1, 0.5);
        this.tone(out, t, 0.35, 'sine', 1320, 1320, 0.25);
        this.tone(out, t + 0.03, 0.3, 'sine', 1980, 1980, 0.15);
        break;
      case 'hitMarker':
        this.tone(out, t, 0.04, 'square', 2600, 2600, 0.06);
        break;
      case 'arrowStick':
        this.noise(out, t, 0.08, 'bandpass', 500 * r(), 300, 2, 0.4);
        this.tone(out, t, 0.07, 'triangle', 240 * r(), 180, 0.2);
        break;
      case 'kill':
        this.tone(out, t, 0.12, 'triangle', 660, 660, 0.3);
        this.tone(out, t + 0.1, 0.22, 'triangle', 990, 990, 0.3);
        break;
      case 'death':
        this.tone(out, t, 0.7, 'sine', 320, 70, 0.4);
        this.noise(out, t, 0.4, 'lowpass', 600, 150, 1, 0.3);
        break;
      case 'explosion':
        this.noise(out, t, 1.3, 'lowpass', 1400, 120, 1, 1.0);
        this.tone(out, t, 0.9, 'sine', 70, 28, 0.9);
        break;
      case 'frost':
        this.noise(out, t, 0.3, 'highpass', 5000, 7000, 1, 0.3);
        this.tone(out, t, 0.25, 'sine', 2200, 3200, 0.1);
        break;
      case 'ricochet':
        this.tone(out, t, 0.18, 'sine', 2600 * r(), 1700, 0.25);
        break;
      case 'step':
        this.noise(out, t, 0.07, 'lowpass', 700 * r(), 300, 1, 0.12 * intensity);
        break;
      case 'jump':
        this.noise(out, t, 0.1, 'lowpass', 900, 500, 1, 0.12);
        break;
      case 'land':
        this.noise(out, t, 0.12, 'lowpass', 500, 150, 1, 0.3 * intensity);
        this.tone(out, t, 0.1, 'sine', 90, 50, 0.25 * intensity);
        break;
      case 'hurt':
        this.tone(out, t, 0.25, 'sine', 140, 60, 0.6);
        this.noise(out, t, 0.15, 'lowpass', 800, 200, 1, 0.4);
        break;
      case 'pickup': {
        // Mais notas quanto mais rara (intensity = 1 a 5).
        const notes = [523, 659, 784, 1047, 1319];
        for (let i = 0; i < Math.max(2, Math.round(intensity)); i++) this.tone(out, t + i * 0.08, 0.18, 'triangle', notes[i], notes[i], 0.25);
        break;
      }
      case 'click':
        this.tone(out, t, 0.04, 'triangle', 900, 900, 0.15);
        break;
      case 'wolf':
        this.tone(out, t, 0.45, 'sawtooth', 130 * r(), 95, 0.18, 700);
        break;
      case 'boar':
        this.tone(out, t, 0.3, 'sawtooth', 380 * r(), 650, 0.14, 1800);
        break;
      case 'golem':
        this.tone(out, t, 0.9, 'sine', 55, 40, 0.6);
        this.noise(out, t, 0.9, 'lowpass', 350, 120, 1, 0.5);
        break;
      case 'mobDeath':
        this.tone(out, t, 0.5, 'sawtooth', 260 * r(), 80, 0.15, 900);
        break;
      case 'fanfare': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((n, i) => this.tone(out, t + i * 0.14, i === 3 ? 0.6 : 0.2, 'triangle', n, n, 0.3));
        break;
      }
    }
  }

  // ---------------------------------------------------------------- internos

  /** Nó de saída com volume pela distância e pan pelo lado. */
  private output(pos: Vec3 | undefined, intensity: number): AudioNode | null {
    if (!this.ctx || !this.master || this.ctx.state !== 'running') return null;
    if (!pos) return this.master;
    const dx = pos.x - this.listener.x;
    const dz = pos.z - this.listener.z;
    const d = Math.hypot(dx, dz);
    if (d > MAX_DISTANCE) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = Math.min(1, intensity) / (1 + (d / HALF_DISTANCE) ** 1.4);
    const panner = this.ctx.createStereoPanner();
    // Direita da câmera = (cos yaw, -sen yaw).
    const right = (dx * Math.cos(this.listener.yaw) - dz * Math.sin(this.listener.yaw)) / Math.max(d, 1);
    panner.pan.value = Math.max(-1, Math.min(1, right)) * 0.8;
    gain.connect(panner).connect(this.master);
    return gain;
  }

  private env(g: GainNode, t: number, dur: number, peak: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private tone(out: AudioNode, t: number, dur: number, type: OscillatorType, f0: number, f1: number, peak: number, lowpass?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, dur, peak);
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      osc.connect(f).connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(out: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, dur, peak);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private bird(pos: Pos): void {
    const out = this.output(pos, 0.5);
    if (!out || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1400;
    for (let i = 0; i < n; i++) this.tone(out, t + i * 0.12, 0.08, 'sine', base, base * 1.35, 0.12);
  }

  /** Vento contínuo: ruído grave com volume que oscila devagar. */
  private startAmbient(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(this.ambientGain.gain);
    src.connect(f).connect(this.ambientGain).connect(this.master!);
    src.start();
    lfo.start();
  }
}
