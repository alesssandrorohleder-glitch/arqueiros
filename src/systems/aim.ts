// Geometria da mira: de onde parte o raio da mira (o mesmo da câmera) e de
// onde a flecha sai (o arco). Assim a flecha vai para o que está sob a mira.
import { vec3, type Vec3 } from '../core/math';
import { CAMERA } from '../data/camera';
import { getCharacter } from '../data/characters';
import type { CharacterState } from '../entities/CharacterState';

export function aimDirection(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return vec3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

/** Ponto de giro da câmera: o centro da tela fica sobre a reta que sai daqui. */
export function aimOrigin(c: CharacterState): Vec3 {
  const right = { x: Math.cos(c.aimYaw), z: -Math.sin(c.aimYaw) };
  return vec3(
    c.position.x + right.x * CAMERA.shoulderOffset,
    c.position.y + CAMERA.pivotHeight,
    c.position.z + right.z * CAMERA.shoulderOffset,
  );
}

/** Onde a flecha nasce: na mão do arco, um pouco à frente do corpo. */
export function arrowSpawnPoint(c: CharacterState): Vec3 {
  const def = getCharacter(c.characterId);
  const k = def.height / 1.8;
  const fx = -Math.sin(c.aimYaw);
  const fz = -Math.cos(c.aimYaw);
  const rx = Math.cos(c.aimYaw);
  const rz = -Math.sin(c.aimYaw);
  return vec3(
    c.position.x + fx * 0.55 * k - rx * 0.2 * k,
    c.position.y + 1.42 * k + Math.sin(c.aimPitch) * 0.4,
    c.position.z + fz * 0.55 * k - rz * 0.2 * k,
  );
}
