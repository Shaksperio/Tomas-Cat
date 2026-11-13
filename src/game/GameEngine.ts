import * as THREE from 'three';
import {
  BossCheckpointData,
  BossHudInfo,
  CHAPTER_PHASES,
  EVOLUTION_STAGES,
  GamePhase,
  HudSnapshot,
  LoreLog,
  MAX_CAT_LEVEL,
  MAX_CHANCES,
  PromptInfo,
  RadarBlip,
  SavedGameState,
  WeatherState,
} from '../types/game';
import { gameAudio } from './audio';
import { ArticulatedCat } from './catModel';
import { PredatorActor } from './enemyModels';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { buildPostApocalypticWorld, BuiltWorld, WORLD_BOUNDS } from './worldBuilder';
import { SocietySimulation } from './society/simulation';
import { SocietyActors } from './society/SocietyActors';

const SAVE_KEY = 'felis09_save_v4';

// Pre-allocated math helpers (zero GC inside animation loop)
const _moveDir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _skyColor = new THREE.Color();
const _dayColor = new THREE.Color(0x5d83a8);
const _duskColor = new THREE.Color(0x3f263a);
const _nightColor = new THREE.Color(0x0b1220);
const _acidColor = new THREE.Color(0x162b22);
const _rainColor = new THREE.Color(0x526579);
const _snowColor = new THREE.Color(0x9aaec2);
const _stormColor = new THREE.Color(0x34465e);

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onToast: (message: string, tone: 'info' | 'success' | 'warn') => void;
  onLoreOpen: (lore: LoreLog) => void;
  onPlayerDown: (cause: string, snapshot: HudSnapshot) => void;
  onGameOver: (cause: string, snapshot: HudSnapshot) => void;
  onVictory: (snapshot: HudSnapshot) => void;
  onEvolutionUnlocked: (newStageIndex: number) => void;
}

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;
  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly textures: ProceduralTextureSet;
  private readonly world: BuiltWorld;
  private readonly cat: ArticulatedCat;
  private society = new SocietySimulation();
  private readonly societyActors: SocietyActors;
  private societyTickTimer = 0;
  private readonly contactShadow: THREE.Mesh;

  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly catTorch: THREE.PointLight;
  private readonly moonMesh: THREE.Mesh;
  private readonly moonLight: THREE.PointLight;
  private moonPowerActive = false;

  private readonly sonarRing: THREE.Mesh;
  private sonarWaveProgress = -1;
  private readonly evoParticles: THREE.Points;
  private evoBurstTimer = 0;
  private readonly rainPoints: THREE.Points;
  private readonly rainPositions: Float32Array;

  private frameId = 0;
  private lastTime = performance.now();
  private elapsed = 0;
  private hudSyncTimer = 0;
  private saveTimer = 0;
  private disposed = false;

  // Input & 3D Camera state
  private keys = new Set<string>();
  private virtualMove = { x: 0, y: 0 };
  private virtualSprint = false;
  private activePointers = new Map<number, { x: number; y: number }>();
  private pinchPrevDist = 0;
  private isDraggingCamera = false;
  private pointerDownType = 'mouse';
  private lastPointer = { x: 0, y: 0 };
  private pointerMovedDist = 0;
  private camYaw = 0;
  private camPitch = 0.22;
  private camDistance = 5.6;
  private targetCamDistance = 5.6;
  private camPresetIndex = 1;
  private cameraAutoFollowCooldown = 0;
  private lastShadowFollowX = 0;
  private lastShadowFollowZ = 0;

  // Player physics & state
  private catPos = new THREE.Vector3(0, 0, 8);
  private catVelY = 0;
  private catYaw = Math.PI;
  private currentSpeed = 0;
  private isGrounded = true;
  private isClimbing = false;
  private climbTargetTopY = 0;
  private coyoteTimer = 0;
  private jumpsUsed = 0;
  private peakFallSpeed = 0;

  // Survival, Progression & Combat state
  private phase: GamePhase = 'title';
  private stageIndex = 0;
  private level = 1;
  private stars = 0;
  private starProgress = 0;
  private chances = MAX_CHANCES;
  private spawnGraceTimer = 0;
  private bossCheckpoint: BossCheckpointData | null = null;
  private currentPhase = 1;
  private defeatedBosses = new Set<number>();
  private conqueredTerritories = new Set<string>();
  private announcedRivals = new Set<string>();
  private scrap = 0;
  private day = 1;
  private timeOfDay = 0.34;
  private weather: WeatherState = 'clear';
  private weatherTimer = 75;
  private health = 100;
  private hunger = 90;
  private thirst = 88;
  private warmth = 96;
  private stamina = 100;
  private sonarCooldown = 0;
  private sonarRevealTimer = 0;
  private attackCooldown = 0;
  private meowCooldown = 0;
  private moonPowerNoticeCooldown = 0;
  private isInsideShelter = false;
  private currentShelterId: string | null = null;
  private activeInteractableId: string | null = null;
  private discoveredTerminals = new Set<string>();
  private foodCollected = 0;
  private waterDrunk = 0;
  private sheltersUpgraded = 0;
  private enemiesDefeated = 0;
  private lastThreatCause = '';

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && window.devicePixelRatio <= 1.5,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Keep the city readable on mobile displays without flattening night lighting.
    this.renderer.toneMappingExposure = 1.48;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const isSmallScreen = width < 768;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isSmallScreen ? 1.35 : 1.6),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x162438);
    this.scene.fog = new THREE.FogExp2(0x162438, 0.0020);

    this.camera = new THREE.PerspectiveCamera(64, width / height, 0.15, 900);

    this.hemiLight = new THREE.HemisphereLight(0xc7ddf5, 0x35445a, 1.25);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.8);
    this.sunLight.position.set(28, 44, 22);
    this.sunLight.castShadow = !this.isSoftwareGl;
    const shadowSize = isSmallScreen ? 512 : 1024;
    this.sunLight.shadow.mapSize.width = shadowSize;
    this.sunLight.shadow.mapSize.height = shadowSize;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 140;
    const d = 44;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xf1f5ff });
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(5.8, 24, 16), moonMaterial);
    this.moonMesh.visible = false;
    this.scene.add(this.moonMesh);
    this.moonLight = new THREE.PointLight(0xc8dcff, 0, 140, 1.6);
    this.scene.add(this.moonLight);

    this.catTorch = new THREE.PointLight(0x22d3ee, 0.9, 12);
    this.catTorch.position.set(0, 1.4, 0);
    this.scene.add(this.catTorch);

    const maxAniso = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.textures = createProceduralTextures(maxAniso);
    this.world = buildPostApocalypticWorld(this.scene, this.textures);
    this.societyActors = new SocietyActors(this.scene);
    this.societyActors.update(0, this.society.snapshot(), false);

    this.cat = new ArticulatedCat();
    this.cat.root.position.copy(this.catPos);
    this.scene.add(this.cat.root);

    this.contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.5),
      new THREE.MeshBasicMaterial({
        map: this.textures.contactShadow,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      }),
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.set(0, 0.03, 0);
    this.scene.add(this.contactShadow);

    this.sonarRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.3, 40),
      new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.sonarRing.rotation.x = -Math.PI / 2;
    this.sonarRing.visible = false;
    this.scene.add(this.sonarRing);

    const pCount = 70;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 2;
      pPos[i * 3 + 1] = Math.random() * 2;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    this.evoParticles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0x22d3ee,
        size: 0.22,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.evoParticles.visible = false;
    this.scene.add(this.evoParticles);

    const rainCount = 260;
    this.rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 44;
      this.rainPositions[i * 3 + 1] = Math.random() * 18;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainPoints = new THREE.Points(
      rainGeo,
      new THREE.PointsMaterial({
        color: 0xa3e635,
        size: 0.14,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    this.bindEvents();
    this.syncHud();
    this.scheduleNextFrame();
  }

  public static hasSavedGame(): boolean {
    try {
      return Boolean(localStorage.getItem(SAVE_KEY));
    } catch {
      return false;
    }
  }

  public static clearSavedGame(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
  }

  private getStarNext(): number {
    return 55 + this.level * 2;
  }

  private getEffectiveMaxHealth(): number {
    return EVOLUTION_STAGES[this.stageIndex].maxHealth + (this.level - 1) * 3;
  }

  private getEffectiveMaxStamina(): number {
    return EVOLUTION_STAGES[this.stageIndex].maxStamina + (this.level - 1) * 2;
  }

  private getCurrentAttackDamage(): number {
    const baseDamage =
      EVOLUTION_STAGES[this.stageIndex].attackDamage +
      (this.level - 1) * 1.4 +
      (this.level >= MAX_CAT_LEVEL ? 25 : 0);
    return Math.round(baseDamage * (this.moonPowerActive ? 1.65 : 1));
  }

  private getRankTitle(): string {
    if (this.level >= MAX_CAT_LEVEL) return 'Gato Líder & Alpha';
    if (this.level >= 65) return 'Guardião Apex';
    if (this.level >= 35) return 'Predador Cibernético';
    if (this.level >= 15) return 'Desafiante dos Telhados';
    return 'Sobrevivente Errante';
  }

  public startNewGame(): void {
    gameAudio.init();
    GameEngine.clearSavedGame();
    this.stageIndex = 0;
    this.level = 1;
    this.stars = 0;
    this.starProgress = 0;
    this.chances = MAX_CHANCES;
    this.spawnGraceTimer = 0;
    this.bossCheckpoint = null;
    this.currentPhase = 1;
    this.defeatedBosses.clear();
    this.conqueredTerritories.clear();
    this.announcedRivals.clear();
    this.scrap = 0;
    this.day = 1;
    this.timeOfDay = 0.34;
    this.weather = 'clear';
    this.weatherTimer = 80;
    const base = EVOLUTION_STAGES[0];
    this.health = base.maxHealth;
    this.hunger = 92;
    this.thirst = 90;
    this.warmth = 96;
    this.stamina = base.maxStamina;
    this.catPos.set(0, 0, 8);
    this.catVelY = 0;
    this.catYaw = Math.PI;
    this.camYaw = 0;
    this.camPitch = 0.22;
    this.camDistance = 5.6;
    this.targetCamDistance = 5.6;
    this.camPresetIndex = 1;
    this.isClimbing = false;
    this.discoveredTerminals.clear();
    this.foodCollected = 0;
    this.waterDrunk = 0;
    this.sheltersUpgraded = 0;
    this.enemiesDefeated = 0;
    this.lastThreatCause = '';
    this.society = new SocietySimulation();
    this.societyTickTimer = 0;

    this.world.interactables.forEach((item) => {
      item.active = true;
      item.mesh.visible = true;
      item.respawnTimer = 0;
      if (item.kind === 'shelter') {
        item.shelterLevel = 1;
        this.applyShelterVisual(item);
      }
    });

    this.world.predators.forEach((p) => {
      p.alive = true;
      p.conquered = false;
      p.hp = p.maxHp;
      p.respawnTimer = 0;
      p.stunTimer = 0;
      p.distractTimer = 0;
      p.group.visible = true;
      p.group.position.copy(p.homePos);
      if (p.territoryBeacon) {
        const mat = p.territoryBeacon.material as THREE.MeshStandardMaterial;
        mat.color.setHex(0xf59e0b);
        mat.emissive.setHex(0xd97706);
      }
    });

    this.syncPhaseGates();
    this.cat.applyEvolutionStage(0, true, false);
    this.phase = 'playing';
    this.syncHud();
    this.callbacks.onToast('Fase 1: Explore a cidade aberta, escale prédios e dispute telhados!', 'info');
  }

  public reviveAtDeathSpot(): void {
    if (this.chances <= 0) {
      if (this.bossCheckpoint) this.continueFromBossCheckpoint();
      else this.startNewGame();
      return;
    }
    const def = EVOLUTION_STAGES[this.stageIndex];
    this.health = this.getEffectiveMaxHealth();
    this.stamina = this.getEffectiveMaxStamina();
    this.warmth = def.maxWarmth;
    this.hunger = Math.max(this.hunger, def.maxHunger * 0.6);
    this.thirst = Math.max(this.thirst, def.maxThirst * 0.6);
    this.catVelY = 0;
    this.isClimbing = false;
    this.spawnGraceTimer = 3.5;

    // Gentle push back on nearby predators so they don't instantly hit on revive
    for (const pred of this.world.predators) {
      if (!pred.alive) continue;
      const dx = pred.group.position.x - this.catPos.x;
      const dz = pred.group.position.z - this.catPos.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.5 && d > 0.01) {
        let nx = pred.group.position.x + (dx / d) * 3.5;
        let nz = pred.group.position.z + (dz / d) * 3.5;
        if (pred.rooftopBounds) {
          nx = THREE.MathUtils.clamp(nx, pred.rooftopBounds.minX + 0.5, pred.rooftopBounds.maxX - 0.5);
          nz = THREE.MathUtils.clamp(nz, pred.rooftopBounds.minZ + 0.5, pred.rooftopBounds.maxZ - 0.5);
        }
        pred.group.position.x = nx;
        pred.group.position.z = nz;
        pred.stunTimer = 2.0;
      }
    }

    this.phase = 'playing';
    this.lastTime = performance.now();
    this.saveGame();
    this.syncHud();
    this.callbacks.onToast(
      `Reviveu no mesmo local! Restam ${this.chances}/${MAX_CHANCES} chances.`,
      'info',
    );
  }

  public continueFromBossCheckpoint(): void {
    const cp = this.bossCheckpoint;
    if (!cp) {
      this.startNewGame();
      return;
    }
    this.level = Math.max(1, Math.min(MAX_CAT_LEVEL, cp.level));
    this.stars = cp.stars;
    this.starProgress = cp.starProgress;
    this.stageIndex = Math.max(0, Math.min(EVOLUTION_STAGES.length - 1, cp.stageIndex));
    this.chances = MAX_CHANCES;
    this.spawnGraceTimer = 3.0;
    this.currentPhase = cp.currentPhase;
    this.defeatedBosses = new Set(cp.defeatedBosses);
    this.conqueredTerritories = new Set(cp.conqueredTerritories);
    this.announcedRivals = new Set(cp.conqueredTerritories);
    this.scrap = cp.scrap;
    this.day = cp.day;
    this.timeOfDay = cp.timeOfDay;
    this.weather = 'clear';
    this.weatherTimer = 75;

    const def = EVOLUTION_STAGES[this.stageIndex];
    this.health = this.getEffectiveMaxHealth();
    this.hunger = def.maxHunger;
    this.thirst = def.maxThirst;
    this.warmth = def.maxWarmth;
    this.stamina = this.getEffectiveMaxStamina();
    this.catPos.set(cp.catX, 0, cp.catZ);
    this.catVelY = 0;
    this.isClimbing = false;
    this.discoveredTerminals = new Set(cp.discoveredTerminals);
    this.foodCollected = cp.foodCollected;
    this.waterDrunk = cp.waterDrunk;
    this.sheltersUpgraded = cp.sheltersUpgraded;
    this.enemiesDefeated = cp.enemiesDefeated;
    this.lastThreatCause = '';

    this.world.interactables.forEach((item) => {
      item.active = true;
      item.mesh.visible = true;
      if (item.kind === 'shelter' && cp.shelterLevels[item.id]) {
        item.shelterLevel = cp.shelterLevels[item.id];
        this.applyShelterVisual(item);
      }
    });

    this.world.predators.forEach((p) => {
      p.stunTimer = 0;
      p.distractTimer = 0;
      p.hp = p.maxHp;
      if (p.isBoss && this.defeatedBosses.has(p.phaseIndex)) {
        p.alive = false;
        p.group.visible = false;
      } else if (p.isTerritoryRival && this.conqueredTerritories.has(p.id)) {
        p.alive = false;
        p.conquered = true;
        p.group.visible = false;
        if (p.territoryBeacon) {
          const mat = p.territoryBeacon.material as THREE.MeshStandardMaterial;
          mat.color.setHex(0x22d3ee);
          mat.emissive.setHex(0x06b6d4);
        }
      } else {
        p.alive = true;
        p.conquered = false;
        p.group.visible = true;
        p.group.position.copy(p.homePos);
      }
    });

    this.syncPhaseGates();
    this.cat.applyEvolutionStage(this.stageIndex, true, this.level >= MAX_CAT_LEVEL);
    this.phase = 'playing';
    this.lastTime = performance.now();
    this.saveGame();
    this.syncHud();
    this.callbacks.onToast(
      `Retomando do Checkpoint (Fase ${this.currentPhase}) com ${MAX_CHANCES} chances!`,
      'success',
    );
  }

  private recordBossCheckpoint(): void {
    const shelterLevels: Record<string, number> = {};
    this.world.interactables.forEach((item) => {
      if (item.kind === 'shelter') shelterLevels[item.id] = item.shelterLevel || 1;
    });
    this.bossCheckpoint = {
      stageIndex: this.stageIndex,
      level: this.level,
      stars: this.stars,
      starProgress: this.starProgress,
      scrap: this.scrap,
      day: this.day,
      timeOfDay: this.timeOfDay,
      currentPhase: this.currentPhase,
      defeatedBosses: Array.from(this.defeatedBosses),
      conqueredTerritories: Array.from(this.conqueredTerritories),
      catX: this.catPos.x,
      catZ: this.catPos.z,
      discoveredTerminals: Array.from(this.discoveredTerminals),
      shelterLevels,
      foodCollected: this.foodCollected,
      waterDrunk: this.waterDrunk,
      sheltersUpgraded: this.sheltersUpgraded,
      enemiesDefeated: this.enemiesDefeated,
    };
  }

  public continueSavedGame(): void {
    gameAudio.init();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        this.startNewGame();
        return;
      }
      const saved: SavedGameState = JSON.parse(raw);
      this.level = Math.max(1, Math.min(MAX_CAT_LEVEL, saved.level || 1));
      this.stars = saved.stars || 0;
      this.starProgress = saved.starProgress || 0;
      this.chances = typeof saved.chances === 'number' ? saved.chances : MAX_CHANCES;
      this.bossCheckpoint = saved.bossCheckpoint ?? null;
      this.stageIndex = Math.max(0, Math.min(EVOLUTION_STAGES.length - 1, saved.stageIndex || 0));
      const def = EVOLUTION_STAGES[this.stageIndex];
      this.currentPhase = saved.currentPhase || 1;
      this.defeatedBosses = new Set(saved.defeatedBosses || []);
      this.conqueredTerritories = new Set(saved.conqueredTerritories || []);
      this.announcedRivals = new Set(saved.conqueredTerritories || []);
      this.scrap = saved.scrap || 0;
      this.day = saved.day || 1;
      this.timeOfDay = saved.timeOfDay ?? 0.34;
      this.health = Math.min(this.getEffectiveMaxHealth(), Math.max(25, saved.health || def.maxHealth));
      this.hunger = Math.min(def.maxHunger, saved.hunger ?? def.maxHunger);
      this.thirst = Math.min(def.maxThirst, saved.thirst ?? def.maxThirst);
      this.warmth = Math.min(def.maxWarmth, saved.warmth ?? def.maxWarmth);
      this.stamina = this.getEffectiveMaxStamina();
      this.catPos.set(saved.catX || 0, saved.catY || 0, saved.catZ || 8);
      this.catVelY = 0;
      this.isClimbing = false;
      this.discoveredTerminals = new Set(saved.discoveredTerminals || []);
      this.foodCollected = saved.foodCollected || 0;
      this.waterDrunk = saved.waterDrunk || 0;
      this.sheltersUpgraded = saved.sheltersUpgraded || 0;
      this.enemiesDefeated = saved.enemiesDefeated || 0;

      if (saved.shelterLevels) {
        this.world.interactables.forEach((item) => {
          if (item.kind === 'shelter' && saved.shelterLevels[item.id]) {
            item.shelterLevel = saved.shelterLevels[item.id];
            this.applyShelterVisual(item);
          }
        });
      }

      this.world.predators.forEach((p) => {
        if (p.isBoss && this.defeatedBosses.has(p.phaseIndex)) {
          p.alive = false;
          p.group.visible = false;
        }
        if (p.isTerritoryRival && this.conqueredTerritories.has(p.id)) {
          p.alive = false;
          p.conquered = true;
          p.group.visible = false;
          if (p.territoryBeacon) {
            const mat = p.territoryBeacon.material as THREE.MeshStandardMaterial;
            mat.color.setHex(0x22d3ee);
            mat.emissive.setHex(0x06b6d4);
          }
        }
      });

      // If previous session died at 0 chances, restore from checkpoint or fresh
      if (this.chances <= 0) {
        if (this.bossCheckpoint) {
          this.continueFromBossCheckpoint();
          return;
        }
        this.startNewGame();
        return;
      }

      this.syncPhaseGates();
      this.cat.applyEvolutionStage(this.stageIndex, true, this.level >= MAX_CAT_LEVEL);
      this.phase = 'playing';
      this.syncHud();
      this.callbacks.onToast(
        `Progresso carregado — Nível ${this.level} · ${this.chances}/${MAX_CHANCES} chances`,
        'info',
      );
    } catch {
      this.startNewGame();
    }
  }

  private syncPhaseGates(): void {
    for (const gate of this.world.phaseGates) {
      const open = this.defeatedBosses.has(gate.phaseRequired);
      gate.unlocked = open;
      gate.mesh.visible = !open;
      gate.collider.isBarrier = !open;
      gate.collider.topY = open ? -1 : 9;
    }
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (phase === 'playing') {
      this.lastTime = performance.now();
    }
  }

  public setVirtualInput(moveX: number, moveY: number, sprint: boolean): void {
    this.virtualMove.x = moveX;
    this.virtualMove.y = moveY;
    this.virtualSprint = sprint;
  }

  public adjustZoom(delta: number): void {
    this.targetCamDistance = THREE.MathUtils.clamp(this.targetCamDistance + delta, 2.6, 22.0);
  }

  public cycleCameraPreset(): void {
    const presets: { label: string; dist: number; pitch: number }[] = [
      { label: 'Ação Próxima', dist: 3.6, pitch: 0.14 },
      { label: 'Terceira Pessoa 3D', dist: 5.8, pitch: 0.24 },
      { label: 'Mundo Aberto Ampla', dist: 11.5, pitch: 0.44 },
      { label: 'Visão Panorâmica', dist: 19.0, pitch: 0.72 },
    ];
    this.camPresetIndex = (this.camPresetIndex + 1) % presets.length;
    const p = presets[this.camPresetIndex];
    this.targetCamDistance = p.dist;
    this.camPitch = p.pitch;
    this.callbacks.onToast(`Câmera: ${p.label}`, 'info');
  }

  public resetCameraBehindCat(): void {
    this.camYaw = this.catYaw + Math.PI;
    this.camPitch = 0.24;
    this.targetCamDistance = 5.8;
    this.cameraAutoFollowCooldown = 0;
  }

  public triggerJump(): void {
    if (this.phase !== 'playing') return;
    if (this.isClimbing) {
      // Wall jump upward/away
      this.isClimbing = false;
      this.catVelY = EVOLUTION_STAGES[this.stageIndex].jumpForce * 0.85 * (this.moonPowerActive ? 1.22 : 1);
      gameAudio.playJump(false);
      return;
    }
    const def = EVOLUTION_STAGES[this.stageIndex];
    if (this.isGrounded || this.coyoteTimer > 0) {
      this.catVelY = def.jumpForce * (this.moonPowerActive ? 1.22 : 1);
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpsUsed = 1;
      gameAudio.playJump(false);
    } else if (def.canDoubleJump && this.jumpsUsed < 2 && this.stamina >= 15) {
      this.catVelY = def.jumpForce * 0.92 * (this.moonPowerActive ? 1.22 : 1);
      this.jumpsUsed = 2;
      this.stamina = Math.max(0, this.stamina - 15);
      gameAudio.playJump(true);
    }
  }

  public triggerClawAttack(): void {
    if (this.phase !== 'playing' || this.attackCooldown > 0) return;
    const def = EVOLUTION_STAGES[this.stageIndex];
    const dmg = this.getCurrentAttackDamage();
    this.attackCooldown = 0.38;
    this.cat.triggerAction('claw');
    gameAudio.playClawSlash();

    // Small forward pounce lunge
    const fx = Math.sin(this.catYaw);
    const fz = Math.cos(this.catYaw);
    const lungeX = THREE.MathUtils.clamp(this.catPos.x + fx * 0.65, -WORLD_BOUNDS, WORLD_BOUNDS);
    const lungeZ = THREE.MathUtils.clamp(this.catPos.z + fz * 0.65, -WORLD_BOUNDS, WORLD_BOUNDS);
    if (!this.checkHorizontalCollision(lungeX, lungeZ, 0.38 * def.scale)) {
      this.catPos.x = lungeX;
      this.catPos.z = lungeZ;
    }

    const hitRange = 3.2 * def.scale;
    let hits = 0;

    for (const pred of this.world.predators) {
      if (!pred.alive) continue;
      const dx = pred.group.position.x - this.catPos.x;
      const dz = pred.group.position.z - this.catPos.z;
      const dist = Math.hypot(dx, dz);
      const dy = Math.abs(pred.group.position.y - this.catPos.y);
      if (pred.isFriendly) continue;
      if (dist <= hitRange && dy < 2.4) {
        hits++;
        pred.hp -= dmg;
        pred.hitFlashTimer = 0.2;
        pred.stunTimer = 0.35;
        // Knockback away from cat (respect rooftop bounds for rival cats!)
        if (dist > 0.01) {
          const kb = pred.isBoss ? 0.65 : pred.isTerritoryRival ? 0.9 : 1.35;
          let nextX = pred.group.position.x + (dx / dist) * kb;
          let nextZ = pred.group.position.z + (dz / dist) * kb;
          if (pred.rooftopBounds) {
            nextX = THREE.MathUtils.clamp(nextX, pred.rooftopBounds.minX + 0.5, pred.rooftopBounds.maxX - 0.5);
            nextZ = THREE.MathUtils.clamp(nextZ, pred.rooftopBounds.minZ + 0.5, pred.rooftopBounds.maxZ - 0.5);
          }
          pred.group.position.x = nextX;
          pred.group.position.z = nextZ;
        }

        if (pred.hp <= 0) {
          this.handlePredatorDefeated(pred);
        }
      }
    }

    if (hits > 0) {
      gameAudio.playEnemyHit();
    }
  }

  public triggerMeow(): void {
    if (this.phase !== 'playing' || this.meowCooldown > 0) return;
    this.meowCooldown = 1.8;
    this.cat.triggerAction('meow');
    gameAudio.playMeow();

    // Distracts smaller non-boss predators nearby & boosts stealth escape
    let distracted = 0;
    for (const pred of this.world.predators) {
      if (!pred.alive || pred.isBoss) continue;
      const dist = Math.hypot(
        pred.group.position.x - this.catPos.x,
        pred.group.position.z - this.catPos.z,
      );
      if (dist <= 14) {
        pred.distractTimer = 2.8;
        distracted++;
      }
    }

    if (distracted > 0) {
      this.callbacks.onToast(`Miado distraiu ${distracted} predador(es) próximo(s)!`, 'info');
    }
  }

  private handlePredatorDefeated(pred: PredatorActor): void {
    pred.alive = false;
    pred.hp = 0;
    pred.group.visible = false;
    this.enemiesDefeated++;
    this.scrap += pred.scrapReward;

    if (pred.isTerritoryRival) {
      pred.conquered = true;
      this.conqueredTerritories.add(pred.id);
      if (pred.territoryBeacon) {
        const mat = pred.territoryBeacon.material as THREE.MeshStandardMaterial;
        mat.color.setHex(0x22d3ee);
        mat.emissive.setHex(0x06b6d4);
      }
      const rewardStars = pred.starReward || 6;
      this.awardStars(rewardStars);
      this.gainXp(pred.xpReward);
      this.hunger = Math.min(EVOLUTION_STAGES[this.stageIndex].maxHunger, this.hunger + 20);
      this.thirst = Math.min(EVOLUTION_STAGES[this.stageIndex].maxThirst, this.thirst + 15);
      gameAudio.playEvolution();
      this.callbacks.onToast(
        `Telhado conquistado! +${rewardStars} Estrelas e Status aumentados! (Nível ${this.level})`,
        'success',
      );
    } else if (pred.isBoss) {
      this.defeatedBosses.add(pred.phaseIndex);
      this.syncPhaseGates();
      this.awardStars(5);
      this.gainXp(pred.xpReward);
      gameAudio.playEvolution();

      if (pred.phaseIndex < CHAPTER_PHASES.length) {
        this.currentPhase = Math.max(this.currentPhase, pred.phaseIndex + 1);
        this.recordBossCheckpoint();
        const nextPhase = CHAPTER_PHASES[this.currentPhase - 1];
        this.callbacks.onToast(
          `${pred.name} derrotado! Checkpoint gravado na ${nextPhase.title}!`,
          'success',
        );
      } else {
        this.recordBossCheckpoint();
        this.saveGame();
        this.phase = 'victory';
        this.callbacks.onVictory(this.buildSnapshot());
        return;
      }
    } else {
      pred.respawnTimer = 42;
      this.gainXp(pred.xpReward);
      this.hunger = Math.min(EVOLUTION_STAGES[this.stageIndex].maxHunger, this.hunger + 16);
      this.callbacks.onToast(
        `${pred.name} abatido! +${pred.xpReward} XP · +${pred.scrapReward} Sucata`,
        'success',
      );
    }
    this.saveGame();
  }

  public triggerSonar(): void {
    if (this.phase !== 'playing' || this.sonarCooldown > 0) return;
    const def = EVOLUTION_STAGES[this.stageIndex];
    this.sonarCooldown = 7.0;
    this.sonarRevealTimer = 8.0;
    this.sonarWaveProgress = 0;
    this.sonarRing.visible = true;
    this.sonarRing.position.set(this.catPos.x, this.catPos.y + 0.12, this.catPos.z);
    gameAudio.playSonar();

    if (def.canEmpPulse) {
      let stunned = 0;
      this.world.predators.forEach((p) => {
        if (!p.alive) return;
        const dist = Math.hypot(p.group.position.x - this.catPos.x, p.group.position.z - this.catPos.z);
        if (dist <= 16) {
          p.stunTimer = 3.5;
          stunned++;
        }
      });
      if (stunned > 0) {
        this.callbacks.onToast(`Pulso de Choque atordoou ${stunned} inimigo(s)!`, 'success');
      }
    }
    this.syncHud();
  }

  public triggerInteract(): void {
    if (this.phase !== 'playing' || !this.activeInteractableId) return;
    const item = this.world.interactables.find((i) => i.id === this.activeInteractableId);
    if (!item || !item.active) return;

    const def = EVOLUTION_STAGES[this.stageIndex];
    const maxHp = this.getEffectiveMaxHealth();
    const maxStam = this.getEffectiveMaxStamina();

    if (item.kind === 'food' || item.kind === 'prey') {
      this.hunger = Math.min(def.maxHunger, this.hunger + item.amount);
      this.health = Math.min(maxHp, this.health + 12);
      this.gainXp(item.xpGain);
      this.foodCollected++;
      item.active = false;
      item.mesh.visible = false;
      item.respawnTimer = item.maxRespawn;
      this.cat.triggerAction('eat');
      gameAudio.playEat();
      this.callbacks.onToast(`+${item.amount} Fome (${item.name})`, 'success');
    } else if (item.kind === 'water') {
      this.thirst = Math.min(def.maxThirst, this.thirst + item.amount);
      this.stamina = Math.min(maxStam, this.stamina + 25);
      this.gainXp(item.xpGain);
      this.waterDrunk++;
      item.active = false;
      item.mesh.visible = false;
      item.respawnTimer = item.maxRespawn;
      this.cat.triggerAction('drink');
      gameAudio.playDrink();
      this.callbacks.onToast(`+${item.amount} Sede (${item.name})`, 'success');
    } else if (item.kind === 'scrap') {
      this.scrap += item.amount;
      this.gainXp(item.xpGain);
      item.active = false;
      item.mesh.visible = false;
      item.respawnTimer = item.maxRespawn;
      this.cat.triggerAction('pounce');
      gameAudio.playCollectScrap();
      this.callbacks.onToast('+1 Sucata Tecnológica coletada', 'info');
    } else if (item.kind === 'shelter') {
      const lvl = item.shelterLevel || 1;
      this.warmth = def.maxWarmth;
      this.health = Math.min(maxHp, this.health + 35 * lvl);
      this.stamina = maxStam;
      this.gainXp(18);
      gameAudio.playMeow();
      if (this.timeOfDay > 0.72 || this.timeOfDay < 0.22) {
        this.timeOfDay = 0.28;
        this.day += 1;
        this.weather = 'clear';
        this.weatherTimer = 75;
        this.callbacks.onToast(`Descansou no ${item.name}. Amanheceu o Dia ${this.day}!`, 'success');
      } else {
        this.callbacks.onToast(`Saúde e energia restauradas no ${item.name}.`, 'success');
      }
      this.saveGame();
    } else if (item.kind === 'terminal' && item.lore) {
      if (!this.discoveredTerminals.has(item.id)) {
        this.discoveredTerminals.add(item.id);
        this.gainXp(item.xpGain);
        gameAudio.playSonar();
      }
      this.callbacks.onLoreOpen(item.lore);
    }

    this.syncHud();
  }

  public triggerShelterUpgrade(): void {
    if (this.phase !== 'playing' || !this.currentShelterId) return;
    const shelter = this.world.interactables.find((i) => i.id === this.currentShelterId);
    if (!shelter || shelter.kind !== 'shelter') return;

    const currentLevel = shelter.shelterLevel || 1;
    if (currentLevel >= 3) {
      this.callbacks.onToast('Este abrigo já está no nível máximo.', 'info');
      return;
    }
    const cost = currentLevel * 2;
    if (this.scrap < cost) {
      this.callbacks.onToast(`Precisa de ${cost} sucatas para melhorar este abrigo.`, 'warn');
      return;
    }

    this.scrap -= cost;
    shelter.shelterLevel = currentLevel + 1;
    this.sheltersUpgraded++;
    this.applyShelterVisual(shelter);
    this.awardStars(2);
    gameAudio.playEvolution();
    this.callbacks.onToast(`Abrigo Nível ${shelter.shelterLevel}! +2 Estrelas ganhas!`, 'success');
    this.saveGame();
    this.syncHud();
  }

  private applyStageFromLevel(showModal: boolean): void {
    let targetStage = 0;
    for (let i = 0; i < EVOLUTION_STAGES.length; i++) {
      if (this.level >= EVOLUTION_STAGES[i].minCatLevel) {
        targetStage = i;
      }
    }

    const stageChanged = targetStage > this.stageIndex;
    const isAlpha = this.level >= MAX_CAT_LEVEL;

    if (stageChanged || isAlpha) {
      this.stageIndex = targetStage;
      const nextDef = EVOLUTION_STAGES[this.stageIndex];
      this.health = this.getEffectiveMaxHealth();
      this.hunger = Math.max(this.hunger, nextDef.maxHunger * 0.85);
      this.thirst = Math.max(this.thirst, nextDef.maxThirst * 0.85);
      this.warmth = nextDef.maxWarmth;
      this.stamina = this.getEffectiveMaxStamina();

      this.cat.applyEvolutionStage(this.stageIndex, false, isAlpha);
      this.evoBurstTimer = 1.6;
      this.evoParticles.visible = true;
      this.evoParticles.position.copy(this.catPos);
      (this.evoParticles.material as THREE.PointsMaterial).color.setHex(
        isAlpha ? 0xfbbf24 : nextDef.accentColor,
      );
      gameAudio.playEvolution();

      if (showModal && stageChanged) {
        this.callbacks.onEvolutionUnlocked(this.stageIndex);
      }
    }
  }

  private awardStars(starCount: number): void {
    if (starCount <= 0) return;
    this.stars += starCount;
    const prevLevel = this.level;
    this.level = Math.min(MAX_CAT_LEVEL, this.level + starCount);

    // Status boost from winning Stars
    this.health = Math.min(this.getEffectiveMaxHealth(), this.health + starCount * 4);
    this.stamina = this.getEffectiveMaxStamina();

    if (this.level > prevLevel) {
      this.applyStageFromLevel(true);
      if (this.level >= MAX_CAT_LEVEL && prevLevel < MAX_CAT_LEVEL) {
        this.callbacks.onToast(
          'NÍVEL 99 ALCANÇADO! Você se tornou o Gato Líder & Alpha!',
          'success',
        );
      }
    }
  }

  private applyShelterVisual(shelter: {
    shelterLevel?: number;
    shelterDome?: THREE.Mesh;
    shelterLight?: THREE.PointLight;
  }): void {
    const lvl = shelter.shelterLevel || 1;
    if (!shelter.shelterDome) return;
    const mat = shelter.shelterDome.material as THREE.MeshStandardMaterial;
    if (lvl === 1) {
      shelter.shelterDome.scale.set(1, 0.85, 1);
      mat.color.setHex(0x334155);
      if (shelter.shelterLight) shelter.shelterLight.color.setHex(0xf59e0b);
    } else if (lvl === 2) {
      shelter.shelterDome.scale.set(1.25, 1.05, 1.25);
      mat.color.setHex(0x0e7490);
      if (shelter.shelterLight) shelter.shelterLight.color.setHex(0x22d3ee);
    } else {
      shelter.shelterDome.scale.set(1.5, 1.25, 1.5);
      mat.color.setHex(0x065f46);
      if (shelter.shelterLight) shelter.shelterLight.color.setHex(0x10b981);
    }
  }

  private gainXp(amount: number): void {
    if (this.level >= MAX_CAT_LEVEL) {
      this.starProgress = this.getStarNext();
      return;
    }
    this.starProgress += amount;
    let earnedStars = 0;
    while (this.starProgress >= this.getStarNext() && this.level + earnedStars < MAX_CAT_LEVEL) {
      this.starProgress -= this.getStarNext();
      earnedStars++;
    }
    if (this.level + earnedStars >= MAX_CAT_LEVEL) {
      this.starProgress = this.getStarNext();
    }
    if (earnedStars > 0) {
      this.awardStars(earnedStars);
      this.callbacks.onToast(`+${earnedStars} Estrela! Nível ${this.level} alcançado!`, 'success');
    }
  }

  private saveGame(): void {
    try {
      const shelterLevels: Record<string, number> = {};
      this.world.interactables.forEach((item) => {
        if (item.kind === 'shelter') shelterLevels[item.id] = item.shelterLevel || 1;
      });
      const payload: SavedGameState = {
        stageIndex: this.stageIndex,
        level: this.level,
        stars: this.stars,
        starProgress: this.starProgress,
        chances: this.chances,
        scrap: this.scrap,
        day: this.day,
        timeOfDay: this.timeOfDay,
        currentPhase: this.currentPhase,
        defeatedBosses: Array.from(this.defeatedBosses),
        conqueredTerritories: Array.from(this.conqueredTerritories),
        health: this.health,
        hunger: this.hunger,
        thirst: this.thirst,
        warmth: this.warmth,
        catX: this.catPos.x,
        catY: this.catPos.y,
        catZ: this.catPos.z,
        discoveredTerminals: Array.from(this.discoveredTerminals),
        shelterLevels,
        foodCollected: this.foodCollected,
        waterDrunk: this.waterDrunk,
        sheltersUpgraded: this.sheltersUpgraded,
        enemiesDefeated: this.enemiesDefeated,
        bossCheckpoint: this.bossCheckpoint,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    dom.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    this.keys.add(code);

    if (this.phase === 'playing') {
      if (code === 'Space') {
        e.preventDefault();
        this.triggerJump();
      } else if (code === 'KeyE') {
        this.triggerInteract();
      } else if (code === 'KeyF') {
        this.triggerSonar();
      } else if (code === 'KeyU') {
        this.triggerShelterUpgrade();
      } else if (code === 'KeyJ' || code === 'KeyC') {
        this.triggerClawAttack();
      } else if (code === 'KeyV') {
        this.triggerMeow();
      } else if (code === 'Equal' || code === 'NumpadAdd' || code === 'KeyZ') {
        this.adjustZoom(-2.0);
      } else if (code === 'Minus' || code === 'NumpadSubtract' || code === 'KeyQ') {
        this.adjustZoom(2.0);
      } else if (code === 'KeyR') {
        this.cycleCameraPreset();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    gameAudio.init();
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.pointerDownType = e.pointerType;

    if (this.activePointers.size === 1) {
      this.isDraggingCamera = true;
      this.lastPointer.x = e.clientX;
      this.lastPointer.y = e.clientY;
      this.pointerMovedDist = 0;
      this.pinchPrevDist = 0;
    } else if (this.activePointers.size === 2) {
      this.isDraggingCamera = false;
      const pts = Array.from(this.activePointers.values());
      this.pinchPrevDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.phase !== 'playing') return;

    if (this.activePointers.size >= 2) {
      const pts = Array.from(this.activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (this.pinchPrevDist > 0) {
        const delta = this.pinchPrevDist - dist;
        this.adjustZoom(delta * 0.045);
      }
      this.pinchPrevDist = dist;
      return;
    }

    if (!this.isDraggingCamera) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.pointerMovedDist += Math.hypot(dx, dy);
    this.lastPointer.x = e.clientX;
    this.lastPointer.y = e.clientY;

    this.camYaw -= dx * 0.0065;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.005, -0.04, 1.12);
    this.cameraAutoFollowCooldown = 1.8;
  };

  private onPointerUp = (e: PointerEvent): void => {
    const hadSingle = this.activePointers.size === 1 && this.isDraggingCamera;
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) {
      this.pinchPrevDist = 0;
    }
    if (this.activePointers.size === 1) {
      const remaining = Array.from(this.activePointers.values())[0];
      this.lastPointer.x = remaining.x;
      this.lastPointer.y = remaining.y;
    }
    if (
      hadSingle &&
      this.pointerDownType === 'mouse' &&
      this.phase === 'playing' &&
      this.pointerMovedDist < 6
    ) {
      this.triggerClawAttack();
    }
    if (this.activePointers.size === 0) {
      this.isDraggingCamera = false;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    this.adjustZoom(e.deltaY * 0.009);
  };

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.elapsed += dt;

    if (this.phase === 'title') {
      const orbitAngle = this.elapsed * 0.18;
      this.camera.position.set(
        this.catPos.x + Math.sin(orbitAngle) * 7.6,
        this.catPos.y + 3.0,
        this.catPos.z + Math.cos(orbitAngle) * 7.6,
      );
      this.camera.lookAt(this.catPos.x, this.catPos.y + 0.85, this.catPos.z);
      this.cat.update(dt, 0, true, false, false, false, 0, this.elapsed);
      this.updateEnvironmentLighting(dt);
    } else if (this.phase === 'playing') {
      this.updateGameplay(dt);
      this.societyTickTimer += dt;
      while (this.societyTickTimer >= 1) {
        this.society.step(1);
        this.societyTickTimer -= 1;
      }
      this.societyActors.update(dt, this.society.snapshot(), true);
    } else {
      this.societyActors.update(dt, this.society.snapshot(), false);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private checkHorizontalCollision(x: number, z: number, catRadius: number): boolean {
    for (const box of this.world.colliders) {
      if (box.topY < 0) continue; // Unlocked gate
      const minY = box.minY ?? 0;
      if (
        x + catRadius > box.minX &&
        x - catRadius < box.maxX &&
        z + catRadius > box.minZ &&
        z - catRadius < box.maxZ &&
        this.catPos.y + 0.25 > minY &&
        this.catPos.y < box.topY - 0.25
      ) {
        return true;
      }
    }
    return false;
  }

  private findClimbableWallAt(x: number, z: number, catRadius: number): number | null {
    for (const box of this.world.colliders) {
      if (!box.climbable || box.isBarrier || box.topY <= 1.4) continue;
      const minY = box.minY ?? 0;
      if (
        x + catRadius + 0.12 > box.minX &&
        x - catRadius - 0.12 < box.maxX &&
        z + catRadius + 0.12 > box.minZ &&
        z - catRadius - 0.12 < box.maxZ &&
        this.catPos.y >= minY - 0.1 &&
        this.catPos.y < box.topY - 0.15
      ) {
        return box.topY;
      }
    }
    return null;
  }

  private updateGameplay(dt: number): void {
    const def = EVOLUTION_STAGES[this.stageIndex];
    const maxStamina = this.getEffectiveMaxStamina();
    const maxHealth = this.getEffectiveMaxHealth();
    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.meowCooldown > 0) this.meowCooldown = Math.max(0, this.meowCooldown - dt);
    if (this.spawnGraceTimer > 0) this.spawnGraceTimer = Math.max(0, this.spawnGraceTimer - dt);
    if (this.cameraAutoFollowCooldown > 0) {
      this.cameraAutoFollowCooldown = Math.max(0, this.cameraAutoFollowCooldown - dt);
    }

    // 1. Movement input
    let inX = this.virtualMove.x;
    let inZ = this.virtualMove.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inZ += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) inX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inX += 1;

    const inputLen = Math.hypot(inX, inZ);
    const wantsSprint =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.virtualSprint) &&
      inputLen > 0.1 &&
      this.stamina > 2;

    if (wantsSprint || this.isClimbing) {
      this.stamina = Math.max(0, this.stamina - (this.isClimbing ? 11 : 20) * dt);
    } else {
      this.stamina = Math.min(maxStamina, this.stamina + (this.isInsideShelter ? 32 : 16) * dt);
    }

    const targetSpeed =
      inputLen > 0.04
        ? def.moveSpeed * (wantsSprint ? def.sprintMultiplier : 1) * Math.min(1, inputLen)
        : 0;
    this.currentSpeed = THREE.MathUtils.damp(this.currentSpeed, targetSpeed, 20, dt);

    const catRadius = 0.4 * def.scale;

    if (inputLen > 0.04) {
      _forward.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
      _right.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
      _moveDir
        .set(0, 0, 0)
        .addScaledVector(_forward, -inZ)
        .addScaledVector(_right, inX)
        .normalize();

      const targetYaw = Math.atan2(_moveDir.x, _moveDir.z);
      let deltaYaw = targetYaw - this.catYaw;
      while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
      while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
      this.catYaw += deltaYaw * Math.min(1, dt * 18);

      const stepDist = Math.max(this.currentSpeed, targetSpeed * 0.4) * dt;
      const nextX = THREE.MathUtils.clamp(
        this.catPos.x + _moveDir.x * stepDist,
        -WORLD_BOUNDS,
        WORLD_BOUNDS,
      );
      const nextZ = THREE.MathUtils.clamp(
        this.catPos.z + _moveDir.z * stepDist,
        -WORLD_BOUNDS,
        WORLD_BOUNDS,
      );

      // If pulling backward (S / ▼), release climbing immediately so player never feels stuck
      if (this.isClimbing && inZ > 0.35) {
        this.isClimbing = false;
      }

      const wallTopY = this.findClimbableWallAt(nextX, nextZ, catRadius);
      if (wallTopY !== null && this.stamina > 4 && inZ <= 0.35) {
        this.isClimbing = true;
        this.climbTargetTopY = wallTopY;
        this.isGrounded = false;
      } else {
        if (this.isClimbing && wallTopY === null) {
          this.isClimbing = false;
        }
        if (!this.checkHorizontalCollision(nextX, this.catPos.z, catRadius)) {
          this.catPos.x = nextX;
        }
        if (!this.checkHorizontalCollision(this.catPos.x, nextZ, catRadius)) {
          this.catPos.z = nextZ;
        }
      }

      if (this.isGrounded && !this.isClimbing) {
        gameAudio.playStep(wantsSprint);
      }
    } else {
      // Immediately release wall grip when no longer pushing
      this.isClimbing = false;
    }

    // 2. Vertical Physics: Climbing vs Gravity + Cat 4-Paw Righting Reflex!
    if (this.isClimbing) {
      const climbVel = inputLen > 0.04 ? 6.6 * (1 + this.stageIndex * 0.1) : 0;
      this.catVelY = climbVel;
      this.catPos.y += climbVel * dt;
      if (climbVel > 0.5) gameAudio.playClimbStep();

      // Vault smoothly onto rooftop when reaching top!
      if (this.catPos.y >= this.climbTargetTopY - 0.12) {
        this.catPos.y = this.climbTargetTopY + 0.08;
        this.catPos.x = THREE.MathUtils.clamp(
          this.catPos.x + Math.sin(this.catYaw) * 0.85,
          -WORLD_BOUNDS,
          WORLD_BOUNDS,
        );
        this.catPos.z = THREE.MathUtils.clamp(
          this.catPos.z + Math.cos(this.catYaw) * 0.85,
          -WORLD_BOUNDS,
          WORLD_BOUNDS,
        );
        this.isClimbing = false;
        this.catVelY = 0;
        this.isGrounded = true;
      }
    } else {
      this.catVelY -= 25 * dt;
      if (this.catVelY < this.peakFallSpeed) {
        this.peakFallSpeed = this.catVelY;
      }
      this.catPos.y += this.catVelY * dt;

      let groundHeight = 0;
      const footRadius = 0.36 * def.scale;
      for (const box of this.world.colliders) {
        if (box.topY < 0 || box.isBarrier) continue;
        if (
          this.catPos.x + footRadius > box.minX &&
          this.catPos.x - footRadius < box.maxX &&
          this.catPos.z + footRadius > box.minZ &&
          this.catPos.z - footRadius < box.maxZ &&
          this.catPos.y >= box.topY - 0.48 &&
          box.topY > groundHeight
        ) {
          groundHeight = box.topY;
        }
      }

      if (this.catPos.y <= groundHeight) {
        if (!this.isGrounded && this.peakFallSpeed < -6.5) {
          // Always land cleanly on all four paws with cushioned reflex!
          this.cat.triggerFourPawLanding();
          gameAudio.playLandPaws();
        }
        this.catPos.y = groundHeight;
        this.catVelY = 0;
        this.peakFallSpeed = 0;
        this.isGrounded = true;
        this.coyoteTimer = 0.14;
        this.jumpsUsed = 0;
      } else {
        this.isGrounded = false;
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }
    }

    this.cat.root.position.copy(this.catPos);
    this.cat.root.rotation.y = this.catYaw;
    this.cat.update(
      dt,
      this.currentSpeed,
      this.isGrounded,
      wantsSprint,
      this.isInsideShelter && this.currentSpeed < 0.2,
      this.isClimbing,
      this.catVelY,
      this.isInsideShelter && (this.timeOfDay > 0.72 || this.timeOfDay < 0.22),
      this.elapsed,
    );

    // Shadow grounded below cat
    let shadowY = 0;
    for (const box of this.world.colliders) {
      if (box.topY < 0 || box.isBarrier) continue;
      if (
        this.catPos.x > box.minX &&
        this.catPos.x < box.maxX &&
        this.catPos.z > box.minZ &&
        this.catPos.z < box.maxZ &&
        box.topY <= this.catPos.y + 0.1 &&
        box.topY > shadowY
      ) {
        shadowY = box.topY;
      }
    }
    const shadowScale =
      THREE.MathUtils.clamp(1 - (this.catPos.y - shadowY) * 0.12, 0.35, 1) * def.scale;
    this.contactShadow.position.set(this.catPos.x, shadowY + 0.03, this.catPos.z);
    this.contactShadow.scale.setScalar(shadowScale);
    this.catTorch.position.set(this.catPos.x, this.catPos.y + 1.4, this.catPos.z);

    // 3. True 3D Third-Person Camera with Smooth Zoom, FOV Depth & Wall Avoidance
    this.camDistance = THREE.MathUtils.damp(this.camDistance, this.targetCamDistance, 11, dt);

    const isPortrait = this.camera.aspect < 0.85;
    const zoomRatio = (this.camDistance - 2.6) / (22.0 - 2.6);
    const baseFov = (isPortrait ? 66 : 62) + zoomRatio * 10;
    const targetFov = wantsSprint ? baseFov + 5 : baseFov;
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.04) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    const effectiveDist =
      (isPortrait ? this.camDistance * 1.12 : this.camDistance) * (0.9 + def.scale * 0.14);
    const lookAhead = Math.min(3.5, 1.1 + zoomRatio * 2.2);
    _camLookTarget.set(
      this.catPos.x - Math.sin(this.camYaw) * lookAhead,
      this.catPos.y + (0.95 + zoomRatio * 0.45) * def.scale,
      this.catPos.z - Math.cos(this.camYaw) * lookAhead,
    );
    const horizDist = Math.cos(this.camPitch) * effectiveDist;
    const vertDist = Math.sin(this.camPitch) * effectiveDist;
    _camDesiredPos.set(
      this.catPos.x + Math.sin(this.camYaw) * horizDist,
      Math.max(0.55, this.catPos.y + 0.9 * def.scale + vertDist),
      this.catPos.z + Math.cos(this.camYaw) * horizDist,
    );

    // Keep the camera inside the same building as Tomas when both are indoors.
    const cameraSharesIndoorZone = this.world.indoorZones.some((zone) =>
      this.catPos.x > zone.minX && this.catPos.x < zone.maxX &&
      this.catPos.z > zone.minZ && this.catPos.z < zone.maxZ &&
      this.catPos.y < zone.ceilingY &&
      _camDesiredPos.x > zone.minX && _camDesiredPos.x < zone.maxX &&
      _camDesiredPos.z > zone.minZ && _camDesiredPos.z < zone.maxZ &&
      _camDesiredPos.y < zone.ceilingY
    );

    // Outside, raise the camera over solid geometry to prevent wall clipping.
    // Indoors, skip this correction only while the camera remains in Tomas's building.
    if (!cameraSharesIndoorZone) {
      for (const box of this.world.colliders) {
        if (box.topY < 1.5 || box.isBarrier) continue;
        if (
          _camDesiredPos.x > box.minX - 0.3 &&
          _camDesiredPos.x < box.maxX + 0.3 &&
          _camDesiredPos.z > box.minZ - 0.3 &&
          _camDesiredPos.z < box.maxZ + 0.3 &&
          _camDesiredPos.y < box.topY + 0.3
        ) {
          _camDesiredPos.y = Math.max(_camDesiredPos.y, box.topY + 0.65);
        }
      }
    }

    this.camera.position.lerp(_camDesiredPos, 1 - Math.exp(-14 * dt));
    this.camera.lookAt(_camLookTarget);

    // 4. Day/Night & Acid Rain Weather
    this.timeOfDay += dt / 180;
    if (this.timeOfDay >= 1) {
      this.timeOfDay -= 1;
      this.day += 1;
      this.gainXp(25);
      this.callbacks.onToast(`Dia ${this.day} começou! (+25 XP)`, 'info');
    }

    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const nextWeather: Record<WeatherState, WeatherState> = {
        clear: 'rain',
        rain: 'snow',
        snow: 'cold_wind',
        cold_wind: 'freezing',
        freezing: 'acid_warning',
        acid_warning: 'acid_rain',
        acid_rain: 'clear',
      };
      this.weather = nextWeather[this.weather];
      const durations: Record<WeatherState, number> = {
        clear: 58 + Math.random() * 22,
        rain: 34,
        snow: 38,
        cold_wind: 32,
        freezing: 28,
        acid_warning: 15,
        acid_rain: 24,
      };
      this.weatherTimer = durations[this.weather];
      const alerts: Partial<Record<WeatherState, string>> = {
        rain: 'A chuva começou. Procure uma marquise ou entre em um prédio.',
        snow: 'Começou a nevar. Tomas precisa encontrar um lugar protegido.',
        cold_wind: 'Vento gelado! Entre em uma construção para conservar calor.',
        freezing: 'Frio congelante! Abrigue Tomas imediatamente.',
        acid_warning: 'Alerta: chuva ácida em 15 segundos! Procure abrigo.',
        acid_rain: 'Chuva ácida iniciada. Evite ficar exposto.',
      };
      const alert = alerts[this.weather];
      if (alert) this.callbacks.onToast(alert, this.weather === 'acid_warning' || this.weather === 'freezing' ? 'warn' : 'info');
    }

    this.updateEnvironmentLighting(dt);

    const hasPrecipitation = ['rain', 'snow', 'freezing', 'acid_rain'].includes(this.weather);
    this.rainPoints.visible = hasPrecipitation || this.weather === 'cold_wind';
    if (this.rainPoints.visible) {
      this.rainPoints.position.set(this.catPos.x, 0, this.catPos.z);
      const particleMat = this.rainPoints.material as THREE.PointsMaterial;
      const isSnow = this.weather === 'snow' || this.weather === 'freezing';
      const isAcid = this.weather === 'acid_rain';
      particleMat.color.setHex(isAcid ? 0xa3e635 : isSnow ? 0xe0f2fe : this.weather === 'cold_wind' ? 0x93c5fd : 0x60a5fa);
      particleMat.size = isSnow ? 0.23 : 0.14;
      particleMat.opacity = this.weather === 'cold_wind' ? 0.38 : 0.68;
      const posAttr = this.rainPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const fallSpeed = isSnow ? 5.5 : this.weather === 'cold_wind' ? 1.2 : 22;
      const windDrift = this.weather === 'cold_wind' || this.weather === 'freezing' ? 8 : 1.4;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - fallSpeed * dt;
        let x = posAttr.getX(i) + windDrift * dt;
        let z = posAttr.getZ(i) + windDrift * 0.22 * dt;
        if (y < 0) {
          y = 18;
          x = (Math.random() - 0.5) * 44;
          z = (Math.random() - 0.5) * 44;
        }
        if (x > 22) x = -22;
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }

    // 5. Interactables, Shelters & Sonar
    this.isInsideShelter = false;
    this.currentShelterId = null;
    let closestId: string | null = null;
    let closestDist = 3.2;

    if (this.sonarCooldown > 0) this.sonarCooldown = Math.max(0, this.sonarCooldown - dt);
    if (this.sonarRevealTimer > 0) this.sonarRevealTimer = Math.max(0, this.sonarRevealTimer - dt);

    if (this.sonarWaveProgress >= 0) {
      this.sonarWaveProgress += dt * 1.4;
      const maxR = def.sonarRadius;
      this.sonarRing.scale.setScalar(Math.max(1, this.sonarWaveProgress * maxR));
      (this.sonarRing.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1 - this.sonarWaveProgress) * 0.85,
      );
      if (this.sonarWaveProgress >= 1) {
        this.sonarWaveProgress = -1;
        this.sonarRing.visible = false;
      }
    }

    if (this.evoBurstTimer > 0) {
      this.evoBurstTimer -= dt;
      this.evoParticles.rotation.y += dt * 3;
      this.evoParticles.scale.setScalar(1 + (1.6 - this.evoBurstTimer) * 2.2);
      if (this.evoBurstTimer <= 0) this.evoParticles.visible = false;
    }

    for (const item of this.world.interactables) {
      if (!item.active) {
        if (item.respawnTimer > 0) {
          item.respawnTimer -= dt;
          if (item.respawnTimer <= 0) {
            item.active = true;
            item.mesh.visible = true;
          }
        }
        (item.beaconRing.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }

      if (item.kind === 'scrap' || item.kind === 'food') {
        item.mesh.rotation.y += dt * 1.1;
      }

      const dist = this.catPos.distanceTo(item.position);
      if (item.kind === 'shelter' && dist <= 3.1 * (item.shelterLevel === 3 ? 1.4 : 1.1)) {
        this.isInsideShelter = true;
        this.currentShelterId = item.id;
      }

      const interactionRange = item.kind === 'shelter' ? 3.2 : 2.7;
      if (dist < interactionRange && dist < closestDist) {
        closestDist = dist;
        closestId = item.id;
      }

      const ringMat = item.beaconRing.material as THREE.MeshBasicMaterial;
      if (this.sonarRevealTimer > 0 && dist <= def.sonarRadius) {
        ringMat.opacity = 0.55 + Math.sin(this.elapsed * 6) * 0.25;
        item.beaconRing.scale.setScalar(1 + Math.sin(this.elapsed * 4) * 0.15);
      } else {
        ringMat.opacity = 0;
      }
    }
    // Hollow buildings are genuine weather shelters, not just visual scenery.
    if (this.world.indoorZones.some((zone) =>
      this.catPos.x > zone.minX &&
      this.catPos.x < zone.maxX &&
      this.catPos.z > zone.minZ &&
      this.catPos.z < zone.maxZ &&
      this.catPos.y < zone.ceilingY
    )) {
      this.isInsideShelter = true;
    }

    // Precipitation must not render through a building roof around a sheltered cat.
    if (this.isInsideShelter) this.rainPoints.visible = false;

    this.activeInteractableId = closestId;

    // 6. Predator, Boss & Rooftop Rival Cat AI
    for (const pred of this.world.predators) {
      if (!pred.alive) {
        if (!pred.isBoss && !pred.isTerritoryRival && pred.respawnTimer > 0) {
          pred.respawnTimer -= dt;
          if (pred.respawnTimer <= 0) {
            pred.alive = true;
            pred.hp = pred.maxHp;
            pred.group.visible = true;
            pred.group.position.copy(pred.homePos);
          }
        }
        continue;
      }

      if (pred.attackCooldown > 0) pred.attackCooldown -= dt;
      if (pred.hitFlashTimer > 0) {
        pred.hitFlashTimer -= dt;
        pred.bodyMesh.position.y = Math.sin(this.elapsed * 40) * 0.08;
      } else {
        pred.bodyMesh.position.y = 0;
      }

      if (pred.stunTimer > 0) {
        pred.stunTimer -= dt;
        continue;
      }

      const px = pred.group.position.x;
      const pz = pred.group.position.z;
      const distToCat = Math.hypot(this.catPos.x - px, this.catPos.z - pz);

      if (pred.isFriendly) {
        // Friendly strays keep their distance, then approach cautiously to inspect Tomas.
        const dx = this.catPos.x - px;
        const dz = this.catPos.z - pz;
        const distance = Math.max(0.001, distToCat);
        let friendlySpeed = 0;
        if (distToCat > 5.2 && distToCat < 15) {
          friendlySpeed = pred.speed;
          pred.group.position.x += (dx / distance) * friendlySpeed * dt;
          pred.group.position.z += (dz / distance) * friendlySpeed * dt;
          pred.group.rotation.y = Math.atan2(dx, dz);
        } else if (distToCat <= 5.2) {
          pred.group.rotation.y = Math.atan2(dx, dz);
          pred.bodyMesh.rotation.y = Math.sin(this.elapsed * 2.2) * 0.08;
        } else {
          const homeDistance = Math.hypot(pred.homePos.x - px, pred.homePos.z - pz);
          if (homeDistance > 1.2) {
            friendlySpeed = pred.speed * 0.45;
            pred.group.position.x += ((pred.homePos.x - px) / homeDistance) * friendlySpeed * dt;
            pred.group.position.z += ((pred.homePos.z - pz) / homeDistance) * friendlySpeed * dt;
            pred.group.rotation.y = Math.atan2(pred.homePos.x - px, pred.homePos.z - pz);
          } else {
            pred.group.rotation.y += Math.sin(this.elapsed * 0.7) * dt * 0.25;
          }
        }
        const gait = this.elapsed * 7;
        pred.legs.forEach((leg, idx) => {
          leg.rotation.x = friendlySpeed > 0.2 ? Math.sin(gait + (idx % 2 === 0 ? 0 : Math.PI)) * 0.38 : THREE.MathUtils.damp(leg.rotation.x, 0, 7, dt);
        });
        continue;
      }

      if (pred.distractTimer > 0) {
        pred.distractTimer -= dt;
        pred.group.rotation.y += dt * 2.5;
        continue;
      }

      let canSeeCat = false;
      let canHitCat = false;

      if (pred.isTerritoryRival && pred.rooftopBounds) {
        const rb = pred.rooftopBounds;
        const onSameRoof =
          Math.abs(this.catPos.y - rb.y) < 1.9 &&
          this.catPos.x >= rb.minX - 1.5 &&
          this.catPos.x <= rb.maxX + 1.5 &&
          this.catPos.z >= rb.minZ - 1.5 &&
          this.catPos.z <= rb.maxZ + 1.5;

        if (onSameRoof && !this.announcedRivals.has(pred.id)) {
          this.announcedRivals.add(pred.id);
          this.callbacks.onToast(
            `Disputa de Telhado: ${pred.name} (Nv. ${pred.rivalLevel || 10})!`,
            'warn',
          );
        }
        canSeeCat = onSameRoof && !this.isInsideShelter;
        canHitCat = Math.abs(this.catPos.y - rb.y) < 1.8;
      } else {
        // Ground predators won't follow onto high rooftops (y > 2.2) or inside shelters!
        canSeeCat =
          distToCat <= pred.aggroRange &&
          this.catPos.y < 2.2 &&
          !this.isInsideShelter;
        canHitCat = this.catPos.y < 1.8;
      }

      let moveSpeed = 0;
      if (canSeeCat) {
        const dx = this.catPos.x - px;
        const dz = this.catPos.z - pz;
        pred.group.rotation.y = Math.atan2(dx, dz);

        if (distToCat > pred.attackRange) {
          moveSpeed = pred.speed;
          let stepX = px + (dx / distToCat) * moveSpeed * dt;
          let stepZ = pz + (dz / distToCat) * moveSpeed * dt;

          if (pred.isTerritoryRival && pred.rooftopBounds) {
            const rb = pred.rooftopBounds;
            stepX = THREE.MathUtils.clamp(stepX, rb.minX + 0.5, rb.maxX - 0.5);
            stepZ = THREE.MathUtils.clamp(stepZ, rb.minZ + 0.5, rb.maxZ - 0.5);
            pred.group.position.set(stepX, rb.y, stepZ);
          } else if (Math.hypot(stepX - pred.homePos.x, stepZ - pred.homePos.z) < (pred.isBoss ? 24 : 18)) {
            pred.group.position.x = stepX;
            pred.group.position.z = stepZ;
          }
        } else if (pred.attackCooldown <= 0 && canHitCat && this.spawnGraceTimer <= 0) {
          pred.attackCooldown = pred.isBoss ? 1.35 : pred.isTerritoryRival ? 1.25 : 1.5;
          this.health -= pred.damage;
          this.lastThreatCause = `Derrotado por ${pred.name}`;
          gameAudio.playAlert();
          if (pred.isBoss) gameAudio.playBossRoar();
          this.callbacks.onToast(
            `${pred.name} atacou (-${pred.damage} Saúde)! Use Clique/J para Azunhar!`,
            'warn',
          );
        }
      } else {
        // Patrol gently around home position (staying on roof if rival)
        const distHome = Math.hypot(pred.homePos.x - px, pred.homePos.z - pz);
        if (distHome > 1.5) {
          const dx = pred.homePos.x - px;
          const dz = pred.homePos.z - pz;
          moveSpeed = pred.speed * 0.55;
          pred.group.rotation.y = Math.atan2(dx, dz);
          pred.group.position.x += (dx / distHome) * moveSpeed * dt;
          pred.group.position.z += (dz / distHome) * moveSpeed * dt;
        }
        if (pred.rooftopBounds) {
          pred.group.position.y = pred.rooftopBounds.y;
        }
      }

      // Animate predator legs
      if (moveSpeed > 0.2) {
        const phase = this.elapsed * 11;
        pred.legs.forEach((leg, idx) => {
          leg.rotation.x = Math.sin(phase + (idx % 2 === 0 ? 0 : Math.PI)) * 0.55;
        });
      } else {
        pred.legs.forEach((leg) => {
          leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, 0, 8, dt);
        });
      }
    }

    // 7. Survival Needs simulation
    const isNight = this.timeOfDay < 0.24 || this.timeOfDay > 0.76;
    const hungerDrain = (0.7 + (wantsSprint ? 0.7 : 0)) * dt;
    const thirstDrain = (0.9 + (this.weather === 'acid_rain' || this.weather === 'rain' ? 0.3 : 0)) * dt;

    this.hunger = Math.max(0, this.hunger - hungerDrain);
    this.thirst = Math.max(0, this.thirst - thirstDrain);

    if (this.isInsideShelter) {
      this.warmth = Math.min(def.maxWarmth, this.warmth + 16 * dt);
      this.health = Math.min(maxHealth, this.health + 3.0 * dt);
    } else {
      let warmthDelta = isNight ? -1.2 : 0.45;
      if (this.weather === 'rain') warmthDelta -= 1.8;
      if (this.weather === 'snow') warmthDelta -= 3.2;
      if (this.weather === 'cold_wind') warmthDelta -= 4.2;
      if (this.weather === 'freezing') warmthDelta -= 5.5;
      if (this.weather === 'acid_rain') {
        const acidMult = 1 - def.acidResistance;
        warmthDelta -= 3.0 * acidMult;
        this.health -= 3.8 * acidMult * dt;
        this.lastThreatCause = 'Exposição à Chuva Ácida';
      }
      if (this.weather === 'rain' || this.weather === 'snow' || this.weather === 'cold_wind' || this.weather === 'freezing') {
        this.lastThreatCause = this.weather === 'rain' ? 'Exposição à chuva' : this.weather === 'snow' ? 'Exposição à neve' : 'Exposição ao frio intenso';
      }
      this.warmth = THREE.MathUtils.clamp(this.warmth + warmthDelta * dt, 0, def.maxWarmth);
    }

    if (this.hunger <= 0) {
      this.health -= 2.8 * dt;
      this.lastThreatCause = 'Fome extrema';
    }
    if (this.thirst <= 0) {
      this.health -= 3.4 * dt;
      this.lastThreatCause = 'Desidratação';
    }
    if (this.warmth <= 0) {
      this.health -= 2.5 * dt;
      this.lastThreatCause = 'Hipotermia noturna';
    }

    gameAudio.updateAmbience(this.weather === 'acid_rain', this.isInsideShelter);

    if (this.health <= 0) {
      this.health = 0;
      const cause = this.lastThreatCause || 'Exaustão nas ruínas';
      this.chances = Math.max(0, this.chances - 1);
      this.saveGame();
      if (this.chances > 0) {
        this.phase = 'fallen';
        this.callbacks.onPlayerDown(cause, this.buildSnapshot(cause));
      } else {
        this.phase = 'gameover';
        this.callbacks.onGameOver(cause, this.buildSnapshot(cause));
      }
      return;
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.12) {
      this.hudSyncTimer = 0;
      this.syncHud();
    }
    this.saveTimer += dt;
    if (this.saveTimer >= 6) {
      this.saveTimer = 0;
      this.saveGame();
    }
  }

  private updateEnvironmentLighting(dt: number): void {
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle);

    if (
      Math.abs(this.catPos.x - this.lastShadowFollowX) > 1.5 ||
      Math.abs(this.catPos.z - this.lastShadowFollowZ) > 1.5
    ) {
      this.lastShadowFollowX = this.catPos.x;
      this.lastShadowFollowZ = this.catPos.z;
      this.sunLight.position.set(
        this.catPos.x + Math.cos(sunAngle) * 35,
        Math.max(8, sunElev * 44),
        this.catPos.z + 18,
      );
      this.sunLight.target.position.copy(this.catPos);
    }

    this.world.skyDome.position.set(this.catPos.x, 0, this.catPos.z);

    const daylight = THREE.MathUtils.clamp((sunElev + 0.32) * 1.22, 0, 1);
    const weatherLightFactor =
      this.weather === 'freezing' ? 0.58 :
      this.weather === 'cold_wind' ? 0.7 :
      this.weather === 'rain' ? 0.82 :
      this.weather === 'snow' ? 0.9 : 1;
    this.sunLight.intensity = (0.62 + daylight * 1.55) * weatherLightFactor;
    this.hemiLight.intensity = (0.82 + daylight * 0.72) * (this.weather === 'freezing' ? 0.76 : 1);

    // The moon rises during the night and its direct glow awakens Tomas's lunar strength.
    const isNight = this.timeOfDay < 0.22 || this.timeOfDay > 0.72;
    const nightProgress = this.timeOfDay > 0.72
      ? (this.timeOfDay - 0.72) / 0.28
      : this.timeOfDay / 0.22;
    const moonStrength = isNight
      ? THREE.MathUtils.clamp(0.76 + Math.sin(nightProgress * Math.PI) * 0.24, 0, 1)
      : 0;
    this.moonMesh.position.set(this.catPos.x + 40, 68, this.catPos.z - 65);
    this.moonLight.position.copy(this.moonMesh.position);
    this.moonMesh.visible = moonStrength > 0.08;
    this.moonLight.intensity = moonStrength * 2.7;
    const lunarPowerNow = moonStrength >= 0.72;
    if (lunarPowerNow && !this.moonPowerActive) {
      this.moonPowerActive = true;
      this.cat.triggerAction('meow');
      gameAudio.playMeow();
      this.callbacks.onToast('A Lua despertou a força de Tomas Vagabundo! Ataque e salto fortalecidos.', 'success');
    } else if (!lunarPowerNow && this.moonPowerActive) {
      this.moonPowerActive = false;
      this.callbacks.onToast('A força lunar de Tomas está adormecendo.', 'info');
    }

    if (this.weather === 'acid_rain') _skyColor.copy(_acidColor);
    else if (daylight > 0.55) _skyColor.copy(_dayColor);
    else if (daylight > 0.18) _skyColor.copy(_duskColor).lerp(_dayColor, (daylight - 0.18) / 0.37);
    else _skyColor.copy(_nightColor).lerp(_duskColor, daylight / 0.18);
    if (this.weather === 'rain') _skyColor.lerp(_rainColor, 0.42);
    if (this.weather === 'snow') _skyColor.lerp(_snowColor, 0.34);
    if (this.weather === 'cold_wind' || this.weather === 'freezing') _skyColor.lerp(_stormColor, this.weather === 'freezing' ? 0.62 : 0.44);

    (this.scene.background as THREE.Color).lerp(_skyColor, 1 - Math.exp(-2.5 * dt));
    const skyMat = this.world.skyDome.material as THREE.MeshBasicMaterial;
    skyMat.color.setHex(this.weather === 'acid_rain' ? 0x6ee7b7 : 0xffffff).lerp(
      this.scene.background as THREE.Color,
      (1 - daylight) * 0.55,
    );

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.scene.background as THREE.Color);
      const targetFog =
        this.weather === 'acid_rain' ? 0.0085 :
        this.weather === 'freezing' ? 0.007 :
        this.weather === 'snow' ? 0.0055 :
        this.weather === 'rain' || this.weather === 'cold_wind' ? 0.004 : 0.002;
      this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, targetFog, 2, dt);
    }

    const neonStrength = 0.45 + (1 - daylight) * 1.25;
    for (const mat of this.world.neonMaterials) {
      mat.emissiveIntensity = neonStrength;
    }

    this.textures.waterRipple.offset.x += dt * 0.03;
    this.textures.waterRipple.offset.y += dt * 0.02;
  }

  private buildPrompt(): PromptInfo | null {
    if (!this.activeInteractableId) return null;
    const item = this.world.interactables.find((i) => i.id === this.activeInteractableId);
    if (!item || !item.active) return null;

    if (item.kind === 'food' || item.kind === 'prey') {
      return {
        id: item.id,
        kind: item.kind,
        label: item.name,
        detail: `+${item.amount} Fome · +${item.xpGain} XP`,
        actionText: 'Comer',
      };
    }
    if (item.kind === 'water') {
      return {
        id: item.id,
        kind: item.kind,
        label: item.name,
        detail: `+${item.amount} Sede · +${item.xpGain} XP`,
        actionText: 'Beber Água',
      };
    }
    if (item.kind === 'scrap') {
      return {
        id: item.id,
        kind: item.kind,
        label: item.name,
        detail: '+1 Sucata para Abrigo',
        actionText: 'Coletar',
      };
    }
    if (item.kind === 'shelter') {
      const lvl = item.shelterLevel || 1;
      const cost = lvl * 2;
      return {
        id: item.id,
        kind: item.kind,
        label: `${item.name} (Nível ${lvl})`,
        detail: 'Restaura Saúde e Calor · Avança a noite',
        actionText: 'Descansar',
        canUpgrade: lvl < 3,
        upgradeCost: cost,
        secondaryLabel: lvl < 3 ? `Melhorar (${cost} Sucatas)` : 'Nível Máximo',
      };
    }
    if (item.kind === 'terminal') {
      const read = this.discoveredTerminals.has(item.id);
      return {
        id: item.id,
        kind: item.kind,
        label: item.name,
        detail: read ? 'Diário já lido' : `+${item.xpGain} XP · História`,
        actionText: 'Ler Diário',
      };
    }
    return null;
  }

  private buildSnapshot(causeOfDeath?: string): HudSnapshot {
    const def = EVOLUTION_STAGES[this.stageIndex];
    const radarRange = this.sonarRevealTimer > 0 ? def.sonarRadius : 36;
    const blips: RadarBlip[] = [];

    for (const item of this.world.interactables) {
      if (!item.active) continue;
      const dx = item.position.x - this.catPos.x;
      const dz = item.position.z - this.catPos.z;
      if (Math.hypot(dx, dz) <= radarRange || item.kind === 'shelter') {
        blips.push({ id: item.id, kind: item.kind, dx, dz });
      }
    }

    let activeBoss: BossHudInfo | null = null;
    let totalTerritories = 0;
    for (const pred of this.world.predators) {
      if (pred.isTerritoryRival) totalTerritories++;
      if (!pred.alive) continue;
      const dx = pred.group.position.x - this.catPos.x;
      const dz = pred.group.position.z - this.catPos.z;
      const dist = Math.hypot(dx, dz);

      if (pred.isBoss && dist <= 26) {
        activeBoss = {
          name: pred.name,
          kind: pred.kind,
          hp: pred.hp,
          maxHp: pred.maxHp,
          distance: dist,
        };
      } else if (
        pred.isTerritoryRival &&
        pred.rooftopBounds &&
        Math.abs(this.catPos.y - pred.rooftopBounds.y) < 2.5 &&
        dist <= 16
      ) {
        activeBoss = {
          name: pred.name,
          kind: pred.kind,
          isRivalCat: true,
          rivalLevel: pred.rivalLevel,
          hp: pred.hp,
          maxHp: pred.maxHp,
          distance: dist,
        };
      }

      if (dist <= radarRange || pred.isBoss || pred.isTerritoryRival) {
        blips.push({
          id: pred.id,
          kind: pred.isBoss ? 'boss' : pred.isTerritoryRival ? 'rival' : 'enemy',
          dx,
          dz,
        });
      }
    }

    return {
      health: this.health,
      maxHealth: this.getEffectiveMaxHealth(),
      hunger: this.hunger,
      maxHunger: def.maxHunger,
      thirst: this.thirst,
      maxThirst: def.maxThirst,
      warmth: this.warmth,
      maxWarmth: def.maxWarmth,
      stamina: this.stamina,
      maxStamina: this.getEffectiveMaxStamina(),
      level: this.level,
      stars: this.stars,
      starProgress: this.starProgress,
      starNext: this.getStarNext(),
      isAlphaLeader: this.level >= MAX_CAT_LEVEL,
      rankTitle: this.getRankTitle(),
      attackPower: this.getCurrentAttackDamage(),
      stageIndex: this.stageIndex,
      scrap: this.scrap,
      day: this.day,
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      weatherCountdown: Math.ceil(this.weatherTimer),
      sectorName: this.world.getSectorName(this.catPos.x, this.catPos.z),
      currentPhase: this.currentPhase,
      defeatedBosses: Array.from(this.defeatedBosses),
      conqueredTerritories: Array.from(this.conqueredTerritories),
      totalTerritories,
      activeBoss,
      isInsideShelter: this.isInsideShelter,
      isClimbing: this.isClimbing,
      sonarActive: this.sonarRevealTimer > 0,
      sonarCooldown: this.sonarCooldown,
      attackCooldown: this.attackCooldown,
      catYaw: this.catYaw,
      catX: this.catPos.x,
      catZ: this.catPos.z,
      prompt: this.buildPrompt(),
      radarBlips: blips,
      discoveredTerminals: Array.from(this.discoveredTerminals),
      foodCollected: this.foodCollected,
      waterDrunk: this.waterDrunk,
      sheltersUpgraded: this.sheltersUpgraded,
      enemiesDefeated: this.enemiesDefeated,
      chances: this.chances,
      maxChances: MAX_CHANCES,
      hasBossCheckpoint: Boolean(this.bossCheckpoint),
      checkpointPhase: this.bossCheckpoint?.currentPhase ?? 1,
      causeOfDeath,
    };
  }

  private syncHud(): void {
    this.callbacks.onHudUpdate(this.buildSnapshot());
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('webglcontextlost', this.onContextLost);

    this.societyActors.dispose();
    this.textures.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
