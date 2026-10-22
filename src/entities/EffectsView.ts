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
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flash.intensity = Math.max(0, this.flashTime / 0.35) * 60;
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
