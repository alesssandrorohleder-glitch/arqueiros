// Física de movimento dos personagens: aceleração, pulo, gravidade e colisão.
// Função pura sobre o estado: roda igual no cliente e (futuramente) no servidor.
import { approachAngle, clamp } from '../core/math';
import { getCharacter } from '../data/characters';
import { COMBAT } from '../data/combat';
import { MOVEMENT } from '../data/movement';
import type { CharacterState } from '../entities/CharacterState';
import type { InputCommand } from '../entities/InputCommand';
import { ceilingHeightAt, groundHeightAt, resolveCharacterHorizontal, type CollisionWorld } from './collision';

export function stepCharacter(s: CharacterState, cmd: InputCommand, world: CollisionWorld, dt: number): void {
  const def = getCharacter(s.characterId);
  const M = MOVEMENT;

  s.aimYaw = cmd.aimYaw;
  s.aimPitch = cmd.aimPitch;

  // --- Direção desejada (relativa à mira/câmera) ---
  let f = clamp(cmd.forward, -1, 1);
  let r = clamp(cmd.right, -1, 1);
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }
  const inputAmount = Math.min(len, 1);

  const drawing = s.bow.drawing;
  // Com o arco puxado não dá para correr e anda-se mais devagar.
  const sprinting = cmd.sprint && f > M.sprintMinForward && !drawing;
  let speed = (sprinting ? M.sprintSpeed : M.walkSpeed) * def.speedMultiplier;
  if (drawing) speed *= COMBAT.drawMoveMultiplier;
  if (f < -0.1) speed *= M.backwardMultiplier;
  else if (Math.abs(f) <= 0.1 && Math.abs(r) > 0.1) speed *= M.strafeMultiplier;

  const sinY = Math.sin(cmd.aimYaw);
  const cosY = Math.cos(cmd.aimYaw);
  // frente = (-sen, -cos); direita = (cos, -sen)
  const targetVx = (-sinY * f + cosY * r) * speed;
  const targetVz = (-cosY * f - sinY * r) * speed;

  // --- Aceleração em direção à velocidade desejada ---
  const accel = s.grounded ? (inputAmount > 0.01 ? M.groundAcceleration : M.groundDeceleration) : M.airAcceleration;
  const dvx = targetVx - s.velocity.x;
  const dvz = targetVz - s.velocity.z;
  const dvLen = Math.hypot(dvx, dvz);
  const maxDv = accel * dt;
  if (dvLen <= maxDv) {
    s.velocity.x = targetVx;
    s.velocity.z = targetVz;
  } else if (s.grounded || inputAmount > 0.01) {
    s.velocity.x += (dvx / dvLen) * maxDv;
    s.velocity.z += (dvz / dvLen) * maxDv;
  }

  // --- Pulo (com jump buffer e coyote time) ---
  if (cmd.jump) s.jumpBuffer = M.jumpBufferTime;
  else s.jumpBuffer = Math.max(0, s.jumpBuffer - dt);
  if (s.jumpBuffer > 0 && (s.grounded || s.airTime < M.coyoteTime)) {
    s.velocity.y = M.jumpVelocity * def.jumpMultiplier;
    s.grounded = false;
    s.airTime = M.coyoteTime; // impede pulo duplo pelo coyote time
    s.jumpBuffer = 0;
  }

  // --- Gravidade ---
  if (!s.grounded) s.velocity.y = Math.max(s.velocity.y - M.gravity * dt, -M.maxFallSpeed);

  // --- Movimento horizontal + colisão ---
  const p = s.position;
  p.x += s.velocity.x * dt;
  p.z += s.velocity.z * dt;
  const push = resolveCharacterHorizontal(world, p, def.radius, def.height, M.stepHeight);
  const pushLen = Math.hypot(push.x, push.z);
  if (pushLen > 1e-6) {
    // Remove a parte da velocidade que vai contra a parede (desliza nela).
    const nx = push.x / pushLen;
    const nz = push.z / pushLen;
    const vn = s.velocity.x * nx + s.velocity.z * nz;
    if (vn < 0) {
      s.velocity.x -= nx * vn;
      s.velocity.z -= nz * vn;
    }
  }

  // --- Movimento vertical ---
  const wasGrounded = s.grounded;
  const prevHead = p.y + def.height;
  p.y += s.velocity.y * dt;

  if (s.velocity.y > 0) {
    const ceiling = ceilingHeightAt(world, p.x, p.z, def.radius, prevHead);
    if (p.y + def.height > ceiling) {
      p.y = ceiling - def.height;
      s.velocity.y = 0;
    }
  }

  const ground = groundHeightAt(world, p.x, p.z, def.radius, Math.max(p.y, p.y - s.velocity.y * dt), M.stepHeight);
  const snap = wasGrounded && s.velocity.y <= 0 ? M.groundSnapDistance : 0;
  if (p.y <= ground + snap) {
    p.y = ground;
    s.velocity.y = 0;
    s.grounded = true;
    s.airTime = 0;
  } else {
    s.grounded = false;
    s.airTime += dt;
  }

  // --- Corpo vira para a direção da mira quando se move ---
  const hSpeed = Math.hypot(s.velocity.x, s.velocity.z);
  if (drawing) {
    s.bodyYaw = cmd.aimYaw; // mirando: o corpo acompanha a mira na hora
  } else if (hSpeed > 0.5 || inputAmount > 0.01) {
    s.bodyYaw = approachAngle(s.bodyYaw, cmd.aimYaw, M.turnSpeed * dt);
  }

  s.moveState = !s.grounded ? 'air' : hSpeed < 0.3 ? 'idle' : sprinting ? 'run' : 'walk';
}
