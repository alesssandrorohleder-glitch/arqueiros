// Efeitos visuais passageiros: explosão (clarão, bola de fogo, fumaça e
// faíscas), estilhaços de gelo e faísca de ricochete.
import * as THREE from 'three';

interface Burst {
  points: THREE.Points;
  velocities: Float32Array;
  age: number;
  life: number;
  gravity: number;
}

interface Blob {
  mesh: THREE.Sprite;
  age: number;
  life: number;
  from: number;
  to: number;
  opacity: number;
}

export class EffectsView {
  private readonly bursts: Burst[] = [];
  private readonly blobs: Blob[] = [];
  /** Uma única luz reaproveitada (criar luzes recompila os shaders). */
  private readonly flash = new THREE.PointLight(0xffa040, 0, 14, 2);
  private flashTime = 0;
  /** Textura de brilho suave (degradê radial), usada nos clarões e na fumaça. */
  private readonly soft: THREE.Texture = softTexture();
  private readonly ringTex: THREE.Texture = ringTexture();
  private readonly skull: THREE.Texture = skullTexture();
  private readonly floaters: { mesh: THREE.Sprite; age: number; life: number; rise: number }[] = [];
  /** Raios das torres e ondas de choque no chão (malhas que somem com o tempo). */
  private readonly fading: { mesh: THREE.Mesh; age: number; life: number; grow: number }[] = [];

  constructor(private readonly scene: THREE.Scene) {
    scene.add(this.flash);
  }

  explosion(p: { x: number; y: number; z: number }, radius: number): void {
    this.flash.position.set(p.x, p.y + 0.5, p.z);
    this.flash.intensity = 60;
    this.flashTime = 0.35;
    this.blob(p, 0xffc060, 0.3, radius * 1.3, 0.4, 1, true);
    this.blob(p, 0xff6a20, 0.2, radius * 0.9, 0.3, 1, true);
    this.blob(p, 0xffffff, 0.2, radius * 0.5, 0.15, 1, true);
    this.blob({ x: p.x, y: p.y + 0.8, z: p.z }, 0x4a4440, radius * 0.4, radius * 1.4, 1.4, 0.55, false);
    this.burst(p, 50, 0xffc060, 9, 0.9, 12, 0.18);
  }

  frost(p: { x: number; y: number; z: number }): void {
    this.blob(p, 0x9fe8ff, 0.1, 0.9, 0.35, 0.7, true);
    this.burst(p, 24, 0xcff6ff, 4, 0.6, 4, 0.12);
  }

  ricochet(p: { x: number; y: number; z: number }): void {
    this.burst(p, 12, 0xfff2b0, 5, 0.3, 8, 0.08);
  }

  private blob(p: { x: number; y: number; z: number }, color: number, from: number, to: number, life: number, opacity: number, additive: boolean): void {
    const mat = new THREE.SpriteMaterial({
      map: this.soft,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Sprite(mat);
    mesh.position.set(p.x, p.y, p.z);
    mesh.scale.setScalar(from * 2);
    this.scene.add(mesh);
    this.blobs.push({ mesh, age: 0, life, from, to, opacity });
  }

  /** Poeira/terra (flecha cravando, passos). */
  dust(p: { x: number; y: number; z: number }, color = 0x8a6e4a, count = 10, speed = 2): void {
    this.burst(p, count, color, speed, 0.5, 6, 0.09, false);
  }

  /** Faíscas de acerto. */
  sparks(p: { x: number; y: number; z: number }, color = 0xffe0a0): void {
    this.burst(p, 14, color, 4, 0.3, 6, 0.07);
  }

  /**
   * Clarão no arco ao atirar, na cor da raridade (`rank` 0 = comum … 4 = lendário):
   * quanto mais raro, maior o clarão e mais faíscas.
   */
  muzzle(p: { x: number; y: number; z: number }, color: number, rank: number): void {
    this.blob(p, 0xffffff, 0.06, 0.25 + rank * 0.06, 0.09, 0.9, true);
    this.blob(p, color, 0.1, 0.45 + rank * 0.15, 0.16 + rank * 0.03, 0.8, true);
    this.burst(p, 6 + rank * 5, color, 2.5 + rank * 0.6, 0.25 + rank * 0.05, 2, 0.05 + rank * 0.012);
  }

  /** Impacto da flecha: clarão e faíscas na cor da raridade; maior em acertos na cabeça. */
  impact(p: { x: number; y: number; z: number }, color: number, rank: number, big = false): void {
    const k = big ? 1.5 : 1;
    this.blob(p, color, 0.1, (0.5 + rank * 0.14) * k, 0.18, 0.85, true);
    this.blob(p, 0xffffff, 0.05, 0.22 * k, 0.08, 0.9, true);
    this.burst(p, Math.round((10 + rank * 6) * k), color, (3.5 + rank * 0.5) * k, 0.35, 7, 0.06 + rank * 0.01);
  }

  /**
   * Abate com tiro na cabeça: clarão dourado, onda de choque, chuva de faíscas
   * douradas e uma caveira subindo.
   */
  headshotKill(p: { x: number; y: number; z: number }): void {
    this.flash.color.setHex(0xffd060);
    this.flash.position.set(p.x, p.y + 0.3, p.z);
    this.flash.intensity = 60;
    this.flashTime = 0.35;
    this.blob(p, 0xffffff, 0.2, 1.2, 0.18, 1, true);
    this.blob(p, 0xffc040, 0.3, 2.6, 0.45, 0.9, true);
    this.blob(p, 0xff7a20, 0.2, 1.6, 0.6, 0.6, true);
    this.ring(p, 0xffd060, 4.5, 0.55);
    this.ring({ x: p.x, y: p.y - 0.4, z: p.z }, 0xffffff, 2.6, 0.35);
    this.burst(p, 70, 0xffd060, 8, 1.1, 9, 0.11);
    this.burst(p, 30, 0xffffff, 5, 0.6, 4, 0.08);
    // Caveira que sobe e some.
    const mat = new THREE.SpriteMaterial({ map: this.skull, transparent: true, depthWrite: false, depthTest: false, color: 0xffe9a0 });
    const sk = new THREE.Sprite(mat);
    sk.position.set(p.x, p.y + 0.6, p.z);
    sk.renderOrder = 10;
    this.scene.add(sk);
    this.floaters.push({ mesh: sk, age: 0, life: 1.4, rise: 1.4 });
  }

  /** Anel de onda de choque (sempre de frente para a câmera). */
  private ring(p: { x: number; y: number; z: number }, color: number, to: number, life: number): void {
    const mat = new THREE.SpriteMaterial({ map: this.ringTex, color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Sprite(mat);
    mesh.position.set(p.x, p.y, p.z);
    this.scene.add(mesh);
    this.blobs.push({ mesh, age: 0, life, from: 0.1, to, opacity: 1 });
  }

  /** Efeito de uso de habilidade (cor do personagem). */
  abilityFx(kind: string, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, color: number): void {
    const up = (p: { x: number; y: number; z: number }, h: number) => ({ x: p.x, y: p.y + h, z: p.z });
    switch (kind) {
      case 'emp':
        this.ring(up(from, 0.6), color, 8, 0.5);
        this.ring(up(from, 1.2), 0xffffff, 5, 0.35);
        this.blob(up(from, 1), color, 0.3, 2.5, 0.35, 0.9, true);
        this.burst(up(from, 1), 50, color, 10, 0.6, 2, 0.1);
        break;
      case 'blink':
        this.blob(up(from, 1), color, 0.4, 1.2, 0.35, 0.9, true);
        this.burst(up(from, 1), 30, color, 3, 0.5, -1, 0.08);
        this.blob(up(to, 1), 0xffffff, 0.2, 1.4, 0.3, 1, true);
        this.ring(up(to, 1), color, 2.5, 0.35);
        this.burst(up(to, 1), 30, color, 4, 0.5, 2, 0.08);
        break;
      case 'jetpack':
        this.blob(from, 0xffa040, 0.3, 1.6, 0.35, 1, true);
        this.burst(from, 40, 0xffb060, 6, 0.6, -4, 0.1);
        this.dust(from, 0x8a8070, 18, 4);
        break;
      case 'dash':
      case 'charge':
        this.dust(from, 0x9a8a6a, 16, 3);
        this.burst(up(from, 1), 20, color, 5, 0.35, 2, 0.08);
        break;
      default:
        // Habilidades que duram: brilho subindo em volta do personagem.
        this.ring(up(from, 0.2), color, 2.2, 0.45);
        this.burst(up(from, 1), 36, color, 3.5, 0.9, -2, 0.09);
        this.blob(up(from, 1), color, 0.3, 1.4, 0.35, 0.7, true);
        break;
    }
  }

  /** Efeitos da segunda habilidade (data/abilities.ts → ABILITIES2). */
  ability2Fx(kind: string, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, color: number, points: { x: number; y: number; z: number }[] = []): void {
    const up = (p: { x: number; y: number; z: number }, h: number) => ({ x: p.x, y: p.y + h, z: p.z });
    switch (kind) {
      case 'tailspin':
        this.ring(up(from, -0.6), color, 2.6, 0.35);
        this.dust(up(from, -1), 0x9a8a6a, 22, 4);
        this.burst(from, 24, color, 5, 0.35, 1, 0.08);
        break;
      case 'roar':
        this.ring(up(from, -0.6), color, 5, 0.5);
        this.ring(from, 0xffffff, 3.5, 0.35);
        this.burst(from, 50, 0xd8f4ff, 7, 0.7, -1, 0.1);
        this.blob(from, color, 0.4, 2.5, 0.4, 0.6, true);
        break;
      case 'prism':
        this.blob(from, 0xffffff, 0.3, 2.5, 0.25, 1, true);
        this.burst(from, 40, color, 9, 0.4, 0, 0.1);
        this.blob(to, color, 0.5, 3, 0.35, 0.6, true);
        break;
      case 'lasso':
      case 'chain': {
        // Corda (laço) ou raio (faísca) ligando os pontos.
        const chainPts = kind === 'chain' ? [from, ...points] : [from, to];
        for (let i = 0; i < chainPts.length - 1; i++) this.towerBolt(chainPts[i], chainPts[i + 1], color);
        break;
      }
      case 'roots':
        this.ring(up(from, 0.1), color, 3, 0.6);
        this.burst(up(from, 0.2), 40, color, 3, 0.8, -4, 0.1, false);
        this.dust(up(from, 0.1), 0x6a5a3a, 20, 3);
        break;
      case 'curse':
        this.blob(from, color, 0.3, 1.4, 0.4, 0.9, true);
        this.burst(from, 30, color, 3, 0.7, -2, 0.09);
        break;
      case 'mine':
        this.ring(up(from, 0.05), color, 1.8, 0.4);
        this.burst(up(from, 0.3), 12, color, 2, 0.3, 2, 0.06);
        break;
      case 'tracker':
        this.ring(up(from, 0.2), color, 15, 0.9);
        this.ring(up(from, 1.5), 0xffffff, 6, 0.5);
        break;
      case 'orb':
      case 'feathers':
        this.burst(up(from, 0.2), 18, color, 3, 0.35, 0, 0.08);
        break;
      default:
        this.ring(up(from, -0.9), color, 2.2, 0.45);
        this.burst(from, 30, color, 3.5, 0.8, -2, 0.09);
        break;
    }
  }

  // ---------------------------------------------------------------- modo Gigantes

  /** Raio de energia do cristal da torre até o alvo. */
  towerBolt(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, color: number): void {
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);
    const len = a.distanceTo(b);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 6, 1, true), mat);
    beam.position.copy(a).add(b).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.scene.add(beam);
    this.fading.push({ mesh: beam, age: 0, life: 0.22, grow: 0 });
    this.blob(from, color, 0.4, 1.6, 0.25, 1, true);
    this.blob(to, color, 0.2, 1.2, 0.25, 1, true);
    this.blob(to, 0xffffff, 0.1, 0.6, 0.15, 1, true);
    this.burst(to, 14, color, 4, 0.35, 4, 0.1);
  }

  /** Golpe do gigante no chão: onda de choque, poeira e pedras voando. */
  giantSlam(p: { x: number; y: number; z: number }, radius: number, color: number): void {
    const mat = new THREE.MeshBasicMaterial({ map: this.ringTex, color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat);
    ring.position.set(p.x, p.y + 0.25, p.z);
    this.scene.add(ring);
    this.fading.push({ mesh: ring, age: 0, life: 0.6, grow: radius });
    this.dust({ x: p.x, y: p.y + 0.2, z: p.z }, 0x8a7a62, 60, 9);
    this.burst({ x: p.x, y: p.y + 0.5, z: p.z }, 40, 0x6a6258, 8, 1.1, 14, 0.25, false);
    this.blob({ x: p.x, y: p.y + 1, z: p.z }, 0x9a8c78, 1, radius * 0.8, 1.2, 0.45, false);
    this.flash.color.setHex(color);
    this.flash.position.set(p.x, p.y + 1, p.z);
    this.flash.intensity = 40;
    this.flashTime = 0.35;
  }

  /** Torre/gigante derrubado: nuvem de poeira alta e pedras. */
  collapse(p: { x: number; y: number; z: number }, height: number, color: number): void {
    for (let i = 0; i < 6; i++) {
      const y = p.y + (i / 5) * height;
      this.blob({ x: p.x + (i % 2 ? 1.5 : -1.5), y, z: p.z }, 0x8c8478, 1.5, 6, 2.2 + i * 0.2, 0.55, false);
    }
    this.burst({ x: p.x, y: p.y + height * 0.6, z: p.z }, 80, 0x7a7266, 10, 1.6, 12, 0.3, false);
    this.burst({ x: p.x, y: p.y + height * 0.8, z: p.z }, 50, color, 8, 1.0, 3, 0.15);
    this.blob({ x: p.x, y: p.y + height * 0.8, z: p.z }, color, 1, 7, 0.6, 1, true);
    this.dust({ x: p.x, y: p.y + 0.3, z: p.z }, 0x8a7a62, 60, 10);
  }

  /** Flecha batendo na redoma do gigante protegido. */
  shieldSpark(p: { x: number; y: number; z: number }, color: number): void {
    this.blob(p, color, 0.3, 1.6, 0.3, 0.9, true);
    this.burst(p, 16, color, 3, 0.35, 0, 0.1);
  }

  /** Confete colorido subindo e caindo (comemoração do vencedor). */
  confetti(p: { x: number; y: number; z: number }): void {
    for (const color of [0xffd76a, 0xff5a8a, 0x5ad8ff, 0x8aff7a, 0xc48cff]) this.burst(p, 14, color, 5, 1.6, 7, 0.06);
    this.blob(p, 0xffe9a0, 0.3, 1.8, 0.4, 0.8, true);
  }

  /** Fumaça quando um mob morre. */
  puff(p: { x: number; y: number; z: number }): void {
    this.blob({ x: p.x, y: p.y + 0.5, z: p.z }, 0x9a948a, 0.3, 1.4, 0.9, 0.5, false);
    this.burst(p, 16, 0xbdb6aa, 2.5, 0.7, 2, 0.12, false);
  }

  /** Brilho ao pegar um item, na cor da raridade. */
  sparkle(p: { x: number; y: number; z: number }, color: number): void {
    this.burst({ x: p.x, y: p.y + 0.6, z: p.z }, 30, color, 3, 0.9, -1.5, 0.1);
  }

  private burst(p: { x: number; y: number; z: number }, count: number, color: number, speed: number, life: number, gravity: number, size: number, additive = true): void {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos.set([p.x, p.y, p.z], i * 3);
      // Direção aleatória, mais para cima.
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const s = speed * (0.4 + Math.random() * 0.6);
      vel.set([Math.cos(a) * r * s, (Math.abs(u) * 0.8 + 0.3) * s, Math.sin(a) * r * s], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.bursts.push({ points, velocities: vel, age: 0, life, gravity });
  }

  update(dt: number): void {
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      f.age += dt;
      const t = Math.min(1, f.age / f.life);
      if (f.grow > 0) f.mesh.scale.setScalar(0.5 + f.grow * (1 - (1 - t) ** 3));
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      if (t >= 1) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        this.fading.splice(i, 1);
      }
    }
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flash.intensity = Math.max(0, this.flashTime / 0.35) * 60;
      if (this.flashTime <= 0) this.flash.color.setHex(0xffa040);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.age += dt;
      const t = Math.min(1, f.age / f.life);
      // Aparece grande (pulo) e sobe apagando.
      const pop = t < 0.15 ? t / 0.15 : 1;
      f.mesh.scale.setScalar(0.9 * pop * (1 + 0.3 * Math.sin(Math.min(1, t * 4) * Math.PI)));
      f.mesh.position.y += f.rise * dt * (1 - t);
      f.mesh.material.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      if (t >= 1) {
        this.scene.remove(f.mesh);
        f.mesh.material.dispose();
        this.floaters.splice(i, 1);
      }
    }
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const b = this.blobs[i];
      b.age += dt;
      const t = Math.min(1, b.age / b.life);
      b.mesh.scale.setScalar(2 * (b.from + (b.to - b.from) * (1 - (1 - t) * (1 - t))));
      b.mesh.material.opacity = b.opacity * (1 - t);
      if (t >= 1) {
        this.scene.remove(b.mesh);
        (b.mesh.material as THREE.Material).dispose();
        this.blobs.splice(i, 1);
      }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      const pos = b.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let k = 0; k < arr.length; k += 3) {
        b.velocities[k + 1] -= b.gravity * dt;
        arr[k] += b.velocities[k] * dt;
        arr[k + 1] += b.velocities[k + 1] * dt;
        arr[k + 2] += b.velocities[k + 2] * dt;
      }
      pos.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - b.age / b.life);
      if (b.age >= b.life) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
      }
    }
  }
}

function softTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function ringTexture(): THREE.Texture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 40, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/** Caveira desenhada no canvas (sem depender de fonte de emoji). */
function skullTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.shadowColor = 'rgba(255,190,60,0.9)';
  g.shadowBlur = 14;
  g.fillStyle = '#fff6dc';
  g.beginPath();
  g.arc(64, 54, 36, Math.PI * 0.95, Math.PI * 0.05, false); // crânio
  g.lineTo(90, 80);
  g.lineTo(84, 98);
  g.lineTo(44, 98);
  g.lineTo(38, 80);
  g.closePath();
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#2a1a10';
  for (const x of [48, 80]) {
    g.beginPath();
    g.ellipse(x, 60, 10, 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath(); // nariz
  g.moveTo(64, 72);
  g.lineTo(58, 82);
  g.lineTo(70, 82);
  g.closePath();
  g.fill();
  for (let i = 0; i < 4; i++) g.fillRect(50 + i * 8, 88, 3, 10); // dentes
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
