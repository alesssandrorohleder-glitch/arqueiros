// Orquestra tudo: simulação (estado puro), entrada, câmera e renderização.
import * as THREE from 'three';
import { BOWS, getBow, DEFAULT_BOW_ID } from '../data/bows';
import { CAMERA } from '../data/camera';
import { getCharacter } from '../data/characters';
import { ARENA } from '../data/maps/arena';
import { MATCH } from '../data/match';
import { MOBS } from '../data/mobs';
import { loadSettings, type Settings } from '../data/settings';
import { ArrowRenderer } from '../entities/ArrowView';
import { CharacterView } from '../entities/CharacterView';
import type { InputCommand } from '../entities/InputCommand';
import { LootView, MobView } from '../entities/MobView';
import { TargetView } from '../entities/TargetView';
import { cssColor, RARITIES, RARITY_ORDER } from '../data/rarities';
import { EffectsView } from '../entities/EffectsView';
import { drawCharge } from '../systems/bow';
import type { AccountService } from '../account/AccountService';
import { CombatHUD } from '../ui/CombatHUD';
import { Menu } from '../ui/Menu';
import { HUD } from '../ui/HUD';
import { isTouchDevice, TouchControls } from '../ui/TouchControls';
import { buildArena, type Arena } from '../world/Arena';
import { Grass } from '../world/Grass';
import { Sky } from '../world/Sky';
import { createTextures } from '../world/textures';
import { AudioEngine } from './Audio';
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
  /** Força a qualidade gráfica (parâmetro ?gfx=low|medium|high). */
  graphics?: 'low' | 'medium' | 'high' | null;
  /** Arco para testar (parâmetro ?bow=), não salvo na conta. */
  testBow?: string | null;
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
  private readonly menu: Menu;
  private headshotKills = 0;
  /** Arcos pegos nesta partida (tela de fim de partida). */
  private pickedBows: string[] = [];
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
  private pendingEquip: string | null = null;
  private shownBowId = '';
  private readonly effects: EffectsView;
  private readonly audio = new AudioEngine();
  private wasDrawing = false;
  private lastVolume = -1;
  private readonly fpsWindow = { time: 0, frames: 0 };
  private readonly maxPixelRatio: number;
  private readonly options: GameOptions;
  private started = false;
  private zoom = 0;
  private readonly stats = { shots: 0, hits: 0, heads: 0 };
  private readonly tmpPos = new THREE.Vector3();

  constructor(container: HTMLElement, options: GameOptions) {
    const touchDevice = isTouchDevice();
    // ?gfx= vale só nesta sessão (não altera as configurações salvas).
    const quality = qualityProfile({ ...this.settings, graphics: options.graphics ?? this.settings.graphics }, touchDevice);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.maxPixelRatio = quality.pixelRatio;
    this.options = options;
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
    this.effects = new EffectsView(this.scene);

    // O áudio só pode começar depois de um toque/clique.
    const unlockAudio = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    container.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.audio.play('click');
    });
    const onPlay = () => {
      if (!this.touch) {
        this.input.requestLock();
        return;
      }
      this.input.allowUnlocked = true;
      this.started = true;
      this.menu.hide();
      this.touch.setVisible(true);
    };
    this.hud = new HUD(container, options.debug, touchDevice);
    this.combat = new CombatHUD(container, () => this.restart());
    // Teste: ?bow=sun equipa qualquer arco só nesta sessão (não salva na conta).
    if (options.testBow && BOWS[options.testBow]) player.bow.bowId = options.testBow;
    if (touchDevice) {
      this.touch = new TouchControls(
        container,
        this.input,
        () => this.settings.touchLookMultiplier,
        () => this.settings.touchFireAimMultiplier,
        () => {
          this.input.allowUnlocked = false;
          this.input.reset();
          this.touch?.setVisible(false);
          this.menu.show('pause');
        },
        () => this.cycleBow(),
      );
    }
    this.menu = new Menu(container, this.accounts, this.settings, touchDevice, {
      play: onPlay,
      chooseCharacter: (id) => this.setLocalCharacter(id),
      // Com o menu aberto a partida está pausada: troca o arco na hora.
      equipBow: (id) => {
        if (BOWS[id] && !this.localPlayer.bow.drawing) this.localPlayer.bow.bowId = id;
      },
      currentBow: () => this.localPlayer.bow.bowId,
      currentCharacter: () => this.localPlayer.characterId,
    });
    if (options.noLock) this.menu.hide();
    else this.menu.show('start');
    document.addEventListener('pointerlockchange', () => {
      if (this.input.locked) {
        this.started = true;
        this.menu.hide();
      } else if (!this.sim.state.match.ended && !this.input.active) {
        // No fim da partida o mouse é liberado para clicar em "Jogar de novo".
        this.menu.show(this.started ? 'pause' : 'start');
      }
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

  /** Troca o personagem do jogador (menu Personagens) e salva na conta. */
  private setLocalCharacter(id: string): void {
    const player = this.localPlayer;
    if (player.characterId === id) return;
    const before = getCharacter(player.characterId).maxHealth;
    player.characterId = getCharacter(id).id;
    player.health = Math.round((player.health / before) * getCharacter(id).maxHealth);
    const old = this.characterViews.get(player.id);
    if (old) this.scene.remove(old.root);
    this.addCharacterView(player.id, player.characterId);
    this.shownBowId = ''; // o arco novo precisa brilhar de novo
    const profile = this.accounts.profile;
    if (profile) {
      profile.characterId = player.characterId;
      this.accounts.save().catch(() => undefined);
    }
  }

  /** Arcos da conta, do mais comum ao mais raro. */
  private ownedBows(): string[] {
    const owned = this.accounts.profile?.ownedBows ?? [DEFAULT_BOW_ID];
    const current = this.localPlayer.bow.bowId;
    const list = owned.includes(current) ? [...owned] : [...owned, current];
    return list.filter((id) => BOWS[id]).sort((a, b) => RARITY_ORDER.indexOf(getBow(a).rarity) - RARITY_ORDER.indexOf(getBow(b).rarity));
  }

  /** Q / botão "Arco": passa para o próximo arco que o jogador tem. */
  private cycleBow(): void {
    const list = this.ownedBows();
    if (list.length < 2) return;
    const i = list.indexOf(this.localPlayer.bow.bowId);
    this.pendingEquip = list[(i + 1) % list.length];
  }

  /** Atualiza o painel do arco e salva a escolha na conta quando o arco muda. */
  private syncBow(): void {
    const id = this.localPlayer.bow.bowId;
    if (id === this.shownBowId) return;
    const first = this.shownBowId === '';
    this.shownBowId = id;
    this.hud.setBow(getBow(id), this.ownedBows().length);
    const profile = this.accounts.profile;
    if (!first && profile && profile.ownedBows.includes(id) && profile.bowId !== id) {
      profile.bowId = id;
      this.accounts.save().catch(() => undefined);
    }
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
        const items = this.pickedBows.length
          ? `<span class="rewards-items">Arcos obtidos: ${this.pickedBows.map((id) => `<b style="color:${cssColor(RARITIES[getBow(id).rarity].color)}">${getBow(id).name}</b>`).join(', ')}</span>`
          : '';
        this.combat.showRewards(`+${rewards.xp} XP${up}${items}<small>Abates ${me.kills} · Criaturas ${me.mobKills} · Mortes ${me.deaths}. Progresso salvo na ${this.accounts.guest ? 'conta de convidado (só neste navegador)' : 'sua conta'}.</small>`);
      }
    } catch (err) {
      this.combat.showRewards(`<small>Não foi possível salvar o resultado: ${err instanceof Error ? err.message : 'erro'}.</small>`);
    }
    this.menu.refreshProfile();
  }

  /** "Jogar de novo" no fim da partida. */
  private restart(): void {
    this.sim.resetMatch();
    this.combat.reset();
    this.lastKillerName = null;
    this.stats.shots = this.stats.hits = this.stats.heads = 0;
    this.headshotKills = 0;
    this.pickedBows = [];
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
      equipBowId: this.pendingEquip,
    };
    this.pendingJump = false;
    this.pendingEquip = null;
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

  /** Sons, partículas, tremor de câmera e reações de animação de cada evento. */
  private feedback(e: GameEvent): void {
    const a = this.audio;
    const me = this.localId;
    const posOf = (id: string) => this.sim.getCombatant(id)?.position;
    switch (e.type) {
      case 'shot': {
        const shooter = this.sim.getCharacter(e.ownerId);
        this.characterViews.get(e.ownerId)?.onShot();
        if (e.ownerId === me) a.play('release', undefined, 0.6 + e.charge * 0.6);
        else if (shooter) a.play('release', shooter.position, 0.7);
        break;
      }
      case 'hit':
        this.effects.sparks(e.position, e.headshot ? 0xffb627 : 0xffe0a0);
        this.characterViews.get(e.targetId)?.onHit();
        if (e.ownerId === me) {
          a.play('hitMarker');
          a.play(e.headshot ? 'hitHead' : 'hitBody', e.position, 1);
        } else if (e.targetId === me) {
          a.play('hurt');
          this.rig.shake(0.35);
        } else {
          a.play('hitBody', e.position, 0.7);
        }
        break;
      case 'arrowStuck':
        this.effects.dust(e.position);
        a.play('arrowStick', e.position, 0.8);
        break;
      case 'kill':
        if (e.victimKind === 'mob') {
          const p = posOf(e.targetId) ?? this.sim.state.mobs.find((m) => m.id === e.targetId)?.position;
          if (p) {
            this.effects.puff(p);
            a.play('mobDeath', p, 0.9);
          }
        }
        if (e.ownerId === me && e.victimKind !== 'target') a.play('kill');
        if (e.targetId === me) a.play('death');
        break;
      case 'explosion': {
        a.play('explosion', e.position, 1);
        const d = Math.hypot(e.position.x - this.localPlayer.position.x, e.position.z - this.localPlayer.position.z);
        if (d < 25) this.rig.shake(0.9 * (1 - d / 25));
        break;
      }
      case 'frost':
        a.play('frost', e.position, 0.9);
        break;
      case 'ricochet':
        a.play('ricochet', e.position, 0.9);
        break;
      case 'mobAttack': {
        const m = this.sim.state.mobs.find((x) => x.id === e.mobId);
        if (m) a.play(MOBS[m.typeId].shape, m.position, 1);
        break;
      }
      case 'pickup':
        if (e.ownerId === me) {
          const rank = RARITY_ORDER.indexOf(getBow(e.bowId).rarity);
          a.play('pickup', undefined, rank + 1);
          this.effects.sparkle(this.localPlayer.position, RARITIES[getBow(e.bowId).rarity].color);
        }
        break;
      case 'matchEnd':
        a.play('fanfare');
        break;
    }
  }

  /** Passos, pulo e queda (lidos das animações) e o rangido ao puxar o arco. */
  private animationSounds(): void {
    const me = this.localPlayer;
    if (me.bow.drawing && !this.wasDrawing) this.audio.play('draw');
    this.wasDrawing = me.bow.drawing;
    for (const c of this.sim.state.characters) {
      const view = this.characterViews.get(c.id);
      if (!view) continue;
      const cues = view.cues;
      const pos = c.id === me.id ? undefined : c.position;
      const running = c.moveState === 'run';
      if (cues.steps > 0) {
        this.audio.play('step', pos, running ? 1 : 0.6);
        if (running && c.id === me.id) this.effects.dust({ x: c.position.x, y: c.position.y + 0.05, z: c.position.z }, 0x9a8a6a, 5, 1);
        cues.steps = 0;
      }
      if (cues.jumped) {
        this.audio.play('jump', pos);
        cues.jumped = false;
      }
      if (cues.landed) {
        this.audio.play('land', pos, 0.8);
        cues.landed = 0;
      }
    }
  }

  /** Resolução dinâmica (gráficos Automático): baixa se o FPS cair, sobe se sobrar. */
  private adaptResolution(dt: number): void {
    if (this.settings.graphics !== 'auto' || this.options.graphics) return;
    this.fpsWindow.time += dt;
    this.fpsWindow.frames++;
    if (this.fpsWindow.time < 2) return;
    const fps = this.fpsWindow.frames / this.fpsWindow.time;
    this.fpsWindow.time = 0;
    this.fpsWindow.frames = 0;
    const current = this.renderer.getPixelRatio();
    let next = current;
    if (fps < 38) next = Math.max(0.6, current * 0.85);
    else if (fps > 58) next = Math.min(this.maxPixelRatio, current * 1.1);
    if (Math.abs(next - current) > 0.02) {
      this.renderer.setPixelRatio(next);
      this.post.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /** Reage aos eventos da simulação (feedback visual do jogador local). */
  private handleEvents(): void {
    for (const e of this.pendingEvents) {
      this.feedback(e);
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
        this.pickedBows.push(e.bowId);
        this.hud.toast(`${e.equipped ? 'Equipou' : 'Pegou'}: ${bow.name} (${rarity.name})`, cssColor(rarity.color));
        this.shownBowId = ''; // atualiza o painel (quantidade de arcos)
        this.accounts.addBow(e.bowId, e.equipped).catch(() => this.hud.toast('Não foi possível salvar o arco na conta.'));
      } else if (e.type === 'explosion') {
        this.effects.explosion(e.position, e.radius);
      } else if (e.type === 'frost') {
        this.effects.frost(e.position);
      } else if (e.type === 'ricochet') {
        this.effects.ricochet(e.position);
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
    if (this.input.wasPressed('KeyQ')) this.cycleBow();
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
    this.effects.update(frameDt);
    this.animationSounds();
    this.audio.setListener(this.camera.position, this.rig.yaw);
    if (this.settings.volume !== this.lastVolume) {
      this.lastVolume = this.settings.volume;
      this.audio.setVolume(this.settings.volume);
    }
    this.audio.update(frameDt);
    this.adaptResolution(frameDt);
    this.syncBow();
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
