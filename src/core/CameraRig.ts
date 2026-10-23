// Câmera em terceira pessoa por cima do ombro direito.
// O centro da tela aponta exatamente para onde a mira está (yaw/pitch),
// o que deixa a mira da etapa 2 precisa.
import * as THREE from 'three';
import { CAMERA } from '../data/camera';
import { clamp, damp, lerp, wrapAngle } from './math';
import { raycast, type CollisionWorld } from '../systems/collision';

/** Graus a mais no campo de visão por unidade de tranco do tiro. */
const KICK_FOV = 40;

export class CameraRig {
  yaw = 0;
  pitch = -0.12;
  private currentDistance = CAMERA.distance;
  /** "Trauma" do tremor de câmera (0 a 1), cai com o tempo. */
  private trauma = 0;
  private shakeTime = 0;
  /** Tranco da câmera ao atirar (rad, sobe e volta suave). Só visual. */
  private kickAmount = 0;
  /** Campo de visão sem o tranco do tiro (graus). */
  private baseFov: number = CAMERA.fov;
  private readonly pivot = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {
    camera.rotation.order = 'YXZ';
  }

  /** Treme a câmera (explosões, dano). Não altera a mira de verdade. */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /**
   * Tranco curto ao disparar (0 a 1 = carga do tiro): uma pulsada de zoom. Não gira
   * a câmera nem treme: antes ela inclinava para cima a cada tiro e, atirando sem
   * parar, a mira na tela ficava acima de onde a flecha ia (era preciso mirar acima
   * do alvo para acertar).
   */
  kick(strength: number): void {
    this.kickAmount = Math.min(0.05, this.kickAmount + 0.012 + strength * 0.02);
  }

  /** Aplica o movimento do mouse (pixels) à mira. */
  look(dx: number, dy: number, sensitivity: number, invertY: boolean): void {
    this.yaw = wrapAngle(this.yaw - dx * sensitivity);
    this.pitch = clamp(this.pitch - dy * sensitivity * (invertY ? -1 : 1), CAMERA.minPitch, CAMERA.maxPitch);
  }

  /**
   * @param zoom 0 a 1: quanto aproximar para mirar (arco puxado).
   * @param swayYaw/swayPitch tremor da mira por cansaço (rad), só visual aqui.
   */
  update(target: THREE.Vector3, world: CollisionWorld, sprinting: boolean, zoom: number, swayYaw: number, swayPitch: number, dt: number): void {
    const yaw = this.yaw + swayYaw;
    const pitch = this.pitch + swayPitch;
    const cp = Math.cos(pitch);
    this.forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    // O ombro usa a mira sem tremor, igual à simulação (systems/aim.ts).
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.pivot.copy(target);
    this.pivot.y += CAMERA.pivotHeight;
    // Ombro: desloca para a direita, mas sem atravessar paredes.
    let shoulder = CAMERA.shoulderOffset;
    const sideHit = raycast(world, this.pivot.x, this.pivot.y, this.pivot.z, this.right.x, 0, this.right.z, shoulder + CAMERA.collisionPadding);
    if (sideHit) shoulder = Math.max(0, sideHit.distance - CAMERA.collisionPadding);
    this.pivot.addScaledVector(this.right, shoulder);

    // Recua a câmera; se algo estiver no caminho, aproxima.
    const fullDistance = lerp(CAMERA.distance, CAMERA.drawDistance, zoom);
    let wanted = fullDistance;
    const hit = raycast(world, this.pivot.x, this.pivot.y, this.pivot.z, -this.forward.x, -this.forward.y, -this.forward.z, wanted + CAMERA.collisionPadding);
    if (hit) wanted = clamp(hit.distance - CAMERA.collisionPadding, CAMERA.minDistance, fullDistance);
    // Encostou em algo: aproxima na hora (para não atravessar). Fora isso, suave.
    this.currentDistance = hit && wanted < this.currentDistance ? wanted : damp(this.currentDistance, wanted, CAMERA.returnSpeed, dt);

    this.camera.position.copy(this.pivot).addScaledVector(this.forward, -this.currentDistance);
    const ground = world.terrain.sample(this.camera.position.x, this.camera.position.z) + 0.25;
    if (this.camera.position.y < ground) this.camera.position.y = ground;
    // Tremor: só no visual da câmera (a mira da simulação não muda).
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.shakeTime += dt;
    const k = this.trauma * this.trauma * 0.05;
    const st = this.shakeTime * 32;
    this.kickAmount = damp(this.kickAmount, 0, 10, dt);
    this.camera.rotation.set(pitch + Math.sin(st * 1.3) * k, yaw + Math.sin(st * 0.9 + 1.7) * k, Math.sin(st * 1.1 + 3.1) * k * 0.6);

    const baseFov = sprinting ? CAMERA.sprintFov : CAMERA.fov;
    // Tranco do tiro: abre o campo de visão um pouco e volta (o centro da tela não sai do lugar).
    this.baseFov = damp(this.baseFov, lerp(baseFov, CAMERA.drawFov, zoom), CAMERA.fovSmoothing, dt);
    const fov = this.baseFov + this.kickAmount * KICK_FOV;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
