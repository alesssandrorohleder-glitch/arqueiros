// Visual de um personagem. Começa com o modelo geométrico (animação procedural)
// e troca para o modelo 3D animado (ModelRig) assim que o .glb carrega; se o
// arquivo não carregar, continua com o geométrico. Só lê o CharacterState.
import * as THREE from 'three';
import { trimShadows } from './shadows';
import { clamp, damp, lerp } from '../core/math';
import type { CharacterDef } from '../data/characters';
import { getBow } from '../data/bows';
import { FRENZY, HASTE, GUARD } from '../data/combat';
import { getAbility, type AbilityDef } from '../data/abilities';
import { RARITIES, RARITY_ORDER } from '../data/rarities';
import { drawCharge } from '../systems/bow';
import { buildBowModel, GRIP_Z, type BowModel } from './bowModels';
import { elfExtras, hunterExtras, mageExtras } from './creatureHeads';
import { buildStyle, type PartsContext, type StyleParts } from './characterParts';
import { ModelRig } from './ModelRig';
import type { CharacterState } from './CharacterState';

/** Altura de referência do modelo; é escalado para `def.height`. */
const MODEL_HEIGHT = 1.8;
const ARROW_LENGTH = 0.95;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

export class CharacterView {
  /** Comemorando (vencedor do Último de pé): toca a animação de comemoração. */
  cheer = false;
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private phase = 0;
  private stride = 0;
  private airBlend = 0;
  private visualY = 0;
  private lean = 0;
  private time = 0;
  private bow: THREE.Group;
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private bowModel: BowModel | null = null;
  private readonly arrowHeadMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.6 });
  private readonly nockGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  private shownBowId = '';
  private frost = 0;
  /** Aura da Fúria (brilho laranja em volta do personagem). */
  private readonly aura: THREE.Sprite;
  private readonly ability: AbilityDef;
  private readonly shieldBubble: THREE.Mesh;
  private frenzyShown = false;
  /** Desligada no jogador local (a aura ficaria entre a câmera e o personagem). */
  showAura = true;
  private style: StyleParts;
  private rig: ModelRig | null = null;
  private readonly parts: Omit<PartsContext, 'head' | 'torso' | 'hips'>;
  private readonly bowScale: number;
  private readonly tmpNock = new THREE.Vector3();
  private recoil = 0;
  private flinch = 0;
  private landDip = 0;
  private wasGrounded = true;
  private lastStepSign = 1;
  /** Eventos de animação lidos pelo jogo para tocar sons (passos, pulo, queda). */
  readonly cues = { steps: 0, jumped: false, landed: 0 };
  private wingOpen = 0;
  private readonly stringTop = new THREE.Mesh();
  private readonly stringBottom = new THREE.Mesh();
  private readonly nockedArrow = new THREE.Group();
  private drawBlend = 0;
  private death = 0;
  private pull = 0;
  private readonly restQuat = new THREE.Quaternion();
  private readonly aimQuat = new THREE.Quaternion();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpEuler = new THREE.Euler();

  constructor(def: CharacterDef) {
    const pal = def.palette;
    const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
      this.materials.push(m);
      return m;
    };
    const place = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    /** Cápsula vertical com altura total `h`. */
    const capsule = (r: number, h: number) => new THREE.CapsuleGeometry(r, Math.max(0.01, h - 2 * r), 6, 12);

    const metal = def.style === 'robot' ? { metalness: 0.75, roughness: 0.35 } : {};
    const primary = mat(pal.primary, metal);
    const secondary = mat(pal.secondary, { roughness: 0.9, ...metal });
    const skin = mat(pal.skin, { roughness: 0.65, ...metal });
    const accent = mat(pal.accent, { roughness: 0.6 });
    const leather = mat(0x4a3324, { roughness: 0.7 });
    const eyes = mat(pal.eyes, { emissive: def.style === 'robot' ? pal.eyes : 0x000000, emissiveIntensity: 1.5, roughness: 0.3 });

    this.root.add(this.body);
    this.body.scale.setScalar(def.height / MODEL_HEIGHT);

    // Quadril (pivô das pernas e do tronco).
    this.hips.position.y = 0.92;
    this.body.add(this.hips);

    for (const [leg, x] of [[this.legL, -0.11], [this.legR, 0.11]] as const) {
      leg.position.set(x, 0, 0);
      place(capsule(0.095, 0.62), secondary, 0, -0.3, 0, leg); // coxa + canela
      const boot = place(capsule(0.1, 0.34), leather, 0, -0.74, -0.02, leg);
      boot.scale.set(1, 1, 1.25);
      place(new THREE.SphereGeometry(0.1, 10, 8).scale(1, 0.55, 1.6), leather, 0, -0.88, -0.07, leg); // pé
      this.hips.add(leg);
    }

    this.torso.position.y = 0.02;
    this.hips.add(this.torso);
    const chest = place(capsule(0.2, 0.62), primary, 0, 0.3, 0, this.torso);
    chest.scale.set(1.2, 1, 0.75);
    const belt = place(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 16), leather, 0, 0.06, 0, this.torso);
    belt.scale.set(1, 1, 0.75);
    place(new THREE.BoxGeometry(0.07, 0.06, 0.03), accent, 0, 0.06, -0.19, this.torso); // fivela
    // Alça da aljava atravessando o peito.
    const strap = place(new THREE.BoxGeometry(0.05, 0.7, 0.33), leather, 0, 0.32, 0, this.torso);
    strap.rotation.z = 0.7;
    // Aljava nas costas, com penas das flechas.
    const quiver = new THREE.Group();
    quiver.position.set(0.1, 0.36, 0.2);
    quiver.rotation.z = -0.35;
    place(new THREE.CylinderGeometry(0.075, 0.065, 0.55, 12), leather, 0, 0, 0, quiver);
    for (let i = 0; i < 4; i++) {
      place(new THREE.BoxGeometry(0.004, 0.1, 0.05), mat(0xe9e2d0), -0.04 + i * 0.027, 0.33, (i % 2) * 0.02, quiver);
    }
    this.torso.add(quiver);

    // Cabeça e extras do personagem (capuz, orelhas, cauda, asas...).
    this.head.position.y = 0.6;
    this.torso.add(this.head);
    this.parts = { palette: pal, mats: { primary, secondary, skin, accent, eyes, leather }, mat, place };
    this.style = buildStyle(def.style, { ...this.parts, head: this.head, torso: this.torso, hips: this.hips });

    // Braços (pivô no ombro).
    for (const [arm, x] of [[this.armL, -0.3], [this.armR, 0.3]] as const) {
      arm.position.set(x, 0.52, 0);
      place(new THREE.SphereGeometry(0.085, 12, 10), primary, 0, 0, 0, arm); // ombro
      place(capsule(0.07, 0.34), primary, 0, -0.16, 0, arm);
      place(capsule(0.06, 0.28), leather, 0, -0.42, 0, arm); // braçadeira
      place(new THREE.SphereGeometry(0.055, 10, 8), skin, 0, -0.56, 0, arm); // mão
      this.torso.add(arm);
    }

    // Arco na mão esquerda (ver buildBow).
    this.bow = this.buildBow(mat);
    this.bow.position.set(0, -0.56, 0);
    this.armL.add(this.bow);

    trimShadows(this.root);

    this.ability = getAbility(def.id);
    this.shieldBubble = new THREE.Mesh(
      new THREE.IcosahedronGeometry(def.height * 0.62, 2),
      new THREE.MeshBasicMaterial({ color: this.ability.color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: false }),
    );
    this.shieldBubble.position.y = def.height * 0.5;
    this.shieldBubble.visible = false;
    this.root.add(this.shieldBubble);
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTexture(), color: FRENZY.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.aura.position.y = def.height * 0.55;
    this.aura.scale.setScalar(def.height * 1.3);
    this.aura.visible = false;
    this.root.add(this.aura);

    // Arco no modelo animado: proporcional ao corpo (um pouco menor).
    this.bowScale = (def.height / MODEL_HEIGHT) * 0.85;
    if (def.model) {
      ModelRig.load(def)
        .then((rig) => rig && this.useRig(rig, def))
        .catch((err) => console.warn('Modelo 3D não carregou; usando o geométrico.', err));
    }
  }

  /** Troca o modelo geométrico pelo modelo animado. */
  private useRig(rig: ModelRig, def: CharacterDef): void {
    this.rig = rig;
    this.root.remove(this.body);
    this.root.add(rig.root);
    // O arco sai da mão geométrica e passa a seguir a mão do modelo.
    this.root.add(this.bow);
    this.bow.scale.setScalar(this.bowScale);
    this.materials.push(...rig.materials);
    const ctx = { ...this.parts, ...rig.sockets };
    if (def.model?.customHead) {
      this.style = buildStyle(def.style, ctx);
      rig.capeOverTorsoParts = true;
      // Corpo do modelo tem pernas curtas: cauda menor e mais erguida.
      if (this.style.tail) {
        this.style.tail.scale.setScalar(0.6);
        this.style.tail.rotation.x *= 0.5;
      }
    }
    else if (def.model?.styleExtras) this.style = modelExtras(def, ctx);
    else this.style = { wings: [], tail: null };
    trimShadows(rig.root);
  }

  /**
   * Arco no "espaço do arco" (ver entities/bowModels.ts): corda e flecha
   * encaixada ficam aqui; o desenho do arco muda conforme o arco equipado.
   */
  private buildBow(mat: (color: number, extra?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial): THREE.Group {
    const group = new THREE.Group();
    const stringMat = mat(0xf2efe6);
    const stringGeo = new THREE.CylinderGeometry(0.005, 0.005, 1, 3);
    this.stringTop.geometry = stringGeo;
    this.stringTop.material = stringMat;
    this.stringBottom.geometry = stringGeo;
    this.stringBottom.material = stringMat;
    group.add(this.stringTop, this.stringBottom);

    // Flecha encaixada na corda (aparece enquanto puxa); a ponta brilha na cor da raridade.
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, ARROW_LENGTH, 6), mat(0xc9a36b));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -ARROW_LENGTH / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 6), this.arrowHeadMat);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -ARROW_LENGTH - 0.03;
    const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.1, 0.18), mat(0xe9e2d0));
    fletch.position.z = -0.08;
    this.nockGlow.position.z = -ARROW_LENGTH - 0.03;
    this.nockedArrow.add(shaft, head, fletch, this.nockGlow);
    this.nockedArrow.visible = false;
    group.add(this.nockedArrow);
    return group;
  }

  /** Troca o desenho do arco (quando o arco equipado muda). */
  private setBowModel(bowId: string): void {
    if (this.bowModel) {
      this.bow.remove(this.bowModel.group);
      this.bowModel.dispose();
    }
    this.bowModel = buildBowModel(bowId);
    this.bow.add(this.bowModel.group);
    const rarity = getBow(bowId).rarity;
    const color = RARITIES[rarity].color;
    const rank = RARITY_ORDER.indexOf(rarity);
    this.arrowHeadMat.color.setHex(rank >= 2 ? color : 0x9aa0a6);
    this.arrowHeadMat.emissive.setHex(color);
    this.arrowHeadMat.emissiveIntensity = [0, 0.2, 0.8, 1.4, 2][rank];
    this.nockGlow.material.color.setHex(color);
    this.nockGlow.visible = rank >= 1;
    this.nockGlow.scale.setScalar(0.18 + rank * 0.08);
  }

  /** Posição da corda: repouso nas pontas do arco, mais para trás conforme puxa. */
  private nockZ(): number {
    return (this.bowModel?.restNockZ ?? 0.06) + this.pull * 0.5;
  }

  /** Estica a corda das pontas do arco até o ponto de encaixe. */
  private updateString(nockZ: number): void {
    const m = this.bowModel;
    if (!m) return;
    const place = (mesh: THREE.Mesh, tip: THREE.Vector3) => {
      const b = this.tmpNock.set(0, 0, nockZ);
      const d = b.sub(tip);
      mesh.position.copy(tip).addScaledVector(d, 0.5);
      mesh.scale.set(1, d.length(), 1);
      mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    };
    place(this.stringTop, m.tipTop);
    place(this.stringBottom, m.tipBottom);
    this.nockedArrow.position.z = nockZ;
  }

  /** Animação com o modelo 3D: o ModelRig cuida do corpo; aqui ficam arco, sons e extras. */
  private updateRig(s: CharacterState, fwd: number, dt: number, dead: boolean): void {
    const rig = this.rig!;
    const right = Math.cos(s.bodyYaw) * s.velocity.x - Math.sin(s.bodyYaw) * s.velocity.z;
    const pitch = clamp(s.aimPitch, -1, 1);
    // Arco: de pé ao lado do corpo quando relaxado; inclinado com a mira quando atirando.
    this.bow.rotation.set(pitch * this.drawBlend, 0, 0.25 * (1 - this.drawBlend));
    const placeBow = () => {
      rig.bowHand(this.root, this.bow.position);
      // Segura pelo cabo (z = -0,12 no espaço do arco).
      this.bow.position.add(this.tmpDir.set(0, 0, 0.12 * this.bowScale).applyEuler(this.bow.rotation));
      this.bow.updateMatrixWorld();
    };
    rig.update(
      {
        drawBlend: this.drawBlend,
        pull: this.pull,
        aimPitch: pitch,
        forward: fwd,
        right,
        running: s.moveState === 'run',
        grounded: s.grounded,
        dead,
        recoil: this.recoil,
        flinch: this.flinch,
        cheer: this.cheer,
      },
      dt,
      () => {
        placeBow();
        return this.bow.localToWorld(this.tmpNock.set(0, 0, this.nockZ()));
      },
    );
    if (!dead) placeBow();
    this.updateString(this.nockZ());
    this.nockedArrow.visible = s.bow.drawing;

    const hSpeed = Math.hypot(s.velocity.x, s.velocity.z);
    const stepSign = Math.sign(Math.sin(this.phase)) || 1;
    if (stepSign !== this.lastStepSign && s.grounded && hSpeed > 1) this.cues.steps++;
    this.lastStepSign = stepSign;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this.landDip = Math.max(0, this.landDip - dt * 5);
    if (this.style.tail) this.style.tail.rotation.y = Math.sin(this.phase * 0.5 + this.time) * (0.15 + 0.25 * this.stride);
    this.wingOpen = damp(this.wingOpen, s.grounded ? 0 : 1, 8, dt);
    this.style.wings.forEach((w, i) => {
      const side = i === 0 ? -1 : 1;
      w.rotation.z = side * this.wingOpen * (1.1 + Math.sin(this.time * 14) * 0.25);
    });
  }

  /** Aponta um braço (pivô no ombro, pendurado em -Y) na direção `dir` do tronco. */
  private pointArm(arm: THREE.Group, rest: THREE.Euler, dir: THREE.Vector3, blend: number): void {
    this.restQuat.setFromEuler(rest);
    this.aimQuat.setFromUnitVectors(DOWN, dir.normalize());
    arm.quaternion.copy(this.restQuat).slerp(this.aimQuat, blend);
  }

  /** Ponto na frente da empunhadura (de onde sai o clarão do disparo), no mundo. */
  muzzlePoint(out: THREE.Vector3): THREE.Vector3 {
    this.bow.updateWorldMatrix(true, false);
    return this.bow.localToWorld(out.set(0, 0, GRIP_Z - 0.15));
  }

  /** Soltou a flecha: o braço do arco dá um tranco. */
  onShot(): void {
    this.recoil = 1;
    this.bowModel?.onShot();
  }

  /** Levou dano: o tronco recua. */
  onHit(): void {
    this.flinch = 1;
  }

  /** Atualiza posição e animação. `pos` já vem interpolada entre ticks. */
  update(s: CharacterState, pos: THREE.Vector3, dt: number): void {
    const charge = drawCharge(s);
    this.drawBlend = damp(this.drawBlend, s.bow.drawing ? 1 : 0, s.bow.drawing ? 14 : 8, dt);
    // A corda volta rápido ao soltar.
    this.pull = s.bow.drawing ? damp(this.pull, charge, 20, dt) : damp(this.pull, 0, 30, dt);
    this.time += dt;
    for (const o of this.style.spin ?? []) o.rotation.y += dt * 1.6;
    // Luzes que pulsam (robô, joia da elfa).
    for (const m of this.style.pulse ?? []) {
      m.userData.basePulse ??= m.emissiveIntensity;
      m.emissiveIntensity = m.userData.basePulse * (0.65 + 0.35 * Math.sin(this.time * 3 + (m.userData.pulsePhase ??= Math.random() * 6)));
    }
    // Suaviza degraus para cima (a física sobe na hora; o visual acompanha).
    if (pos.y > this.visualY && pos.y - this.visualY < 0.6) this.visualY = damp(this.visualY, pos.y, 25, dt);
    else this.visualY = pos.y;
    this.root.position.set(pos.x, this.visualY, pos.z);
    this.root.rotation.y = s.bodyYaw;
    // Eliminado: tomba para trás. Protegido após voltar: pisca.
    const dead = s.health <= 0;
    this.death = dead ? damp(this.death, 1, 5, dt) : 0;
    this.body.rotation.x = this.death * 1.45;
    this.body.position.y = -this.death * 0.15;
    const visible = s.protection <= 0 || Math.floor(this.time * 12) % 2 === 0;
    this.body.visible = visible;
    if (this.rig) {
      this.rig.root.visible = visible;
      this.bow.visible = visible && !dead;
    }

    // Arco brilha na cor da raridade (mais forte quanto mais raro).
    if (s.bow.bowId !== this.shownBowId) {
      this.shownBowId = s.bow.bowId;
      this.setBowModel(s.bow.bowId);
    }
    this.bowModel?.update(dt);
    // Poderes: brilho forte pulsando + aura (laranja = Fúria, azul = Velocidade). Congelado: tom azulado.
    // Habilidade ativa (Sede de Sangue, Olhar de Coruja, Regeneração, Armadura de Ossos...) também brilha.
    const abilityGlow = s.abilityActive > 0 && this.ability.duration > 1 ? s.abilityActive : 0;
    const buffTime = dead ? 0 : s.frenzy > 0 ? s.frenzy : s.haste > 0 ? s.haste : s.guard > 0 ? s.guard : abilityGlow;
    const buffColor = s.frenzy > 0 ? FRENZY.color : s.haste > 0 ? HASTE.color : s.guard > 0 ? GUARD.color : this.ability.color;
    // Escudo Arcano: bolha translúcida em volta do corpo.
    this.shieldBubble.visible = s.shield > 0 && !dead;
    if (this.shieldBubble.visible) {
      const mat = this.shieldBubble.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + 0.08 * Math.sin(this.time * 5) + 0.25 * (s.shield / 45);
      this.shieldBubble.rotation.y += dt * 0.8;
    }
    const buffed = buffTime > 0;
    const frost = s.slowTimer > 0 ? 1 : 0;
    if (buffed || frost !== this.frost || buffed !== this.frenzyShown) {
      this.frost = frost;
      this.frenzyShown = buffed;
      // Pisca mais rápido nos últimos 3 s, avisando que vai acabar.
      const pulse = 0.75 + 0.25 * Math.sin(this.time * (buffTime < 3 ? 18 : 6));
      for (const m of this.materials) {
        if (m.userData.baseEmissive === undefined) {
          m.userData.baseEmissive = m.emissive.getHex();
          m.userData.baseEmissiveIntensity = m.emissiveIntensity;
        }
        if (buffed) {
          m.emissive.setHex(buffColor);
          m.emissiveIntensity = 0.55 * pulse;
        } else {
          m.emissive.setHex(frost ? 0x2a6a9a : m.userData.baseEmissive);
          m.emissiveIntensity = m.userData.baseEmissiveIntensity;
        }
      }
      this.aura.visible = buffed && this.showAura;
      this.aura.material.color.setHex(buffColor);
      this.aura.material.opacity = 0.45 * pulse;
    }

    const hSpeed = Math.hypot(s.velocity.x, s.velocity.z);
    // Pulo e queda (para som e agachadinha ao aterrissar).
    if (this.wasGrounded && !s.grounded && s.velocity.y > 1) this.cues.jumped = true;
    if (!this.wasGrounded && s.grounded) {
      this.cues.landed = 1;
      this.landDip = 1;
    }
    this.wasGrounded = s.grounded;
    // Velocidade relativa ao corpo: decide se as pernas andam para frente ou para trás.
    const fwd = -Math.sin(s.bodyYaw) * s.velocity.x - Math.cos(s.bodyYaw) * s.velocity.z;
    const dir = fwd < -0.3 ? -1 : 1;
    this.phase += dt * hSpeed * 1.7 * dir;
    this.stride = damp(this.stride, clamp(hSpeed / 8, 0, 1), 10, dt);
    this.airBlend = damp(this.airBlend, s.grounded ? 0 : 1, 12, dt);
    this.lean = damp(this.lean, s.moveState === 'run' ? 1 : 0, 6, dt);
    if (this.rig) {
      this.updateRig(s, fwd, dt, dead);
      return;
    }

    const swing = Math.sin(this.phase) * lerp(0.25, 0.85, this.stride) * Math.min(1, hSpeed / 1.5);
    const groundLegL = swing;
    const groundLegR = -swing;
    this.legL.rotation.x = lerp(groundLegL, 0.7, this.airBlend);
    this.legR.rotation.x = lerp(groundLegR, -0.25, this.airBlend);
    // Braços: pose de caminhada misturada com a pose de mira.
    const pitch = clamp(s.aimPitch, -1, 1);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const rotPitch = (v: THREE.Vector3) => v.set(v.x, v.y * cp - v.z * sp, v.y * sp + v.z * cp);
    // Esquerdo: estica para frente, na direção da mira.
    this.tmpEuler.set(lerp(swing * 0.5 + 0.15, 0.3, this.airBlend), 0, 0.08);
    this.pointArm(this.armL, this.tmpEuler, rotPitch(this.tmpDir.set(0.08, 0, -1)), this.drawBlend);
    // Direito: vai da corda (perto do arco) até a ancoragem no queixo.
    this.tmpEuler.set(lerp(-swing * 0.8, -0.6, this.airBlend), 0, -0.08);
    this.tmpDir.set(lerp(-0.75, -0.85, this.pull), lerp(0, 0.35, this.pull), lerp(-0.75, -0.2, this.pull));
    this.pointArm(this.armR, this.tmpEuler, rotPitch(this.tmpDir), this.drawBlend);
    // Arco de pé quando relaxado; deitado no eixo do braço quando mirando.
    this.bow.rotation.x = -Math.PI / 2 * this.drawBlend;
    this.updateString(this.nockZ());
    this.nockedArrow.visible = s.bow.drawing;

    // Passo: cada vez que a perna troca de lado.
    const stepSign = Math.sign(Math.sin(this.phase)) || 1;
    if (stepSign !== this.lastStepSign && s.grounded && hSpeed > 1) this.cues.steps++;
    this.lastStepSign = stepSign;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this.landDip = Math.max(0, this.landDip - dt * 5);
    const bob = Math.abs(Math.cos(this.phase)) * 0.06 * this.stride * (1 - this.airBlend) - this.landDip * 0.08;
    const breath = Math.sin(this.time * 2.2) * 0.008;
    this.hips.position.y = 0.92 + bob;
    this.torso.rotation.x = (-0.25 * this.lean - 0.05 * this.stride) * (1 - this.drawBlend) + this.flinch * 0.35;
    this.armL.rotation.x += this.recoil * 0.25;
    this.torso.position.y = 0.02 + breath;
    // Cauda balança ao andar; asas abrem no ar.
    if (this.style.tail) this.style.tail.rotation.y = Math.sin(this.phase * 0.5 + this.time) * (0.15 + 0.25 * this.stride);
    this.wingOpen = damp(this.wingOpen, s.grounded ? 0 : 1, 8, dt);
    this.style.wings.forEach((w, i) => {
      const side = i === 0 ? -1 : 1;
      w.rotation.z = side * this.wingOpen * (1.1 + Math.sin(this.time * 14) * 0.25);
    });
    // A cabeça segue a mira vertical.
    this.head.rotation.x = clamp(s.aimPitch * 0.5, -0.4, 0.35) + 0.25 * this.lean;
  }
}

/** Detalhes geométricos por cima do modelo 3D (sem trocar a cabeça). */
function modelExtras(def: CharacterDef, c: PartsContext): StyleParts {
  if (def.style === 'elf') return { wings: [], tail: null, pulse: elfExtras(c) };
  if (def.style === 'human') return { wings: [], tail: null, pulse: hunterExtras(c) };
  if (def.style === 'mage') return { wings: [], tail: null, ...mageExtras(c) };
  return { wings: [], tail: null };
}

let auraTex: THREE.Texture | null = null;
/** Mancha radial suave (compartilhada por todas as auras). */
export function auraTexture(): THREE.Texture {
  if (auraTex) return auraTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  auraTex = new THREE.CanvasTexture(c);
  return auraTex;
}
