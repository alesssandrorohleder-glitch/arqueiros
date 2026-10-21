// Orquestra tudo: simulação (estado puro), entrada, câmera e renderização.
import * as THREE from 'three';
import { getBow, DEFAULT_BOW_ID } from '../data/bows';
import { CAMERA } from '../data/camera';
import { getCharacter } from '../data/characters';
import { ARENA } from '../data/maps/arena';
import { loadSettings, type Settings } from '../data/settings';
import { ArrowRenderer } from '../entities/ArrowView';
import { CharacterView } from '../entities/CharacterView';
import type { InputCommand } from '../entities/InputCommand';
import { TargetView } from '../entities/TargetView';
import { drawCharge } from '../systems/bow';
import { HUD } from '../ui/HUD';
import { isTouchDevice, TouchControls } from '../ui/TouchControls';
import { buildArena, type Arena } from '../world/Arena';
import { Sky } from '../world/Sky';
import { CameraRig } from './CameraRig';
import type { GameEvent } from './events';
import { GameLoop } from './GameLoop';
import { Input } from './Input';
import { damp, lerp, type Vec3 } from './math';
import { Simulation } from './Simulation';

export interface GameOptions {
  characterId: string;
  /** Aceita teclado sem capturar o mouse (testes automáticos). */
  noLock: boolean;
  debug: boolean;
}

export class Game {
  readonly arena: Arena;
  readonly sim: Simulation;
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
  private readonly characterViews = new Map<string, CharacterView>();
  private readonly targetViews = new Map<string, TargetView>();
  private readonly arrows: ArrowRenderer;
  private readonly prevCharacters = new Map<string, Vec3>();
  private readonly prevArrows = new Map<number, Vec3>();
  private readonly localId = 'local';
  private readonly commands = new Map<string, InputCommand>();
  /** Eventos acumulados entre um quadro e outro (pode haver vários ticks). */
  private pendingEvents: GameEvent[] = [];
  private pendingJump = false;
  private started = false;
  private zoom = 0;
  private readonly stats = { shots: 0, hits: 0, heads: 0 };
  private readonly tmpPos = new THREE.Vector3();

  constructor(container: HTMLElement, options: GameOptions) {
    const touchDevice = isTouchDevice();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // Celular: resolução menor para manter a fluidez.
    const maxRatio = touchDevice ? 1.25 : this.settings.graphics === 'high' ? 2 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.settings.graphics !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.rig = new CameraRig(this.camera);
    this.input = new Input(this.renderer.domElement);
    this.input.allowUnlocked = options.noLock;

    this.sky = new Sky(this.scene, ARENA.seed, touchDevice ? 1024 : 2048);
    this.arena = buildArena(ARENA);
    this.scene.add(this.arena.group);

    // Simulação + jogador local.
    this.sim = new Simulation(this.arena.collision, ARENA);
    const sp = ARENA.playerSpawn;
    const player = this.sim.addCharacter(this.localId, getCharacter(options.characterId).id, DEFAULT_BOW_ID, sp.x, sp.z, sp.yaw);
    this.rig.yaw = sp.yaw;
    this.addCharacterView(player.id, player.characterId);
    for (const t of this.sim.state.targets) {
      const view = new TargetView(t);
      this.targetViews.set(t.id, view);
      this.scene.add(view.root);
    }
    this.arrows = new ArrowRenderer(this.scene);

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
    this.hud.setBow(getBow(player.bow.bowId));
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

  get localPlayer() {
    return this.sim.getCharacter(this.localId)!;
  }

  private addCharacterView(id: string, characterId: string): void {
    const view = new CharacterView(getCharacter(characterId));
    this.characterViews.set(id, view);
    this.scene.add(view.root);
  }

  /** Lê o teclado/toque e monta o comando do jogador local para este tick. */
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
      primary: active && (i.mouseButton(0) || i.virtualPrimary),
      secondary: active && i.mouseButton(2),
    };
    this.pendingJump = false;
    return cmd;
  }

  private step(dt: number): void {
    const s = this.sim.state;
    for (const c of s.characters) this.prevCharacters.set(c.id, { ...c.position });
    this.prevArrows.clear();
    for (const a of s.arrows) this.prevArrows.set(a.id, { ...a.position });

    this.commands.set(this.localId, this.buildLocalCommand());
    this.sim.step(this.commands, dt);
    this.pendingEvents.push(...this.sim.events);
  }

  /** Reage aos eventos da simulação (feedback visual do jogador local). */
  private handleEvents(): void {
    for (const e of this.pendingEvents) {
      if (e.type === 'shot' && e.ownerId === this.localId) {
        this.stats.shots++;
      } else if (e.type === 'hit') {
        this.targetViews.get(e.targetId)?.hit();
        if (e.ownerId === this.localId) {
          this.stats.hits++;
          if (e.headshot) this.stats.heads++;
          this.hud.showHitMarker(e.headshot);
          this.hud.spawnDamageNumber(e.position, e.damage, e.headshot);
        }
      } else if (e.type === 'kill' && e.ownerId === this.localId) {
        this.hud.toast('Boneco derrubado!');
      }
    }
    if (this.pendingEvents.length) this.hud.setStats(this.stats.shots, this.stats.hits, this.stats.heads);
    this.pendingEvents = [];
  }

  private render(alpha: number, frameDt: number): void {
    // Mouse e pulo são lidos por quadro (resposta imediata); o pulo fica
    // guardado até o próximo tick da simulação.
    const m = this.input.consumeMouse();
    if (this.input.active) this.rig.look(m.dx, m.dy, this.settings.mouseSensitivity, this.settings.invertY);
    if (this.input.wasPressed('Space')) this.pendingJump = true;
    this.input.endFrame();
    this.handleEvents();

    const s = this.sim.state;
    for (const c of s.characters) {
      const prev = this.prevCharacters.get(c.id) ?? c.position;
      this.tmpPos.set(lerp(prev.x, c.position.x, alpha), lerp(prev.y, c.position.y, alpha), lerp(prev.z, c.position.z, alpha));
      this.characterViews.get(c.id)!.update(c, this.tmpPos, frameDt);
    }
    for (const t of s.targets) this.targetViews.get(t.id)!.update(t, frameDt);
    this.arrows.update(s.arrows, this.prevArrows, alpha);

    const player = this.localPlayer;
    const charge = drawCharge(player);
    this.zoom = damp(this.zoom, player.bow.drawing ? 0.35 + 0.65 * charge : 0, 8, frameDt);
    const playerView = this.characterViews.get(this.localId)!;
    this.rig.update(playerView.root.position, this.arena.collision, player.moveState === 'run', this.zoom, player.bow.swayYaw, player.bow.swayPitch, frameDt);
    this.sky.update(playerView.root.position, frameDt);

    // Mira: dispersão convertida de ângulo para pixels na tela.
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const spreadPx = (Math.tan(player.bow.spread) / Math.tan(halfFov)) * (window.innerHeight / 2);
    this.hud.updateCrosshair({
      drawing: player.bow.drawing,
      charge,
      spreadPx: 3 + spreadPx,
      tired: Math.abs(player.bow.swayYaw) + Math.abs(player.bow.swayPitch) > 0.002,
    });

    this.renderer.render(this.scene, this.camera);

    this.hud.update(frameDt, this.camera, () => {
      const p = player.position;
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      const r = this.renderer.info.render;
      return [
        `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`,
        `vel ${speed.toFixed(1)} m/s · ${player.moveState}`,
        `carga ${(charge * 100).toFixed(0)}% · dispersão ${(player.bow.spread * 1000).toFixed(1)} mrad`,
        `flechas ${s.arrows.length}`,
        `draw calls ${r.calls} · triângulos ${(r.triangles / 1000).toFixed(0)}k`,
      ].join('\n');
    });
  }
}
