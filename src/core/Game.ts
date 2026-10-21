// Orquestra tudo: simulação (estado puro), entrada, câmera e renderização.
import * as THREE from 'three';
import { getBow, DEFAULT_BOW_ID } from '../data/bows';
import { CAMERA } from '../data/camera';
import { getCharacter } from '../data/characters';
import { ARENA } from '../data/maps/arena';
import { MATCH } from '../data/match';
import { loadSettings, type Settings } from '../data/settings';
import { ArrowRenderer } from '../entities/ArrowView';
import { CharacterView } from '../entities/CharacterView';
import type { InputCommand } from '../entities/InputCommand';
import { LootView, MobView } from '../entities/MobView';
import { TargetView } from '../entities/TargetView';
import { RARITIES } from '../data/rarities';
import { drawCharge } from '../systems/bow';
import type { AccountService } from '../account/AccountService';
import { CombatHUD } from '../ui/CombatHUD';
import { ProfileCard } from '../ui/ProfileCard';
import { HUD } from '../ui/HUD';
import { isTouchDevice, TouchControls } from '../ui/TouchControls';
import { buildArena, type Arena } from '../world/Arena';
import { Grass } from '../world/Grass';
import { Sky } from '../world/Sky';
import { createTextures } from '../world/textures';
import { CameraRig } from './CameraRig';
import type { GameEvent } from './events';
import { GameLoop } from './GameLoop';
import { Input } from './Input';
import { damp, lerp, type Vec3 } from './math';
import { PostFX } from './PostFX';
import { qualityProfile } from './quality';
import { Simulation } from './Simulation';

export interface GameOptions {
  characterId: string;
  /** Contas: nome do jogador e onde salvar o resultado das partidas. */
  accounts: AccountService;
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
  private readonly grass: Grass;
  private readonly post: PostFX;
  private readonly hud: HUD;
  private readonly combat: CombatHUD;
  private lastKillerName: string | null = null;
  private readonly accounts: AccountService;
  private readonly profileCard: ProfileCard;
  private headshotKills = 0;
  private readonly touch: TouchControls | null = null;
  private readonly loop: GameLoop;
  private readonly settings: Settings = loadSettings();
  private readonly characterViews = new Map<string, CharacterView>();
  private readonly targetViews = new Map<string, TargetView>();
  private readonly arrows: ArrowRenderer;
  private readonly prevCharacters = new Map<string, Vec3>();
  private readonly prevArrows = new Map<number, Vec3>();
  private readonly prevMobs = new Map<string, Vec3>();
  private readonly mobViews = new Map<string, MobView>();
  private readonly lootViews = new Map<number, LootView>();
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
    const quality = qualityProfile(this.settings, touchDevice);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.settings.graphics !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // O céu físico é bem claro (HDR): exposição menor equilibra a cena.
    this.renderer.toneMappingExposure = 0.6;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.rig = new CameraRig(this.camera);
    this.input = new Input(this.renderer.domElement);
    this.input.allowUnlocked = options.noLock;

    this.sky = new Sky(this.scene, this.renderer, quality.shadowMapSize);
    this.arena = buildArena(ARENA, createTextures(ARENA.seed, quality.textureSize));
    this.scene.add(this.arena.group);
    this.grass = new Grass(this.arena.grassField, quality.grassBlades, quality.grassPatch, this.sky.sunColor, this.sky.ambientColor, ARENA.seed);
    this.scene.add(this.grass.mesh);
    this.post = new PostFX(this.renderer, this.scene, this.camera, quality);

    // Simulação + jogador local.
    this.sim = new Simulation(this.arena.collision, ARENA);
    const spawn = this.sim.spawns[0];
    this.accounts = options.accounts;
    const profile = this.accounts.profile;
    const player = this.sim.addCharacter(this.localId, profile?.username ?? MATCH.playerName, getCharacter(options.characterId).id, profile?.bowId ?? DEFAULT_BOW_ID, spawn);
    this.sim.addBots(DEFAULT_BOW_ID);
    this.rig.yaw = spawn.yaw;
    for (const c of this.sim.state.characters) this.addCharacterView(c.id, c.characterId);
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
    this.combat = new CombatHUD(container, () => this.restart());
    this.profileCard = new ProfileCard(this.hud.accountSlot, this.accounts);
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
      // No fim da partida o mouse é liberado para clicar em "Jogar de novo".
      if (!this.sim.state.match.ended) this.hud.setPaused(!this.input.active, !this.started);
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.post.setSize(window.innerWidth, window.innerHeight);
    });

    this.loop = new GameLoop((dt) => this.step(dt), (alpha, dt) => this.render(alpha, dt));
  }

  start(): void {
    this.loop.start();
  }

  /** Cria/remove/atualiza o visual dos mobs e dos itens no chão. */
  private syncMobsAndLoot(alpha: number, dt: number): void {
    const s = this.sim.state;
    const alive = new Set<string>();
    for (const m of s.mobs) {
      alive.add(m.id);
      let view = this.mobViews.get(m.id);
      if (!view) {
        view = new MobView(m);
        this.mobViews.set(m.id, view);
        this.scene.add(view.root);
      }
      const prev = this.prevMobs.get(m.id) ?? m.position;
      this.tmpPos.set(lerp(prev.x, m.position.x, alpha), lerp(prev.y, m.position.y, alpha), lerp(prev.z, m.position.z, alpha));
      view.update(m, this.tmpPos, dt);
    }
    for (const [id, view] of this.mobViews) {
      if (alive.has(id)) continue;
      this.scene.remove(view.root);
      this.mobViews.delete(id);
    }
    const lootIds = new Set<number>();
    for (const l of s.loot) {
      lootIds.add(l.id);
      let view = this.lootViews.get(l.id);
      if (!view) {
        view = new LootView(RARITIES[getBow(l.bowId).rarity].color);
        view.root.position.set(l.position.x, l.position.y, l.position.z);
        this.lootViews.set(l.id, view);
        this.scene.add(view.root);
      }
      view.update(dt);
    }
    for (const [id, view] of this.lootViews) {
      if (lootIds.has(id)) continue;
      this.scene.remove(view.root);
      this.lootViews.delete(id);
    }
  }

  /** Soma o resultado ao perfil da conta e mostra o XP ganho. */
  private async saveMatchResult(): Promise<void> {
    const me = this.localPlayer;
    const ranked = [...this.sim.state.characters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    try {
      const rewards = await this.accounts.recordMatch({
        kills: me.kills,
        headshotKills: this.headshotKills,
        deaths: me.deaths,
        shots: this.stats.shots,
        hits: this.stats.hits,
        headshots: this.stats.heads,
        mobKills: me.mobKills,
        mobXp: me.matchXp,
        place: ranked.indexOf(me) + 1,
        seconds: MATCH.duration,
      });
      if (rewards) {
        const up = rewards.levelAfter > rewards.levelBefore ? ` · Subiu para o nível ${rewards.levelAfter}!` : '';
        this.combat.showRewards(`+${rewards.xp} XP${up}<small>Progresso salvo na ${this.accounts.guest ? 'conta de convidado (só neste navegador)' : 'sua conta'}.</small>`);
      }
    } catch (err) {
      this.combat.showRewards(`<small>Não foi possível salvar o resultado: ${err instanceof Error ? err.message : 'erro'}.</small>`);
    }
    this.profileCard.render();
  }

  /** "Jogar de novo" no fim da partida. */
  private restart(): void {
    this.sim.resetMatch();
    this.combat.reset();
    this.lastKillerName = null;
    this.stats.shots = this.stats.hits = this.stats.heads = 0;
    this.headshotKills = 0;
    this.hud.setStats(0, 0, 0);
    this.rig.yaw = this.localPlayer.aimYaw;
    this.rig.pitch = -0.12;
    if (this.touch) {
      this.input.allowUnlocked = true;
      this.touch.setVisible(true);
    } else {
      this.input.requestLock();
    }
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
    // Jogo pausado (menu aberto): a partida para.
    if (!this.input.active && !this.sim.state.match.ended) return;
    const s = this.sim.state;
    for (const c of s.characters) this.prevCharacters.set(c.id, { ...c.position });
    this.prevArrows.clear();
    for (const a of s.arrows) this.prevArrows.set(a.id, { ...a.position });
    this.prevMobs.clear();
    for (const m of s.mobs) this.prevMobs.set(m.id, { ...m.position });

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
        this.mobViews.get(e.targetId)?.hit();
        if (e.ownerId === this.localId) {
          this.stats.hits++;
          if (e.headshot) this.stats.heads++;
          this.hud.showHitMarker(e.headshot);
          this.hud.spawnDamageNumber(e.position, e.damage, e.headshot);
        }
        if (e.targetId === this.localId) {
          const attacker = this.sim.getCharacter(e.ownerId);
          this.combat.showDamage(this.localPlayer, attacker ? attacker.position : null, this.rig.yaw);
        }
      } else if (e.type === 'kill') {
        if (e.victimKind === 'target') {
          if (e.ownerId === this.localId) this.hud.toast('Boneco derrubado!');
          continue;
        }
        const killerName = this.sim.nameOf(e.ownerId);
        const victimName = this.sim.nameOf(e.targetId);
        const mine = e.ownerId === this.localId || e.targetId === this.localId;
        // Criaturas abatidas por bots não entram na lista (seria muita coisa).
        if (e.victimKind === 'mob' && !mine) continue;
        this.combat.addKill(killerName, victimName, e.headshot, mine);
        if (e.ownerId === this.localId && e.victimKind === 'character') {
          this.hud.toast(e.headshot ? `Abate na cabeça: ${victimName}!` : `Você eliminou ${victimName}`);
          if (e.headshot) this.headshotKills++;
        }
        if (e.targetId === this.localId) this.lastKillerName = killerName;
      } else if (e.type === 'xp' && e.ownerId === this.localId) {
        this.hud.spawnDamageNumber(e.position, `+${e.amount} XP`, false, 'xp');
      } else if (e.type === 'pickup' && e.ownerId === this.localId) {
        const bow = getBow(e.bowId);
        const rarity = RARITIES[bow.rarity];
        this.hud.toast(`${e.equipped ? 'Equipou' : 'Pegou'}: ${bow.name} (${rarity.name})`);
        if (e.equipped) this.hud.setBow(bow);
        this.accounts.addBow(e.bowId, e.equipped).catch(() => this.hud.toast('Não foi possível salvar o arco na conta.'));
      } else if (e.type === 'matchEnd') {
        this.combat.showEnd(this.sim.state.characters);
        void this.saveMatchResult();
        this.input.allowUnlocked = false;
        this.touch?.setVisible(false);
        if (document.pointerLockElement) document.exitPointerLock();
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
    this.syncMobsAndLoot(alpha, frameDt);
    this.arrows.update(s.arrows, this.prevArrows, alpha);

    const player = this.localPlayer;
    this.combat.update(frameDt, player, s.characters, s.match.timeLeft, this.lastKillerName, this.camera, s.mobs);
    const charge = drawCharge(player);
    this.zoom = damp(this.zoom, player.bow.drawing ? 0.35 + 0.65 * charge : 0, 8, frameDt);
    const playerView = this.characterViews.get(this.localId)!;
    this.rig.update(playerView.root.position, this.arena.collision, player.moveState === 'run', this.zoom, player.bow.swayYaw, player.bow.swayPitch, frameDt);
    this.sky.update(playerView.root.position, frameDt);
    this.grass.update(this.camera.position);

    // Mira: dispersão convertida de ângulo para pixels na tela.
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const spreadPx = (Math.tan(player.bow.spread) / Math.tan(halfFov)) * (window.innerHeight / 2);
    this.hud.updateCrosshair({
      drawing: player.bow.drawing,
      charge,
      spreadPx: 3 + spreadPx,
      tired: Math.abs(player.bow.swayYaw) + Math.abs(player.bow.swayPitch) > 0.002,
    });

    this.post.render();

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
