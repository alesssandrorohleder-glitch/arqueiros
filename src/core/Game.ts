// Orquestra tudo: simulação (estado puro), entrada, câmera e renderização.
import * as THREE from 'three';
import { getCharacter } from '../data/characters';
import { ARENA } from '../data/maps/arena';
import { loadSettings, type Settings } from '../data/settings';
import { createCharacterState, type CharacterState } from '../entities/CharacterState';
import { CharacterView } from '../entities/CharacterView';
import type { InputCommand } from '../entities/InputCommand';
import { stepCharacter } from '../systems/movement';
import { HUD } from '../ui/HUD';
import { isTouchDevice, TouchControls } from '../ui/TouchControls';
import { buildArena, type Arena } from '../world/Arena';
import { Sky } from '../world/Sky';
import { CameraRig } from './CameraRig';
import { GameLoop } from './GameLoop';
import { Input } from './Input';
import { lerp, type Vec3 } from './math';

/** Estado completo da partida: é o que o servidor vai controlar no multiplayer. */
export interface GameState {
  tick: number;
  characters: CharacterState[];
}

export interface GameOptions {
  characterId: string;
  /** Aceita teclado sem capturar o mouse (testes automáticos). */
  noLock: boolean;
  debug: boolean;
}

export class Game {
  readonly state: GameState = { tick: 0, characters: [] };
  readonly arena: Arena;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig: CameraRig;
  private readonly input: Input;
  private readonly sky: Sky;
  private readonly hud: HUD;
  private readonly touch: TouchControls | null = null;
  private readonly loop: GameLoop;
  private readonly settings: Settings = loadSettings();
  private readonly views = new Map<string, CharacterView>();
  private readonly prevPositions = new Map<string, Vec3>();
  private readonly localId = 'local';
  private pendingJump = false;
  private started = false;
  private readonly tmpPos = new THREE.Vector3();

  constructor(container: HTMLElement, options: GameOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const touchDevice = isTouchDevice();
    // Celular: resolução menor para manter a fluidez.
    const maxRatio = touchDevice ? 1.25 : this.settings.graphics === 'high' ? 2 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.settings.graphics !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.rig = new CameraRig(this.camera);
    this.input = new Input(this.renderer.domElement);
    this.input.allowUnlocked = options.noLock;

    this.sky = new Sky(this.scene, ARENA.seed, touchDevice ? 1024 : 2048);
    this.arena = buildArena(ARENA);
    this.scene.add(this.arena.group);

    // Jogador local.
    const def = getCharacter(options.characterId);
    const sp = ARENA.playerSpawn;
    const player = createCharacterState(this.localId, def, sp.x, this.arena.height(sp.x, sp.z), sp.z, sp.yaw);
    this.addCharacter(player);
    this.rig.yaw = sp.yaw;

    const onPlay = () => {
      if (!this.touch) {
        this.input.requestLock();
        return;
      }
      this.input.allowUnlocked = true;
      this.started = true;
      this.hud.setPaused(false, false);
      this.touch.setVisible(true);
    };
    this.hud = new HUD(container, onPlay, options.debug, touchDevice);
    this.hud.setPaused(!options.noLock, true);
    if (touchDevice) {
      this.touch = new TouchControls(container, this.input, () => this.settings.touchLookMultiplier, () => {
        this.input.allowUnlocked = false;
        this.input.reset();
        this.touch?.setVisible(false);
        this.hud.setPaused(true, false);
      });
    }
    document.addEventListener('pointerlockchange', () => {
      if (this.input.locked) this.started = true;
      this.hud.setPaused(!this.input.active, !this.started);
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.loop = new GameLoop((dt) => this.step(dt), (alpha, dt) => this.render(alpha, dt));
  }

  start(): void {
    this.loop.start();
  }

  get localPlayer(): CharacterState {
    return this.state.characters.find((c) => c.id === this.localId)!;
  }

  private addCharacter(s: CharacterState): void {
    this.state.characters.push(s);
    this.prevPositions.set(s.id, { ...s.position });
    const view = new CharacterView(getCharacter(s.characterId));
    this.views.set(s.id, view);
    this.scene.add(view.root);
  }

  /** Lê o teclado e monta o comando do jogador local para este tick. */
  private buildLocalCommand(): InputCommand {
    const i = this.input;
    const active = i.active;
    const keyF = (i.isDown('KeyW', 'ArrowUp') ? 1 : 0) - (i.isDown('KeyS', 'ArrowDown') ? 1 : 0);
    const keyR = (i.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (i.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const cmd: InputCommand = {
      forward: active ? keyF || i.virtualMove.y : 0,
      right: active ? keyR || i.virtualMove.x : 0,
      sprint: active && (i.isDown('ShiftLeft', 'ShiftRight') || i.virtualSprint),
      jump: active && this.pendingJump,
      aimYaw: this.rig.yaw,
      aimPitch: this.rig.pitch,
      primary: active && i.mouseButton(0),
    };
    this.pendingJump = false;
    return cmd;
  }

  private step(dt: number): void {
    for (const c of this.state.characters) {
      const prev = this.prevPositions.get(c.id)!;
      prev.x = c.position.x;
      prev.y = c.position.y;
      prev.z = c.position.z;
    }
    stepCharacter(this.localPlayer, this.buildLocalCommand(), this.arena.collision, dt);
    this.state.tick++;
  }

  private render(alpha: number, frameDt: number): void {
    // Mouse e pulo são lidos por quadro (resposta imediata); o pulo fica
    // guardado até o próximo tick da simulação.
    const m = this.input.consumeMouse();
    if (this.input.active) this.rig.look(m.dx, m.dy, this.settings.mouseSensitivity, this.settings.invertY);
    if (this.input.wasPressed('Space')) this.pendingJump = true;
    this.input.endFrame();

    for (const c of this.state.characters) {
      const prev = this.prevPositions.get(c.id)!;
      this.tmpPos.set(lerp(prev.x, c.position.x, alpha), lerp(prev.y, c.position.y, alpha), lerp(prev.z, c.position.z, alpha));
      this.views.get(c.id)!.update(c, this.tmpPos, frameDt);
    }

    const player = this.localPlayer;
    const playerView = this.views.get(this.localId)!;
    this.rig.update(playerView.root.position, this.arena.collision, player.moveState === 'run', frameDt);
    this.sky.update(playerView.root.position, frameDt);
    this.renderer.render(this.scene, this.camera);

    this.hud.update(frameDt, () => {
      const p = player.position;
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      const r = this.renderer.info.render;
      return [
        `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`,
        `vel ${speed.toFixed(1)} m/s · ${player.moveState}`,
        `draw calls ${r.calls} · triângulos ${(r.triangles / 1000).toFixed(0)}k`,
      ].join('\n');
    });
  }
}
