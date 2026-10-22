// Orquestra tudo: simulação (estado puro), entrada, câmera e renderização.
import * as THREE from 'three';
import { BOWS, getBow, DEFAULT_BOW_ID } from '../data/bows';
import { CAMERA } from '../data/camera';
import { CHARACTERS, getCharacter } from '../data/characters';
import { getAbility } from '../data/abilities';
import { getMode, type ModeDef, type ModeId } from '../data/modes';
import { STRUCTURES, TEAMS } from '../data/objectives';
import { StructureView } from '../entities/StructureView';
import { ZoneView } from '../entities/ZoneView';
import { insideZone, placeOf } from '../systems/zone';
import { castVote, insideAttackArea, startSurrender, surrenderBlocked } from '../systems/objectives';
import { triplanarMaterial } from '../world/materials';
import { saveSettings } from '../data/settings';
import { ROYALE } from '../data/royale';
import type { TextureSet } from '../world/textures';
import { MATCH } from '../data/match';
import { MOBS } from '../data/mobs';
import { loadSettings, type Settings } from '../data/settings';
import { ArrowRenderer } from '../entities/ArrowView';
import { CharacterView } from '../entities/CharacterView';
import { preloadModels } from '../entities/ModelRig';
import type { InputCommand } from '../entities/InputCommand';
import { LootView, MobView } from '../entities/MobView';
import { TargetView } from '../entities/TargetView';
import { Tombstones } from '../entities/Tombstones';
import { cssColor, RARITIES, RARITY_ORDER } from '../data/rarities';
import { EffectsView } from '../entities/EffectsView';
import { drawCharge } from '../systems/bow';
import type { AccountService } from '../account/AccountService';
import { CombatHUD } from '../ui/CombatHUD';
import { Menu } from '../ui/Menu';
import { HUD } from '../ui/HUD';
import { Minimap } from '../ui/Minimap';
import { isTouchDevice, TouchControls } from '../ui/TouchControls';
import { buildArena, type Arena } from '../world/Arena';
import { Grass } from '../world/Grass';
import { Sky } from '../world/Sky';
import { createTextures } from '../world/textures';
import { AudioEngine } from './Audio';
import { CameraRig } from './CameraRig';
import type { GameEvent } from './events';
import { GameLoop, TICK_DT } from './GameLoop';
import { Input } from './Input';
import { damp, lerp, type Vec3 } from './math';
import { PostFX } from './PostFX';
import { qualityProfile } from './quality';
import { Simulation } from './Simulation';
import { applySnapshot, SNAPSHOT_RATE } from '../net/protocol';
import { gameServerUrl, NetClient } from '../net/NetClient';
import { predictBow } from '../systems/bow';
import { stepCharacter } from '../systems/movement';
import { aimDirection, aimOrigin } from '../systems/aim';
import { raycast } from '../systems/collision';
import { raycastHitboxes } from '../systems/hitboxes';
import type { ArrowState } from '../entities/ArrowState';
import { COMBAT, FRENZY, HASTE } from '../data/combat';

export interface GameOptions {
  characterId: string;
  /** Contas: nome do jogador e onde salvar o resultado das partidas. */
  accounts: AccountService;
  /** Aceita teclado sem capturar o mouse (testes automáticos). */
  noLock: boolean;
  debug: boolean;
  /** Modo de jogo inicial (parâmetro ?mode=giants); senão, o último escolhido. */
  mode?: string | null;
  /** Força a qualidade gráfica (parâmetro ?gfx=low|medium|high). */
  graphics?: 'low' | 'medium' | 'high' | null;
  /** Servidor online (parâmetro ?server=ws://...), senão o do build. */
  serverUrl?: string | null;
  /** Arco para testar (parâmetro ?bow=), não salvo na conta. */
  testBow?: string | null;
}

/** Além desta distância (m) da câmera, mobs e tropas não são desenhados. */
const MOB_DRAW_DISTANCE = 85;

/** Comemoração do vencedor no Último de pé antes do placar (s). */
const CELEBRATE_TIME = 4;

/** Duração da câmera lenta no abate com tiro na cabeça (s reais). */
const SLOWMO_TIME = 0.7;

export class Game {
  arena: Arena;
  sim: Simulation;
  /** Modo de jogo atual (data/modes.ts): troca o mapa e as regras. */
  mode: ModeDef;
  private readonly textures: TextureSet;
  private readonly stoneMat: THREE.Material;
  private readonly rockMat: THREE.Material;
  private readonly structureViews = new Map<string, StructureView>();
  /** Parede da zona (Último de pé). */
  private zoneView: ZoneView | null = null;
  /** Último de pé: quem a câmera segue depois que o jogador é eliminado. */
  private spectateId: string | null = null;
  /** Placar de "eliminado" aberto (o menu de pausa não deve abrir por cima). */
  private boardOpen = false;
  /** Último de pé: comemoração do vencedor antes do placar (s restantes) e quem venceu. */
  private celebrate = 0;
  private celebrateId: string | null = null;
  private confettiTimer = 0;
  /** Resultado da partida já salvo na conta (Último de pé salva ao ser eliminado). */
  private resultSaved = false;
  private readonly quality: ReturnType<typeof qualityProfile>;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig: CameraRig;
  private readonly input: Input;
  private readonly sky: Sky;
  private grass: Grass;
  private readonly post: PostFX;
  private readonly hud: HUD;
  private readonly combat: CombatHUD;
  private readonly minimap: Minimap;
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
  private localId = 'local';
  private readonly commands = new Map<string, InputCommand>();
  /** Eventos acumulados entre um quadro e outro (pode haver vários ticks). */
  private pendingEvents: GameEvent[] = [];
  private pendingJump = false;
  private pendingAbility = false;
  private pendingEquip: string | null = null;
  private shownBowId = '';
  private readonly effects: EffectsView;
  private readonly audio = new AudioEngine();
  private wasDrawing = false;
  private lastVolume = -1;
  private readonly fpsWindow = { time: 0, frames: 0 };
  private readonly maxPixelRatio: number;
  private readonly options: GameOptions;
  // ---- multiplayer ----
  private net: NetClient | null = null;
  private online = false;
  private lastSnapTime = 0;
  private snapInterval = 1000 / SNAPSHOT_RATE;
  private readonly prevRemote = new Map<string, Vec3>();
  private readonly prevRemoteArrows = new Map<number, Vec3>();
  /** Flechas cravadas no modo online (o servidor só manda as que estão voando). */
  private stuckArrows: ArrowState[] = [];
  private wasEnded = false;
  private started = false;
  private zoom = 0;
  private readonly stats = { shots: 0, hits: 0, heads: 0 };
  private readonly tmpPos = new THREE.Vector3();
  private readonly tombstones: Tombstones;
  private hasteTrailTimer = 0;
  private lastMusic = -1;
  /** Efeito do abate com tiro na cabeça: câmera lenta e "soco" de zoom. */
  private slowmo = 0;
  private killPunch = 0;
  private headshotStreak = 0;
  private headshotTimer = 0;
  /** Último aviso de "entre no círculo" (ms), para não repetir a cada flecha. */
  private lastRangeHint = 0;
  private shadowFrame = 0;
  /** Pausado: tempo até o próximo desenho do fundo (s). */
  private pausedTimer = 0;
  private readonly lastShadowCam = new THREE.Vector3(1e9, 0, 0);

  constructor(container: HTMLElement, options: GameOptions) {
    preloadModels(Object.values(CHARACTERS));
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
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // O céu físico é bem claro (HDR): exposição menor equilibra a cena.
    this.renderer.toneMappingExposure = 0.6;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.rig = new CameraRig(this.camera);
    this.input = new Input(this.renderer.domElement);
    this.input.allowUnlocked = options.noLock;

    this.sky = new Sky(this.scene, this.renderer, quality.shadowMapSize);
    this.quality = quality;
    this.mode = getMode(options.mode ?? this.settings.mode);
    this.textures = createTextures(this.mode.map.seed, quality.textureSize);
    this.stoneMat = triplanarMaterial(this.textures.stone, 0.35, 0.6, { flatShading: true });
    this.rockMat = triplanarMaterial(this.textures.rock, 0.45, 0.7, { flatShading: true, color: 0xb8b2a8 });
    this.tombstones = new Tombstones(this.scene);
    this.accounts = options.accounts;
    const profile = this.accounts.profile;
    // Mapa, simulação, jogador local e bots do modo escolhido.
    ({ arena: this.arena, sim: this.sim, grass: this.grass } = this.buildWorld(this.mode, profile?.username ?? MATCH.playerName, getCharacter(options.characterId).id, profile?.bowId ?? DEFAULT_BOW_ID));
    const player = this.localPlayer;
    this.post = new PostFX(this.renderer, this.scene, this.camera, quality);
    this.arrows = new ArrowRenderer(this.scene);
    this.arrows.camera = this.camera;
    this.effects = new EffectsView(this.scene);

    // O áudio só pode começar depois de um toque/clique. No celular só alguns
    // eventos contam como gesto (soltar o dedo, clique), então ouvimos todos;
    // e se o sistema pausar o áudio (tela bloqueada, ligação), o próximo toque retoma.
    const unlockAudio = () => {
      if (!this.audio.running) this.audio.unlock();
    };
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlockAudio, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) unlockAudio();
    });
    container.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.audio.play('click');
    });
    const onPlay = () => this.startPlaying();
    this.hud = new HUD(container, options.debug, touchDevice);
    this.combat = new CombatHUD(container, () => this.restart(), () => this.backToMenu());
    this.combat.onVote = (yes) => this.vote(yes);
    this.combat.placeFn = (c) => placeOf(this.sim, c.id);
    // "Assistir" depois de ser eliminado (Último de pé): volta o controle da câmera.
    this.combat.onWatch = () => {
      this.boardOpen = false;
      if (this.touch) {
        this.input.allowUnlocked = true;
        this.touch.setVisible(true);
      } else {
        this.input.requestLock();
      }
    };
    this.minimap = new Minimap(container, touchDevice && Math.min(window.innerWidth, window.innerHeight) < 500);
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
        this.net?.sendProfile(this.localPlayer.characterId, id);
      },
      playOnline: gameServerUrl(options.serverUrl) ? () => this.playOnline() : null,
      currentBow: () => this.localPlayer.bow.bowId,
      currentCharacter: () => this.localPlayer.characterId,
      chooseMode: (id) => this.switchMode(id),
      currentMode: () => this.mode.id,
      surrender: () => {
        const me = this.localPlayer;
        const blocked = surrenderBlocked(this.sim, me.team);
        if (blocked) return blocked;
        startSurrender(this.sim, me.id);
        return 'Votação aberta: seu time tem 20 s para votar (3 "sim" para desistir).';
      },
    });
    if (options.noLock) this.menu.hide();
    else this.menu.show('start');
    document.addEventListener('pointerlockchange', () => {
      if (this.input.locked) {
        this.started = true;
        this.menu.hide();
      } else if (!this.sim.state.match.ended && !this.input.active && !this.boardOpen) {
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

  /**
   * Cria o mundo de um modo: mapa (malhas e colisão), grama, simulação, o
   * jogador local (no time Azul, no modo Gigantes), bots e os visuais.
   * Chamado no início e ao trocar de modo no menu (o mundo anterior é desfeito).
   */
  private buildWorld(mode: ModeDef, name: string, characterId: string, bowId: string): { arena: Arena; sim: Simulation; grass: Grass } {
    const map = mode.map;
    const arena = buildArena(map, this.textures);
    this.scene.add(arena.group);
    const grass = new Grass(arena.grassField, this.quality.grassBlades, this.quality.grassPatch, this.sky.sunColor, this.sky.ambientColor, map.seed);
    this.scene.add(grass.mesh);
    const sim = new Simulation(arena.collision, map, { royale: mode.royale });
    const spawn = sim.teams ? sim.teamSpawn(0, 0) : sim.spawns[0];
    sim.addCharacter(this.localId, name, characterId, bowId, spawn, false, 0);
    sim.botLevel = this.settings.botLevel;
    sim.addBots(DEFAULT_BOW_ID, mode.bots);
    this.rig.yaw = spawn.yaw;
    this.rig.pitch = -0.12;
    for (const c of sim.state.characters) this.addCharacterView(c.id, c.characterId);
    for (const t of sim.state.targets) {
      const view = new TargetView(t);
      this.targetViews.set(t.id, view);
      this.scene.add(view.root);
    }
    for (const st of sim.state.structures) {
      const view = new StructureView(st, this.stoneMat, this.rockMat, arena.height);
      this.structureViews.set(st.id, view);
      this.scene.add(view.root, view.area);
    }
    if (this.combat) this.endCelebration();
    if (this.zoneView) this.scene.remove(this.zoneView.mesh);
    this.zoneView = null;
    if (sim.royale) {
      this.zoneView = new ZoneView();
      this.scene.add(this.zoneView.mesh);
    }
    this.spectateId = null;
    this.resultSaved = false;
    return { arena, sim, grass };
  }

  /** Menu → outro modo: desfaz o mundo atual e cria o novo (a partida recomeça). */
  private switchMode(id: ModeId): void {
    if (this.online || id === this.mode.id) return;
    const me = this.localPlayer;
    const keep = { name: me.name, characterId: me.characterId, bowId: me.bow.bowId };
    // Desfaz o mundo anterior (malhas, grama, visuais de personagens, mobs, estruturas).
    const disposeTree = (root: THREE.Object3D) => root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.scene.remove(this.arena.group);
    disposeTree(this.arena.group);
    this.scene.remove(this.grass.mesh);
    this.grass.mesh.geometry.dispose();
    const views: Map<unknown, { root: THREE.Object3D }>[] = [this.characterViews, this.targetViews, this.mobViews, this.lootViews, this.structureViews];
    for (const map of views) {
      for (const v of map.values()) this.scene.remove(v.root, (v as { area?: THREE.Object3D }).area ?? v.root);
      map.clear();
    }
    this.prevCharacters.clear();
    this.prevMobs.clear();
    this.prevArrows.clear();
    this.tombstones.clear();
    this.mode = getMode(id);
    this.settings.mode = this.mode.id;
    saveSettings(this.settings);
    ({ arena: this.arena, sim: this.sim, grass: this.grass } = this.buildWorld(this.mode, keep.name, keep.characterId, keep.bowId));
    this.shownBowId = '';
    this.combat.reset();
    this.lastKillerName = null;
    this.stats.shots = this.stats.hits = this.stats.heads = 0;
    this.headshotKills = 0;
    this.pickedBows = [];
    this.hud.setStats(0, 0, 0);
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
    this.net?.sendProfile(player.characterId, player.bow.bowId);
  }

  /** Há um inimigo (personagem ou mob) exatamente sob a mira? (mira fica vermelha) */
  private enemyUnderCrosshair(): boolean {
    const me = this.localPlayer;
    if (me.health <= 0) return false;
    const o = aimOrigin(me);
    const d = aimDirection(me.aimYaw, me.aimPitch);
    const wall = raycast(this.sim.world, o.x, o.y, o.z, d.x, d.y, d.z, COMBAT.hitscanRange);
    const hit = raycastHitboxes(this.sim.hitboxes(), o, d, wall ? wall.distance : COMBAT.hitscanRange, COMBAT.arrowRadius, me.id);
    return !!hit && hit.hitbox.kind !== 'target' && !this.sim.sameTeam(me.id, hit.hitbox.id);
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
      const prev = (this.online ? this.prevRemote.get(m.id) : this.prevMobs.get(m.id)) ?? m.position;
      this.tmpPos.set(lerp(prev.x, m.position.x, alpha), lerp(prev.y, m.position.y, alpha), lerp(prev.z, m.position.z, alpha));
      // Criaturas e tropas muito longe da câmera não são desenhadas (nem animadas).
      const far = this.tmpPos.distanceToSquared(this.camera.position) > MOB_DRAW_DISTANCE ** 2;
      view.root.visible = !far;
      if (!far) view.update(m, this.tmpPos, dt);
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
        view = new LootView(l.bowId);
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
    if (this.resultSaved) return;
    this.resultSaved = true;
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
        // Gigantes: vitória do time conta como 1º lugar; derrota, como 4º (sem bônus de top 3).
        place: this.sim.royale ? placeOf(this.sim, me.id) : this.sim.teams ? (this.sim.state.match.winner === me.team ? 1 : 4) : ranked.indexOf(me) + 1,
        seconds: Math.round(this.sim.state.match.elapsed),
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

  /** Fecha o menu e começa a jogar (pede o mouse no PC; controles na tela no celular). */
  private startPlaying(): void {
    this.audio.unlock();
    if (!this.touch) {
      this.input.requestLock();
      if (this.options.noLock) this.menu.hide();
      return;
    }
    this.input.allowUnlocked = true;
    this.started = true;
    this.menu.hide();
    this.touch.setVisible(true);
  }

  /** O servidor começou outra partida. */
  private onNewOnlineMatch(): void {
    this.combat.reset();
    this.lastKillerName = null;
    this.stats.shots = this.stats.hits = this.stats.heads = 0;
    this.headshotKills = 0;
    this.pickedBows = [];
    this.stuckArrows = [];
    this.hud.setStats(0, 0, 0);
  }

  /** "Jogar de novo" no fim da partida. */
  private restart(): void {
    this.resetMatch();
    if (this.touch) {
      this.input.allowUnlocked = true;
      this.touch.setVisible(true);
    } else {
      this.input.requestLock();
    }
  }

  /** "Voltar ao menu" no fim da partida: zera a partida e abre o menu inicial (dá para trocar de modo). */
  private backToMenu(): void {
    this.resetMatch();
    this.started = false;
    this.input.allowUnlocked = false;
    this.input.reset();
    this.touch?.setVisible(false);
    if (document.pointerLockElement) document.exitPointerLock();
    this.menu.show('start');
  }

  /** Partida nova do zero (mesmo modo): placar, estruturas, posições e estatísticas. */
  private resetMatch(): void {
    this.endCelebration();
    this.spectateId = null;
    this.boardOpen = false;
    this.resultSaved = false;
    this.sim.resetMatch();
    this.tombstones.clear();
    this.combat.reset();
    this.lastKillerName = null;
    this.stats.shots = this.stats.hits = this.stats.heads = 0;
    this.headshotKills = 0;
    this.pickedBows = [];
    this.hud.setStats(0, 0, 0);
    this.rig.yaw = this.localPlayer.aimYaw;
    this.rig.pitch = -0.12;
  }

  /** Para a comemoração (partida nova ou troca de modo). */
  private endCelebration(): void {
    this.celebrate = 0;
    this.celebrateId = null;
    this.combat.hideBanner();
    for (const v of this.characterViews.values()) v.cheer = false;
  }

  /** Fim de partida: salva o resultado e solta o mouse para clicar no placar. */
  private finishMatchScreen(): void {
    void this.saveMatchResult();
    this.input.allowUnlocked = false;
    this.touch?.setVisible(false);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Comemoração do vencedor (Último de pé): câmera girando em volta dele, confete; no fim, o placar. */
  private stepCelebration(dt: number): void {
    if (this.celebrate <= 0) return;
    this.celebrate -= dt;
    this.rig.yaw += dt * 0.75;
    this.rig.pitch += (-0.05 - this.rig.pitch) * Math.min(1, dt * 2);
    const view = this.celebrateId ? this.characterViews.get(this.celebrateId) : undefined;
    this.confettiTimer -= dt;
    if (view && this.confettiTimer <= 0) {
      this.confettiTimer = 0.45;
      const p = view.root.position;
      this.effects.confetti({ x: p.x, y: p.y + 2.4, z: p.z });
    }
    if (this.celebrate > 0) return;
    // Acabou a comemoração: placar final.
    this.celebrate = 0;
    this.combat.hideBanner();
    const m = this.sim.state.match;
    const won = m.winnerId === this.localId;
    const title = won ? `Vitória! Você é o último de pé (${this.sim.state.characters.length} arqueiros)` : `Fim — ${this.sim.nameOf(m.winnerId ?? '')} venceu · você ficou em ${placeOf(this.sim, this.localId)}º`;
    this.combat.showEnd(this.sim.state.characters, undefined, { title, won });
    this.finishMatchScreen();
  }

  /** Último de pé: vivos, texto da zona e colocação para o HUD. */
  private royaleView() {
    const z = this.sim.state.match.zone;
    if (!z) return null;
    const me = this.localPlayer;
    const phases = ROYALE.phases.length;
    const t = Math.max(0, Math.ceil(z.timer));
    const clock = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const zoneText = z.phase >= phases ? 'Zona fechada' : z.shrinking ? `Zona fechando ${clock}` : `Zona fecha em ${clock}`;
    return {
      alive: this.sim.state.characters.filter((c) => c.health > 0).length,
      total: this.sim.state.characters.length,
      zoneText,
      shrinking: z.shrinking,
      outside: !insideZone(z, me.position.x, me.position.z),
      place: placeOf(this.sim, me.id),
      spectating: this.spectateId && me.health <= 0 ? this.sim.nameOf(this.spectateId) : null,
    };
  }

  /** Quem a câmera segue: o jogador; eliminado no Último de pé, alguém vivo (quem o eliminou, de preferência). */
  private cameraTarget() {
    const me = this.localPlayer;
    // Comemoração: a câmera vai para o vencedor.
    const winner = this.celebrateId ? this.sim.getCharacter(this.celebrateId) : undefined;
    if (winner) return winner;
    if (!this.sim.royale || me.health > 0) return me;
    let t = this.spectateId ? this.sim.getCharacter(this.spectateId) : undefined;
    if (!t || t.health <= 0) {
      const killer = me.lastAttackerId ? this.sim.getCharacter(me.lastAttackerId) : undefined;
      t = killer && killer.health > 0 ? killer : this.sim.state.characters.find((c) => c.health > 0);
      this.spectateId = t?.id ?? null;
    }
    return t ?? me;
  }

  /** Voto do jogador na votação do time dele (se houver). */
  private vote(yes: boolean): void {
    const v = this.sim.state.match.surrender;
    if (v && v.team === this.localPlayer.team) castVote(this.sim, this.localId, yes);
  }

  /** Tempo, estruturas e votação para o HUD. */
  private matchView() {
    const m = this.sim.state.match;
    const me = this.localPlayer;
    const v = m.surrender && m.surrender.team === me.team ? m.surrender : null;
    const team = this.sim.state.characters.filter((c) => c.team === me.team);
    return {
      teams: this.sim.teams,
      royale: this.royaleView(),
      elapsed: m.elapsed,
      structures: this.sim.state.structures,
      vote: v
        ? {
            yes: team.filter((c) => v.votes[c.id] === true).length,
            no: team.filter((c) => v.votes[c.id] === false).length,
            total: team.length,
            timeLeft: v.timeLeft,
            myVote: me.id in v.votes ? v.votes[me.id] : null,
            mine: v.startedBy === me.id,
          }
        : null,
    };
  }

  get localPlayer() {
    return this.sim.getCharacter(this.localId)!;
  }

  private addCharacterView(id: string, characterId: string): void {
    const view = new CharacterView(getCharacter(characterId));
    // No próprio jogador a aura cobriria a tela; a borda laranja do HUD já avisa.
    view.showAura = id !== this.localId;
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
      ability: active && this.pendingAbility,
      aimYaw: this.rig.yaw,
      aimPitch: this.rig.pitch,
      primary: active && (i.mouseButton(0) || i.virtualPrimary),
      secondary: active && i.mouseButton(2),
      equipBowId: this.pendingEquip,
      aimAssist: this.settings.aimAssist ?? !!this.touch,
    };
    this.pendingJump = false;
    this.pendingAbility = false;
    this.pendingEquip = null;
    return cmd;
  }

  private step(dt: number): void {
    if (this.online) {
      this.stepOnline(dt);
      return;
    }
    // Guarda as posições atuais (a renderização interpola entre elas e as do próximo tick).
    // Pausado, "anterior = atual": senão a interpolação ficava indo e voltando e o fundo do menu tremia.
    const s = this.sim.state;
    for (const c of s.characters) this.prevCharacters.set(c.id, { ...c.position });
    this.prevArrows.clear();
    for (const a of s.arrows) this.prevArrows.set(a.id, { ...a.position });
    this.prevMobs.clear();
    for (const m of s.mobs) this.prevMobs.set(m.id, { ...m.position });
    // Jogo pausado (menu aberto): a partida para.
    if (this.paused) return;

    this.commands.set(this.localId, this.buildLocalCommand());
    this.sim.step(this.commands, dt);
    this.pendingEvents.push(...this.sim.events);
  }

  // ================================================================ online

  /** Conecta no servidor; a troca para o modo online acontece no 1º snapshot. */
  playOnline(): void {
    const url = gameServerUrl(this.options.serverUrl);
    if (!url || this.net) return;
    const me = this.localPlayer;
    this.menu.setStatus('Conectando ao servidor…');
    this.net = new NetClient(url, { name: me.name, characterId: me.characterId, bowId: me.bow.bowId }, (reason) => {
      this.menu.setStatus(`${reason} Toque em "Treino offline" para jogar contra bots.`);
      this.menu.show('start');
      this.touch?.setVisible(false);
      this.input.allowUnlocked = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.net = null;
      this.online = false;
    });
  }

  /** Recebe os snapshots: aplica o estado do servidor e refaz a previsão local. */
  private receiveSnapshots(now: number): void {
    const net = this.net;
    if (!net) return;
    for (const snap of net.drain()) {
      if (!this.online) {
        if (!net.id) continue;
        this.enterOnline(net.id);
      }
      const s = this.sim.state;
      // Guarda as posições atuais dos outros para interpolar até as novas.
      this.prevRemote.clear();
      for (const c of s.characters) if (c.id !== this.localId) this.prevRemote.set(c.id, { ...c.position });
      for (const m of s.mobs) this.prevRemote.set(m.id, { ...m.position });
      this.prevRemoteArrows.clear();
      for (const a of s.arrows) this.prevRemoteArrows.set(a.id, { ...a.position });

      // O arco do jogador local é previsto aqui (sem esperar o servidor).
      const before = this.sim.getCharacter(this.localId);
      const myBow = before ? { drawing: before.bow.drawing, drawTime: before.bow.drawTime, cooldown: before.bow.cooldown } : null;
      applySnapshot(s, snap.s);
      this.sim.invalidateHitboxes();
      if (this.lastSnapTime) this.snapInterval = this.snapInterval * 0.9 + Math.min(200, now - this.lastSnapTime) * 0.1;
      this.lastSnapTime = now;

      // Reconciliação: parte do estado confirmado e reaplica os comandos pendentes.
      net.acknowledge(snap.ack);
      const me = this.sim.getCharacter(this.localId);
      if (me) {
        if (myBow && me.health > 0) Object.assign(me.bow, myBow);
        if (me.health > 0) for (const p of net.pending) stepCharacter(me, p.cmd, this.sim.world, TICK_DT);
      }
      this.pendingEvents.push(...snap.e);
    }
  }

  /** Primeiro snapshot: troca o mundo offline pelo da sala. */
  private enterOnline(id: string): void {
    this.online = true;
    for (const view of this.characterViews.values()) this.scene.remove(view.root);
    this.characterViews.clear();
    this.prevCharacters.clear();
    this.sim.bots.clear();
    this.sim.state.characters = [];
    this.sim.state.arrows = [];
    this.sim.state.mobs = [];
    this.sim.state.loot = [];
    this.localId = id;
    this.shownBowId = '';
    this.stats.shots = this.stats.hits = this.stats.heads = 0;
    this.hud.setStats(0, 0, 0);
    this.menu.setStatus('');
    this.menu.setOnline();
    this.combat.setOnline(true);
    // Começa a jogar direto ao entrar na sala.
    this.startPlaying();
  }

  /** Tick no modo online: manda o comando e prevê o próprio movimento. */
  private stepOnline(dt: number): void {
    const me = this.sim.getCharacter(this.localId);
    if (!me || !this.net) return;
    this.prevCharacters.set(me.id, { ...me.position });
    const cmd = this.buildLocalCommand();
    if (!this.input.active) {
      cmd.forward = cmd.right = 0;
      cmd.primary = cmd.sprint = cmd.jump = false;
    }
    this.net.sendInput(cmd);
    if (me.health > 0) {
      stepCharacter(me, cmd, this.sim.world, dt);
      // Online: sente cada disparo na hora (som, tranco, vibração), sem esperar o servidor.
      if (predictBow(me, cmd, dt)) this.localShotFeedback(1);
    }
    // Flechas cravadas (locais) somem depois de um tempo.
    for (const a of this.stuckArrows) a.age += dt;
    if (this.stuckArrows.some((a) => a.age > COMBAT.stuckArrowLifetime)) {
      this.stuckArrows = this.stuckArrows.filter((a) => a.age <= COMBAT.stuckArrowLifetime);
    }
  }

  /** Cria/remove o visual dos personagens que entram e saem da sala. */
  private syncCharacterViews(): void {
    const ids = new Set(this.sim.state.characters.map((c) => c.id));
    for (const c of this.sim.state.characters) if (!this.characterViews.has(c.id)) this.addCharacterView(c.id, c.characterId);
    for (const [id, view] of this.characterViews) {
      if (!ids.has(id)) {
        this.scene.remove(view.root);
        this.characterViews.delete(id);
      }
    }
  }

  /** Sons, partículas, tremor de câmera e reações de animação de cada evento. */
  private feedback(e: GameEvent): void {
    const a = this.audio;
    const me = this.localId;
    const posOf = (id: string) => this.sim.getCombatant(id)?.position;
    switch (e.type) {
      case 'ability': {
        const ab = getAbility(this.sim.getCharacter(e.ownerId)?.characterId ?? 'hunter');
        this.effects.abilityFx(e.kind, e.from, e.to, ab.color);
        a.play(e.kind === 'emp' ? 'emp' : e.kind === 'blink' ? 'blink' : 'ability', e.from, 1);
        if (e.ownerId === me) this.hud.toast(ab.name + '!', cssColor(ab.color));
        break;
      }
      case 'buff':
        if (e.ownerId === me) {
          if (e.buff === 'frenzy') this.hud.toast(`FÚRIA! Tiro rápido por ${FRENZY.duration} s`, '#ff8a2a');
          else this.hud.toast(`VELOCIDADE! Corre ${Math.round((HASTE.speedMultiplier - 1) * 100)}% mais por ${HASTE.duration} s`, '#4ab8ff');
          a.play('fanfare');
        }
        break;
      case 'shot': {
        const shooter = this.sim.getCharacter(e.ownerId);
        const view = this.characterViews.get(e.ownerId);
        if (!(this.online && e.ownerId === me)) view?.onShot();
        if (view && shooter) {
          const r = this.rarityOf(shooter.bow.bowId);
          this.effects.muzzle(view.muzzlePoint(this.tmpPos), r.color, r.rank);
        }
        // Online o disparo do jogador local já foi sentido na hora (localShotFeedback).
        if (e.ownerId === me && !this.online) this.localShotFeedback(e.charge);
        else if (shooter) a.play('release', shooter.position, 0.7);
        break;
      }
      case 'hit': {
        const shooter = this.sim.getCharacter(e.ownerId);
        const r = this.rarityOf(shooter?.bow.bowId ?? DEFAULT_BOW_ID);
        this.effects.impact(e.position, e.headshot ? 0xffb627 : r.color, r.rank, e.headshot);
        this.characterViews.get(e.targetId)?.onHit();
        this.structureViews.get(e.targetId)?.onHit();
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
      }
      case 'arrowStuck':
        if (this.online) {
          this.stuckArrows.push({
            id: e.arrowId, ownerId: '', position: e.position, velocity: { x: 0, y: 0, z: 0 }, damage: 0, rarity: e.rarity, age: 0,
            stuck: true, stuckDir: e.dir, stuckToTarget: e.targetId, effect: null, trail: e.trail, path: [], endStick: true,
          });
          if (this.stuckArrows.length > COMBAT.maxStuckArrows) this.stuckArrows.shift();
        }
        // Em alvos/mobs o acerto já tem som e faíscas próprios.
        if (!e.targetId) {
          this.effects.dust(e.position);
          const rank = RARITY_ORDER.indexOf(e.rarity);
          this.effects.impact(e.position, RARITIES[e.rarity].color, rank);
          a.play('arrowStick', e.position, 0.8);
        }
        break;
      case 'kill':
        if (this.online && e.victimKind !== 'character') this.stuckArrows = this.stuckArrows.filter((x) => x.stuckToTarget !== e.targetId);
        if (e.victimKind === 'mob') {
          const p = posOf(e.targetId) ?? this.sim.state.mobs.find((m) => m.id === e.targetId)?.position;
          if (p) {
            this.effects.puff(p);
            a.play('mobDeath', p, 0.9);
          }
        }
        if (e.victimKind === 'character') {
          // Lápide no lugar da morte, virada para quem eliminou.
          const victim = this.sim.getCharacter(e.targetId);
          const killer = posOf(e.ownerId);
          if (victim) {
            const yaw = killer ? Math.atan2(-(killer.x - victim.position.x), -(killer.z - victim.position.z)) : victim.bodyYaw;
            this.tombstones.add(victim.position, yaw, victim.name);
          }
        }
        if (e.ownerId === me && e.victimKind !== 'target') {
          // Animação de abate na cabeça só em personagens (jogadores e bots), não em criaturas/tropas.
          if (e.headshot && e.victimKind === 'character') {
            // Abate com tiro na cabeça: animação especial.
            const vp = posOf(e.targetId) ?? this.sim.state.mobs.find((m) => m.id === e.targetId)?.position;
            const h = e.victimKind === 'character' ? getCharacter(this.sim.getCharacter(e.targetId)?.characterId ?? 'hunter').height : 1.2;
            if (vp) this.effects.headshotKill({ x: vp.x, y: vp.y + h, z: vp.z });
            this.headshotStreak = this.headshotTimer > 0 ? this.headshotStreak + 1 : 1;
            this.headshotTimer = 4;
            this.hud.headshotKill(this.headshotStreak);
            a.play('headshotKill');
            this.rig.shake(0.55);
            this.killPunch = 1;
            if (!this.online) this.slowmo = SLOWMO_TIME;
            if (this.settings.vibration && navigator.vibrate) navigator.vibrate([30, 40, 60]);
          } else {
            a.play('kill');
          }
        }
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
      case 'matchEnd': {
        const w = this.sim.state.match.winner;
        a.play(w === null || w === this.localPlayer.team ? 'fanfare' : 'defeat');
        break;
      }
      // ---- modo Gigantes ----
      case 'towerShot':
        this.effects.towerBolt(e.from, e.to, TEAMS[e.team].color);
        this.structureViews.get(e.ownerId)?.onShot();
        a.play('towerShot', e.from, 0.8);
        break;
      case 'giantWindup': {
        const st = this.sim.getStructure(e.ownerId);
        this.structureViews.get(e.ownerId)?.onWindup(STRUCTURES.giant.windup);
        if (st) a.play('giantRoar', st.position, 1);
        break;
      }
      case 'giantSlam': {
        const st = this.sim.getStructure(e.ownerId);
        this.structureViews.get(e.ownerId)?.onSlam();
        this.effects.giantSlam(e.position, e.radius, TEAMS[st?.team ?? 0].color);
        a.play('giantSlam', e.position, 1.2);
        const d = Math.hypot(e.position.x - this.localPlayer.position.x, e.position.z - this.localPlayer.position.z);
        if (d < 30) this.rig.shake(1.1 * (1 - d / 30));
        break;
      }
      case 'outOfRange':
        // Tiro de fora do círculo: só um tlinc, sem dano.
        if (e.ownerId === me) {
          this.effects.shieldSpark(e.position, 0x9aa4b4);
          a.play('shield', e.position, 0.6);
          if (performance.now() - this.lastRangeHint > 4000) {
            this.lastRangeHint = performance.now();
            const kind = this.sim.getStructure(e.targetId)?.kind === 'giant' ? 'do gigante' : 'da torre';
            this.hud.toast(`Longe demais! Entre no círculo ${kind} para causar dano.`, '#e8c26a');
          }
        }
        break;
      case 'shielded':
        this.structureViews.get(e.targetId)?.onShielded();
        this.effects.shieldSpark(e.position, TEAMS[this.sim.getStructure(e.targetId)?.team ?? 0].color);
        if (e.ownerId === me) a.play('shield', e.position, 1);
        break;
      case 'structureDestroyed': {
        const st = this.sim.getStructure(e.targetId);
        if (st) {
          this.effects.collapse(st.position, STRUCTURES[e.kind].height, TEAMS[e.team].color);
          a.play('collapse', st.position, 1.4);
          a.play(e.team === this.localPlayer.team ? 'defeat' : 'fanfare');
          const d = Math.hypot(st.position.x - this.localPlayer.position.x, st.position.z - this.localPlayer.position.z);
          if (d < 50) this.rig.shake(0.9 * (1 - d / 50));
        }
        break;
      }
      case 'wave':
        a.play('horn', undefined, 0.5);
        break;
    }
  }

  /** Som, tranco da câmera e vibração do celular ao disparar. */
  private localShotFeedback(charge: number): void {
    this.audio.play('release', undefined, 0.6 + charge * 0.6);
    this.characterViews.get(this.localId)?.onShot();
    if (!this.settings.vibration) return;
    this.rig.kick(charge);
    // Vibração do celular (Android/Chrome; o iPhone não permite em páginas web).
    try {
      navigator.vibrate?.(Math.round(25 + charge * 35));
    } catch {
      // sem vibração neste aparelho
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
  /**
   * Qualidade automática. Antes baixava a resolução até 60% e quase nunca voltava
   * (celular aquecido ou limitado a 30 Hz), deixando a imagem borrada.
   * Agora: primeiro desliga o bloom; a resolução nunca fica abaixo de
   * `minPixelRatio` e volta a subir assim que sobra FPS.
   */
  private adaptResolution(dt: number): void {
    // Pausado (dt 0, só 4 desenhos por segundo) não conta: o FPS medido seria falso.
    if (this.settings.graphics !== 'auto' || this.options.graphics || dt === 0) return;
    this.fpsWindow.time += dt;
    this.fpsWindow.frames++;
    if (this.fpsWindow.time < 3) return;
    const fps = this.fpsWindow.frames / this.fpsWindow.time;
    this.fpsWindow.time = 0;
    this.fpsWindow.frames = 0;
    const current = this.renderer.getPixelRatio();
    // Mínimo: 1 pixel por pixel da tela (ou 75% da resolução cheia em telas de alta densidade).
    const minRatio = Math.min(this.maxPixelRatio, Math.max(1, this.maxPixelRatio * 0.75));
    let next = current;
    if (fps < 28) {
      if (this.post.enabled) {
        this.post.enabled = false;
        return;
      }
      next = Math.max(minRatio, current * 0.9);
    } else if (fps > 45) {
      if (current < this.maxPixelRatio) next = Math.min(this.maxPixelRatio, current * 1.1);
      else if (!this.post.enabled && fps > 55) this.post.enabled = true;
    }
    if (Math.abs(next - current) > 0.02) {
      this.renderer.setPixelRatio(next);
      this.post.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /** Rastro de poeira azul nos pés de quem está com Velocidade e correndo. */
  private hasteTrails(dt: number): void {
    this.hasteTrailTimer -= dt;
    if (this.hasteTrailTimer > 0) return;
    this.hasteTrailTimer = 0.08;
    for (const c of this.sim.state.characters) {
      const v = this.characterViews.get(c.id);
      if (!v || c.health <= 0) continue;
      // Chama do propulsor enquanto voa/plana.
      if (c.glide > 0 && !c.grounded) this.effects.dust({ x: v.root.position.x, y: v.root.position.y + 0.3, z: v.root.position.z }, 0xffa040, 3, 1.5);
      if (c.haste <= 0 || Math.hypot(c.velocity.x, c.velocity.z) < 2) continue;
      this.effects.dust(v.root.position, HASTE.color, 4, 1.2);
    }
  }

  private rarityOf(bowId: string): { color: number; rank: number } {
    const rarity = getBow(bowId).rarity;
    return { color: RARITIES[rarity].color, rank: RARITY_ORDER.indexOf(rarity) };
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
        // Último de pé: eliminado de vez → placar com a colocação (salva já) e opção de assistir.
        if (e.targetId === this.localId && this.sim.royale && e.victimKind === 'character') {
          const place = placeOf(this.sim, this.localId);
          const left = this.sim.state.characters.filter((c) => c.health > 0).length;
          if (left > 1) {
            this.boardOpen = true;
            this.combat.showEnd(this.sim.state.characters, undefined, { title: `Eliminado — ${place}º lugar de ${this.sim.state.characters.length}`, won: false, watch: true });
            void this.saveMatchResult();
            this.input.allowUnlocked = false;
            this.touch?.setVisible(false);
            if (document.pointerLockElement) document.exitPointerLock();
          }
        }
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
      } else if (e.type === 'structureDestroyed') {
        const mine = e.team === this.localPlayer.team;
        const what = e.kind === 'giant' ? 'gigante' : 'torre';
        this.combat.addKill(this.sim.nameOf(e.ownerId), this.sim.nameOf(e.targetId), false, mine);
        if (e.kind === 'tower') {
          const left = this.sim.state.structures.filter((x) => x.kind === 'tower' && x.team === e.team && !x.destroyed).length;
          const extra = left === 0 ? (mine ? ' Seu gigante perdeu a proteção!' : ' O gigante inimigo está vulnerável!') : '';
          this.hud.toast(mine ? `Uma ${what} do seu time caiu!${extra}` : `Torre inimiga derrubada! +${STRUCTURES.tower.xp} XP.${extra}`, mine ? TEAMS[1].css : TEAMS[0].css);
        }
      } else if (e.type === 'wave') {
        if (this.sim.state.match.elapsed < 20) this.hud.toast('As tropas saíram da base!', TEAMS[this.localPlayer.team].css);
      } else if (e.type === 'surrenderVote') {
        if (e.team === this.localPlayer.team) this.hud.toast(e.byId === this.localId ? 'Votação aberta: 3 "sim" para desistir.' : `${this.sim.nameOf(e.byId)} quer desistir. Vote: 1 = sim, 2 = não.`, '#e8c26a');
        else this.hud.toast('O time rival está votando para desistir...', '#e8c26a');
      } else if (e.type === 'surrenderResult') {
        if (!e.passed) this.hud.toast(`${e.team === this.localPlayer.team ? 'Seu time' : 'O time rival'} decidiu continuar (${e.yes} sim × ${e.no} não).`, '#e8c26a');
      } else if (e.type === 'zoneShrink') {
        this.hud.toast(e.phase === 0 ? 'A zona começou a fechar!' : 'A zona está fechando de novo!', '#c48cff');
        this.audio.play('horn', undefined, 0.4);
      } else if (e.type === 'matchEnd') {
        const m = this.sim.state.match;
        this.boardOpen = false;
        if (this.sim.royale) {
          // Último de pé: 4 s de comemoração com a câmera no vencedor; o placar vem depois.
          this.celebrate = CELEBRATE_TIME;
          this.celebrateId = m.winnerId;
          this.confettiTimer = 0;
          this.combat.hideBoard();
          const won = m.winnerId === this.localId;
          this.combat.showBanner(won ? 'VITÓRIA!' : `${this.sim.nameOf(m.winnerId ?? '')} venceu!`, won ? 'Você é o último de pé' : 'Último de pé', won);
          const winnerView = m.winnerId ? this.characterViews.get(m.winnerId) : undefined;
          if (winnerView) winnerView.cheer = true;
        } else {
          this.combat.showEnd(this.sim.state.characters, this.sim.teams ? { won: m.winner === this.localPlayer.team, reason: m.reason, seconds: m.elapsed } : undefined);
          this.finishMatchScreen();
        }
      }
    }
    if (this.pendingEvents.length) this.hud.setStats(this.stats.shots, this.stats.hits, this.stats.heads);
    this.pendingEvents = [];
  }

  /** Partida offline parada com o menu aberto. */
  private get paused(): boolean {
    return !this.online && !this.input.active && !this.sim.state.match.ended;
  }

  private render(alpha: number, frameDt: number): void {
    // Pausado (menu aberto): o fundo fica parado — poses congeladas e só 4 desenhos
    // por segundo (sobra GPU para o menu e para a prévia 3D dos personagens).
    if (this.paused) {
      this.pausedTimer -= frameDt;
      if (this.pausedTimer > 0) {
        this.input.consumeMouse();
        this.input.endFrame();
        return;
      }
      this.pausedTimer = 0.25;
      frameDt = 0;
      alpha = 1;
    } else {
      this.pausedTimer = 0;
    }
    // Mouse e pulo são lidos por quadro (resposta imediata); o pulo fica
    // guardado até o próximo tick da simulação.
    const m = this.input.consumeMouse();
    if (this.input.active) this.rig.look(m.dx, m.dy, this.settings.mouseSensitivity, this.settings.invertY);
    if (this.input.wasPressed('Space')) this.pendingJump = true;
    if (this.input.wasPressed('KeyE')) this.pendingAbility = true;
    if (this.input.wasPressed('KeyQ')) this.cycleBow();
    // Votação para desistir: 1 = sim, 2 = não.
    if (this.input.wasPressed('Digit1') || this.input.wasPressed('Numpad1')) this.vote(true);
    if (this.input.wasPressed('Digit2') || this.input.wasPressed('Numpad2')) this.vote(false);
    this.input.endFrame();
    const now = performance.now();
    this.receiveSnapshots(now);
    if (!this.sim.getCharacter(this.localId)) return; // ainda entrando na sala
    this.syncCharacterViews();
    this.handleEvents();

    // Online: os outros são interpolados entre os dois últimos snapshots.
    const remoteAlpha = this.online ? Math.min(1.15, (now - this.lastSnapTime) / this.snapInterval) : alpha;
    const s = this.sim.state;
    for (const c of s.characters) {
      const isRemote = this.online && c.id !== this.localId;
      const prev = (isRemote ? this.prevRemote.get(c.id) : this.prevCharacters.get(c.id)) ?? c.position;
      const k = isRemote ? remoteAlpha : alpha;
      this.tmpPos.set(lerp(prev.x, c.position.x, k), lerp(prev.y, c.position.y, k), lerp(prev.z, c.position.z, k));
      this.characterViews.get(c.id)!.update(c, this.tmpPos, frameDt);
    }
    for (const t of s.targets) this.targetViews.get(t.id)!.update(t, frameDt);
    for (const st of s.structures) {
      const view = this.structureViews.get(st.id);
      if (!view) continue;
      view.setPlayerInside(insideAttackArea(st, this.localPlayer.position));
      view.update(st, frameDt);
    }
    this.syncMobsAndLoot(remoteAlpha, frameDt);
    if (this.online) {
      // Fim de partida no servidor → placar; nova partida → limpa a tela.
      if (this.wasEnded && !s.match.ended) this.onNewOnlineMatch();
      this.wasEnded = s.match.ended;
    }
    this.effects.update(frameDt);
    this.tombstones.update(frameDt);
    this.animationSounds();
    this.audio.setListener(this.camera.position, this.rig.yaw);
    if (this.settings.volume !== this.lastVolume) {
      this.lastVolume = this.settings.volume;
      this.audio.setVolume(this.settings.volume);
    }
    if (this.settings.music !== this.lastMusic) {
      this.lastMusic = this.settings.music;
      this.audio.setMusicVolume(this.settings.music);
    }
    this.audio.update(frameDt);
    this.adaptResolution(frameDt);
    this.syncBow();
    if (this.online) this.arrows.update([...s.arrows, ...this.stuckArrows], this.prevRemoteArrows, remoteAlpha);
    else this.arrows.update(s.arrows, this.prevArrows, alpha);

    const player = this.localPlayer;
    this.hud.setBuffs(player.frenzy, player.haste);
    {
      const ab = getAbility(player.characterId);
      const frac = player.abilityCooldown / ab.cooldown;
      this.hud.setAbility(ab.name, cssColor(ab.color), player.abilityCooldown, frac, player.abilityActive);
      this.touch?.setAbility(ab.name.split(' ')[0], cssColor(ab.color), frac);
      this.combat.reveal = ab.kind === 'hawkeye' && player.abilityActive > 0;
    }
    this.hasteTrails(frameDt);
    const charge = drawCharge(player);
    this.zoom = damp(this.zoom, player.bow.drawing ? 0.6 : 0, 8, frameDt);
    // Câmera lenta que volta suave ao normal; zoom rápido para dentro e de volta.
    this.slowmo = Math.max(0, this.slowmo - frameDt);
    this.loop.timeScale = this.slowmo > 0 ? 0.25 + 0.75 * (1 - this.slowmo / SLOWMO_TIME) ** 2 : 1;
    this.killPunch = Math.max(0, this.killPunch - frameDt * 2.2);
    this.headshotTimer -= frameDt;
    this.stepCelebration(frameDt);
    // Câmera: o jogador (ou, eliminado no Último de pé, quem está sendo assistido).
    const playerView = this.characterViews.get(this.cameraTarget().id) ?? this.characterViews.get(this.localId)!;
    if (this.zoneView && s.match.zone) this.zoneView.update(s.match.zone, frameDt);
    this.rig.update(playerView.root.position, this.arena.collision, player.moveState === 'run', this.celebrate > 0 ? -1.2 : this.zoom + Math.sin(this.killPunch * Math.PI) * 0.6, player.bow.swayYaw, player.bow.swayPitch, frameDt);
    // Barras de vida/nomes: depois da câmera se mover neste quadro, na posição em que cada um é desenhado
    // (antes ficavam um quadro atrasadas e com a posição da simulação, "soltas" do personagem ao virar a mira).
    this.camera.updateMatrixWorld();
    this.combat.update(frameDt, player, s.characters, this.matchView(), this.lastKillerName, this.camera, s.mobs, (id) =>
      (this.characterViews.get(id) ?? this.mobViews.get(id))?.root.position);
    this.minimap.update(frameDt, this.sim, player, this.rig.yaw);
    this.sky.update(playerView.root.position, frameDt);
    this.grass.update(this.camera.position);

    // Mira: dispersão convertida de ângulo para pixels na tela.
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const spreadPx = (Math.tan(player.bow.spread) / Math.tan(halfFov)) * (window.innerHeight / 2);
    this.hud.updateCrosshair({
      drawing: player.bow.drawing,
      charge,
      spreadPx: 3 + spreadPx,
      onTarget: this.enemyUnderCrosshair(),
    });

    // Sombras: o mapa de sombras é redesenhado em quadros alternados (corta quase
    // metade das chamadas de desenho; as sombras andando ficam a 30 por segundo).
    // Salto grande da câmera (nascer, teleporte, trocar de modo): redesenha já.
    const jumped = this.camera.position.distanceToSquared(this.lastShadowCam) > 16;
    this.renderer.shadowMap.needsUpdate = this.shadowFrame % 2 === 0 || jumped;
    if (this.renderer.shadowMap.needsUpdate) this.lastShadowCam.copy(this.camera.position);
    this.shadowFrame++;
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
