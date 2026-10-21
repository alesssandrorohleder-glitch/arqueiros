// Câmera em terceira pessoa por cima do ombro direito.
// O centro da tela aponta exatamente para onde a mira está (yaw/pitch),
// o que deixa a mira da etapa 2 precisa.
import * as THREE from 'three';
import { CAMERA } from '../data/camera';
import { clamp, damp, wrapAngle } from './math';
import { raycast, type CollisionWorld } from '../systems/collision';

export class CameraRig {
  yaw = 0;
  pitch = -0.12;
  private currentDistance = CAMERA.distance;
  private readonly pivot = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {
    camera.rotation.order = 'YXZ';
  }

  /** Aplica o movimento do mouse (pixels) à mira. */
  look(dx: number, dy: number, sensitivity: number, invertY: boolean): void {
    this.yaw = wrapAngle(this.yaw - dx * sensitivity);
    this.pitch = clamp(this.pitch - dy * sensitivity * (invertY ? -1 : 1), CAMERA.minPitch, CAMERA.maxPitch);
  }

  update(target: THREE.Vector3, world: CollisionWorld, sprinting: boolean, dt: number): void {
    const cp = Math.cos(this.pitch);
    this.forward.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.pivot.copy(target);
    this.pivot.y += CAMERA.pivotHeight;
    // Ombro: desloca para a direita, mas sem atravessar paredes.
    let shoulder = CAMERA.shoulderOffset;
    const sideHit = raycast(world, this.pivot.x, this.pivot.y, this.pivot.z, this.right.x, 0, this.right.z, shoulder + CAMERA.collisionPadding);
    if (sideHit) shoulder = Math.max(0, sideHit.distance - CAMERA.collisionPadding);
    this.pivot.addScaledVector(this.right, shoulder);

    // Recua a câmera; se algo estiver no caminho, aproxima.
    let wanted = CAMERA.distance;
    const hit = raycast(world, this.pivot.x, this.pivot.y, this.pivot.z, -this.forward.x, -this.forward.y, -this.forward.z, wanted + CAMERA.collisionPadding);
    if (hit) wanted = clamp(hit.distance - CAMERA.collisionPadding, CAMERA.minDistance, CAMERA.distance);
    // Aproxima na hora (para não atravessar), afasta suavemente.
    this.currentDistance = wanted < this.currentDistance ? wanted : damp(this.currentDistance, wanted, CAMERA.returnSpeed, dt);

    this.camera.position.copy(this.pivot).addScaledVector(this.forward, -this.currentDistance);
    const ground = world.terrain.sample(this.camera.position.x, this.camera.position.z) + 0.25;
    if (this.camera.position.y < ground) this.camera.position.y = ground;
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    const fov = damp(this.camera.fov, sprinting ? CAMERA.sprintFov : CAMERA.fov, CAMERA.fovSmoothing, dt);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
