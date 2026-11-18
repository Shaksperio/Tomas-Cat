import { saveProgressScore } from './saves/saveSelection';
import * as THREE from 'three';
import {
  BossCheckpointData,
  BossHudInfo,
  CHAPTER_PHASES,
  EVOLUTION_STAGES,
  GamePhase,
  HudSnapshot,
  ShopHud,
  DuelHud,
  LoreLog,
  MAX_CAT_LEVEL,
  MAX_CHANCES,
  PromptInfo,
  RadarBlip,
  SavedGameState,
  WeatherState,
} from '../types/game';
import { gameAudio } from './audio';
import type { BattleInventoryItem } from './battle/commands';
import { ArticulatedCat } from './catModel';
import { PredatorActor } from './enemyModels';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { buildPostApocalypticWorld, BuiltWorld, WORLD_BOUNDS } from './worldBuilder';
import { SocietySimulation } from './society/simulation';
import { WorldSocietyRegistry } from './society/worldSocietyRegistry';
import { SocietyActors } from './society/SocietyActors';
import { WorldAgentRuntimeRegistry } from './society/agents/worldAgentRuntimeRegistry';
import { DIALOGUE_DATA } from './dialogue/dialogueData';
import { acceptPlayerTask, advancePlayerTasks, getPlayerTaskDefinition } from './tasks/playerTasks';
import {
  createInitialWorldTravelState,
  LEGACY_WORLD_ID,
  normalizeWorldTravelState,
  updateActiveWorldPosition,
  selectPlayableActiveWorld,
  type WorldTravelSaveState,
} from './worlds/portalWorlds';
import { PLAYABLE_WORLD_IDS, WORLD_IDS } from './worlds/worldCatalog';
import { WorldSceneManager } from './worlds/worldSceneManager';
import type { PlayerTaskEvent, PlayerTaskState } from './tasks/playerTasks';
import { createTaskCycleState, tickTaskCycle, advanceTaskCycleEvent, cloneTaskCycleState } from './tasks/taskCycles';
import type { TaskCycleState } from './tasks/taskCycles';
import { selectFirstAvailableTaskGpsTarget } from './tasks/taskNavigation';
import type { TaskGpsCandidate, TaskGpsTarget } from './tasks/taskNavigation';
import { addInventoryItem, consumeInventoryItem, createInventoryState, inventoryCount, normalizeInventory } from './items/inventory';
import type { InventoryState } from './items/inventory';
import { ITEM_CATALOG, EQUIPMENT_SLOT_LABELS, isInventoryItemId, type InventoryItemId, type EquipmentItemId, type EquipmentSlot } from './items/itemCatalog';
import { getShop, isShopOpen } from './shop/catalog';
import { purchaseItem } from './shop/purchase';
import { createEquipmentState, getEquipmentBonuses, normalizeEquipment } from './items/equipment';
import type { EquipmentState } from './items/equipment';
import { findGridRoute } from './tasks/gridRoute';
import { normalizeTaskRewardDrops } from './tasks/taskRewards';
import type { TaskRewardDrop } from './tasks/taskRewards';
import { availableOptions, chooseOption, startDialogue } from './dialogue/dialogueRunner';
import type { DialogueContext, DialogueEffect, DialogueState } from './dialogue/types';
import { isMoonTime, moonProgress, skyColorAt } from './dayCycle';
import { sampleSkyAtmosphere } from './sky/skyAtmosphere';
import { SkyVisuals } from './sky/skyVisuals';
import { getNewlyUnlockedMoves, mergeUnlockedMoves } from './progression/unlocks';
import {
  DEFAULT_COIN_STAKE,
  type DuelFighter,
  type DuelStake,
  type PairOutcome,
  decideChallengeResponse,
  describeStake,
  maxResourceStake,
  settleGroupDuel,
  validateGroupStake,
  validateMatchedStake,
} from './battle/duel';
import {
  type BattleCommand,
  type BattleAction,
  type BattleState,
  type FoeSide,
  FOE_SIDES,
  type Side,
  canUseCommand,
  chooseOpponentCommand,
  createBattle,
  defaultTarget,
  fighter,
  forfeitBattle,
  isFoe,
  livingFoes,
  resolveCommand,
  resolveGuardComboBreaker,
  resolveComboBreaker,
  seedFromText,
  tickAtb,
  tickPlayerDecisionTimer,
} from './battle/atb';
import { BattleStage } from './battle/BattleStage';
import {
  SWIM_SURFACE_SPEED_FACTOR,
  SWIM_UNDERWATER_SPEED_FACTOR,
  WaterSample,
  stepOxygen,
  swimVerticalVelocity,
} from './survival/water';
import { sampleExpandedWater, type RiverWaterSample } from './survival/waterBodies';

const SAVE_KEY = 'felis09_save_v4';
const BACKUP_KEY = 'felis09_save_v4_backup';

// Pre-allocated math helpers (zero GC inside animation loop)
const _moveDir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _skyColor = new THREE.Color();
const _acidColor = new THREE.Color(0x162b22);
const _rainColor = new THREE.Color(0x526579);
const _snowColor = new THREE.Color(0x9aaec2);
const _stormColor = new THREE.Color(0x34465e);
const _sunsetColor = new THREE.Color(0xff9a5c);
const _underwaterColor = new THREE.Color(0x0b5a73);

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onToast: (message: string, tone: 'info' | 'success' | 'warn') => void;
  onLoreOpen: (lore: LoreLog) => void;
  onPlayerDown: (cause: string, snapshot: HudSnapshot) => void;
  onGameOver: (cause: string, snapshot: HudSnapshot) => void;
  onVictory: (snapshot: HudSnapshot) => void;
  onEvolutionUnlocked: (newStageIndex: number) => void;
  onSaveGame?: (payload: SavedGameState) => void;
}

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;
  private readonly ownerId: string;
  private readonly saveKey: string;
  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly textures: ProceduralTextureSet;
  private world: BuiltWorld;
  private readonly worldSceneManager: WorldSceneManager;
  private readonly cat: ArticulatedCat;
  private readonly societyRegistry = new WorldSocietyRegistry(PLAYABLE_WORLD_IDS);
  private readonly agentRuntimeRegistry = new WorldAgentRuntimeRegistry(PLAYABLE_WORLD_IDS, {
    cowilaEveryTicks: 25,
  });
  private get agentRuntime() {
    return this.agentRuntimeRegistry.runtimeFor(this.worldSceneManager.activeWorldId);
  }
  private get society(): SocietySimulation {
    return this.societyRegistry.simulationFor(this.worldSceneManager.activeWorldId);
  }
  private readonly societyActors: SocietyActors;
  private societyTickTimer = 0;
  private societySaveTimer = 0;
  private readonly contactShadow: THREE.Mesh;
  private readonly gpsRoutePositions = new Float32Array(768 * 3);
  private readonly gpsRoute: THREE.Line;
  private gpsRoutePath: Array<{ x: number; z: number }> = [];
  private gpsRouteTargetId: string | null = null;
  private gpsRouteStartCell = '';
  private gpsRouteTargetPosition = { x: Number.NaN, z: Number.NaN };

  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly catTorch: THREE.PointLight;
  private readonly moonMesh: THREE.Mesh;
  private readonly sunMesh: THREE.Mesh;
  private readonly starField: THREE.Points;
  private readonly moonLight: THREE.PointLight;
  private readonly skyVisuals: SkyVisuals;
  private moonPowerActive = false;

  private readonly sonarRing: THREE.Mesh;
  private sonarWaveProgress = -1;
  private readonly evoParticles: THREE.Points;
  private evoBurstTimer = 0;
  private readonly rainPoints: THREE.Points;
  private readonly rainPositions: Float32Array;
  private readonly bubblePoints: THREE.Points;
  private readonly bubblePositions = new Float32Array(18 * 3);
  private readonly bubbleLife = new Float32Array(18);
  private bubbleSpawnTimer = 0;
  private bubbleAudioTimer = 0;

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
  private unlockedMoves = new Set<string>(['basic-claw']);
  private chances = MAX_CHANCES;
  private spawnGraceTimer = 0;
  private bossCheckpoint: BossCheckpointData | null = null;
  private currentPhase = 1;
  private defeatedBosses = new Set<number>();
  private conqueredTerritories = new Set<string>();
  private announcedRivals = new Set<string>();
  private scrap = 0;
  private coins = 60;
  private duelPhase: 'idle' | 'offer' | 'fighting' | 'result' = 'idle';
  private duelOpponentId: string | null = null;
  private duelStake: DuelStake | null = null;
  /** Habitantes por perto elegíveis (o mais próximo primeiro) e os que lutam agora. */
  private duelCandidateIds: string[] = [];
  private duelFoeIds: string[] = [];
  private duelNames: string[] = [];
  private battleTarget: FoeSide | null = null;
  /** Maná guardado de batalhas vencidas (0–100). */
  private battleMana = 0;
  private openShopId: string | null = null;
  private battleInventory: BattleInventoryItem[] = [];
  private inventory: InventoryState = createInventoryState();
  private equipment: EquipmentState = createEquipmentState();
  private battle: BattleState | null = null;
  private pendingOpponentSpecial: BattleAction | null = null;
  private battleEnding = false;
  private readonly battleStage: BattleStage;
  private duelResultText = '';
  private duelResultWon: boolean | null = null;
  private duelResultTimer = 0;
  private day = 1;
  private timeOfDay = 0.34;
  private weather: WeatherState = 'clear';
  private weatherTimer = 75;
  private health = 100;
  private hunger = 90;
  private thirst = 88;
  private warmth = 96;
  private stamina = 100;
  private oxygen = 100;
  private waterSample: RiverWaterSample = { body: null, river: null, inWater: false, footDepth: 0, submerged: false, floorY: 0, currentDx: 0, currentDz: 0 };
  private swimAscendTimer = 0;
  private wasSwimming = false;
  private underwaterBlend = 0;
  private baseFogDensity = 0.002;
  private oxygenWarned = false;
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
  private activeDialogue: DialogueState | null = null;
  private readonly dialogueRelations = new Map<string, { affinity: number; trust: number }>();
  private readonly dialogueFlags = new Map<string, boolean>();
  private readonly acceptedDialogueTasks = new Set<string>();
  private playerTasks: PlayerTaskState[] = [];
  private taskCycle: TaskCycleState = createTaskCycleState();
  private taskRewardDrops: TaskRewardDrop[] = [];
  /** Estado persistente de viagem; o motor atual ainda carrega apenas o mundo legado. */
  private worldTravel: WorldTravelSaveState = createInitialWorldTravelState(LEGACY_WORLD_ID);

  constructor(container: HTMLElement, callbacks: EngineCallbacks, ownerId: string) {
    this.container = container;
    this.callbacks = callbacks;
    this.ownerId = ownerId;
    this.saveKey = `${SAVE_KEY}_${ownerId}`;

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
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isSmallScreen ? 1.1 : 1.25),
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
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(9, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff1c2, fog: false, depthWrite: false }),
    );
    this.sunMesh.visible = false;
    this.scene.add(this.sunMesh);
    // Estrelas fixas (posições determinísticas) numa esfera ao redor do gato.
    const starCount = 700;
    const starPositions = new Float32Array(starCount * 3);
    let starSeed = 12345;
    const starRand = () => {
      starSeed = (Math.imul(starSeed, 1664525) + 1013904223) >>> 0;
      return starSeed / 4294967296;
    };
    for (let i = 0; i < starCount; i++) {
      const theta = starRand() * Math.PI * 2;
      const y = 0.12 + starRand() * 0.88; // só no hemisfério visível
      const r = Math.sqrt(1 - y * y);
      starPositions[i * 3] = Math.cos(theta) * r * 470;
      starPositions[i * 3 + 1] = y * 470;
      starPositions[i * 3 + 2] = Math.sin(theta) * r * 470;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starField = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2.2,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
      }),
    );
    this.starField.visible = false;
    this.starField.frustumCulled = false;
    this.scene.add(this.starField);
    this.moonLight = new THREE.PointLight(0xc8dcff, 0, 140, 1.6);
    this.scene.add(this.moonLight);
    this.skyVisuals = new SkyVisuals(this.scene);

    this.catTorch = new THREE.PointLight(0x22d3ee, 0.9, 12);
    this.catTorch.position.set(0, 1.4, 0);
    this.scene.add(this.catTorch);

    const maxAniso = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.textures = createProceduralTextures(maxAniso);
    this.worldSceneManager = new WorldSceneManager(
      this.scene,
      [{
        id: LEGACY_WORLD_ID,
        spawn: { x: 0, z: 8 },
        build: (root) => buildPostApocalypticWorld(root, this.textures),
      }],
      LEGACY_WORLD_ID,
    );
    this.world = this.worldSceneManager.active.world;
    const gpsGeometry = new THREE.BufferGeometry();
    gpsGeometry.setAttribute('position', new THREE.BufferAttribute(this.gpsRoutePositions, 3));
    gpsGeometry.setDrawRange(0, 2);
    this.gpsRoute = new THREE.Line(gpsGeometry, new THREE.LineBasicMaterial({ color: 0x2f80ff, transparent: true, opacity: 0.96, depthWrite: false }));
    this.gpsRoute.frustumCulled = false;
    this.gpsRoute.visible = false;
    this.scene.add(this.gpsRoute);
    this.societyActors = new SocietyActors(this.scene);
    this.battleStage = new BattleStage(this.scene, this.camera);
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

    // Bolhas subaquáticas reutilizadas (sem criar geometrias a cada quadro).
    const bubbleGeo = new THREE.BufferGeometry();
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(this.bubblePositions, 3));
    this.bubblePoints = new THREE.Points(
      bubbleGeo,
      new THREE.PointsMaterial({ color: 0xb9f3ff, size: 0.075, transparent: true, opacity: 0.72, depthWrite: false }),
    );
    this.bubblePoints.visible = false;
    this.scene.add(this.bubblePoints);

    this.bindEvents();
    this.syncHud();
    this.scheduleNextFrame();
  }

  public static hasSavedGame(ownerId: string): boolean {
    try {
      return Boolean(localStorage.getItem(`${SAVE_KEY}_${ownerId}`) || localStorage.getItem(SAVE_KEY));
    } catch {
      return false;
    }
  }

  public static getSavedGame(ownerId: string): SavedGameState | null {
    try {
      const raw = localStorage.getItem(`${SAVE_KEY}_${ownerId}`);
      return raw ? JSON.parse(raw) as SavedGameState : null;
    } catch {
      return null;
    }
  }

  /** Save legado sem proprietário: só pode ser reivindicado durante a primeira migração autenticada. */
  public static getLegacySavedGame(): SavedGameState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) as SavedGameState : null;
    } catch {
      return null;
    }
  }

  /** Nunca apaga o save legado: arquiva uma cópia de segurança antes de removê-lo. */
  public static clearLegacySavedGame(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) GameEngine.archiveSave(JSON.parse(raw) as SavedGameState);
      localStorage.removeItem(SAVE_KEY);
    } catch { /* ignore */ }
  }

  /** Cópia de segurança local; só é substituída por um save mais avançado. */
  public static archiveSave(save: SavedGameState | null | undefined): void {
    if (!save) return;
    try {
      const current = GameEngine.getBackupSavedGame();
      if (current && saveProgressScore(current) >= saveProgressScore(save)) return;
      localStorage.setItem(BACKUP_KEY, JSON.stringify(save));
    } catch { /* ignore */ }
  }

  public static getBackupSavedGame(): SavedGameState | null {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      return raw ? JSON.parse(raw) as SavedGameState : null;
    } catch {
      return null;
    }
  }

  public static clearSavedGame(ownerId: string): void {
    try {
      localStorage.removeItem(`${SAVE_KEY}_${ownerId}`);
    } catch {
      // ignore
    }
  }

  public persistNow(): void {
    this.saveGame();
  }

  private getStarNext(): number {
    return 55 + this.level * 2;
  }

  private getEffectiveMaxHealth(): number {
    return EVOLUTION_STAGES[this.stageIndex].maxHealth + (this.level - 1) * 3 + getEquipmentBonuses(this.equipment).maxHealth;
  }

  private getEffectiveMaxStamina(): number {
    return EVOLUTION_STAGES[this.stageIndex].maxStamina + (this.level - 1) * 2 + getEquipmentBonuses(this.equipment).maxStamina;
  }

  private getCurrentAttackDamage(): number {
    const baseDamage =
      EVOLUTION_STAGES[this.stageIndex].attackDamage +
      (this.level - 1) * 1.4 +
      (this.level >= MAX_CAT_LEVEL ? 25 : 0);
    const gear = 1 + getEquipmentBonuses(this.equipment).attackPercent / 100;
    return Math.round(baseDamage * gear * (this.moonPowerActive ? 1.65 : 1));
  }

  private getSonarRadius(): number {
    return EVOLUTION_STAGES[this.stageIndex].sonarRadius + getEquipmentBonuses(this.equipment).sonarRadius;
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
    GameEngine.archiveSave(GameEngine.getSavedGame(this.ownerId));
    GameEngine.clearSavedGame(this.ownerId);
    this.stageIndex = 0;
    this.level = 1;
    this.stars = 0;
    this.starProgress = 0;
    this.unlockedMoves = new Set(mergeUnlockedMoves(1));
    this.chances = MAX_CHANCES;
    this.spawnGraceTimer = 0;
    this.bossCheckpoint = null;
    this.currentPhase = 1;
    this.worldTravel = createInitialWorldTravelState(LEGACY_WORLD_ID);
    this.defeatedBosses.clear();
    this.conqueredTerritories.clear();
    this.battleMana = 0;
    this.battleInventory = [];
    this.inventory = createInventoryState();
    this.equipment = createEquipmentState();
    this.announcedRivals.clear();
    this.scrap = 0;
    this.coins = 60;
    this.resetDuel();
    this.activeDialogue = null;
    this.dialogueRelations.clear();
    this.dialogueFlags.clear();
    this.acceptedDialogueTasks.clear();
    this.playerTasks = [];
    this.clearTaskRewardDrops();
    this.taskCycle = createTaskCycleState();
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
    this.societyRegistry.reset(this.worldSceneManager.activeWorldId);
    this.agentRuntimeRegistry.reset(this.worldSceneManager.activeWorldId);
    this.societyTickTimer = 0;
    this.societySaveTimer = 0;

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
    this.unlockedMoves = new Set(mergeUnlockedMoves(this.level, cp.unlockedMoves ?? []));
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
      unlockedMoves: Array.from(this.unlockedMoves),
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

  public continueSavedGame(savedOverride?: SavedGameState | null): void {
    gameAudio.init();
    try {
      const raw = savedOverride ? JSON.stringify(savedOverride) : (localStorage.getItem(this.saveKey) || localStorage.getItem(SAVE_KEY));
      if (!raw) {
        this.startNewGame();
        return;
      }
      const saved: SavedGameState = JSON.parse(raw);
      // Saves v4 sem worldTravel migram de forma segura para o mundo original.
      this.worldTravel = selectPlayableActiveWorld(
        normalizeWorldTravelState(saved.worldTravel, WORLD_IDS, LEGACY_WORLD_ID),
        PLAYABLE_WORLD_IDS,
        LEGACY_WORLD_ID,
      );
      this.societySaveTimer = 0;
      if (saved.society?.schemaVersion === 1 && saved.society.worlds
        && typeof saved.society.worlds === 'object' && !Array.isArray(saved.society.worlds)) {
        const worlds = saved.society.worlds;
        const entries = Object.entries(worlds);
        const validWorldEntries = entries.every(([, state]) =>
          Boolean(state && typeof state === 'object' && state.simulation && state.agents),
        );
        const simulationStates = validWorldEntries
          ? Object.fromEntries(entries.map(([worldId, state]) => [worldId, state.simulation] as const))
          : {};
        const agentStates = validWorldEntries
          ? Object.fromEntries(entries.map(([worldId, state]) => [worldId, state.agents] as const))
          : {};
        const simulationRestored = validWorldEntries && this.societyRegistry.restoreStates(simulationStates);
        const agentsRestored = validWorldEntries && this.agentRuntimeRegistry.restoreStates(agentStates);
        if (!simulationRestored || !agentsRestored) {
          // Estado parcial/corrompido: descarta o bloco da sociedade por inteiro,
          // sem impedir o carregamento do progresso principal do jogador.
          for (const worldId of PLAYABLE_WORLD_IDS) {
            this.societyRegistry.reset(worldId);
            this.agentRuntimeRegistry.reset(worldId);
          }
        }
      }
      this.level = Math.max(1, Math.min(MAX_CAT_LEVEL, saved.level || 1));
      this.unlockedMoves = new Set(mergeUnlockedMoves(this.level, saved.unlockedMoves ?? []));
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
      this.coins = typeof saved.coins === 'number' ? Math.max(0, saved.coins) : 60;
      this.battleMana = typeof saved.battleMana === 'number' ? Math.max(0, Math.min(100, saved.battleMana)) : 0;
      this.battleInventory = (saved.battleInventory ?? []).filter((entry) => entry?.itemId === 'ration' && Number.isFinite(entry.quantity) && entry.quantity > 0).map((entry) => ({ itemId: 'ration', quantity: Math.min(99, Math.floor(entry.quantity)) }));
      this.inventory = normalizeInventory(saved.inventory);
      this.equipment = normalizeEquipment(saved.equipment);
      this.day = saved.day || 1;
      this.timeOfDay = saved.timeOfDay ?? 0.34;
      this.health = Math.min(this.getEffectiveMaxHealth(), Math.max(25, saved.health || def.maxHealth));
      this.hunger = Math.min(def.maxHunger, saved.hunger ?? def.maxHunger);
      this.thirst = Math.min(def.maxThirst, saved.thirst ?? def.maxThirst);
      this.warmth = Math.min(def.maxWarmth, saved.warmth ?? def.maxWarmth);
      this.stamina = this.getEffectiveMaxStamina();
      this.oxygen = THREE.MathUtils.clamp(saved.oxygen ?? 100, 0, 100);
      this.catPos.set(saved.catX || 0, saved.catY || 0, saved.catZ || 8);
      this.catVelY = 0;
      this.isClimbing = false;
      this.discoveredTerminals = new Set(saved.discoveredTerminals || []);
      this.activeDialogue = null;
      this.dialogueRelations.clear();
      for (const [id, relation] of Object.entries(saved.dialogueRelations ?? {})) {
        if (id && Number.isFinite(relation?.affinity) && Number.isFinite(relation?.trust)) {
          this.dialogueRelations.set(id, {
            affinity: THREE.MathUtils.clamp(relation.affinity, 0, 100),
            trust: THREE.MathUtils.clamp(relation.trust, 0, 100),
          });
        }
      }
      this.dialogueFlags.clear();
      for (const [id, value] of Object.entries(saved.dialogueFlags ?? {})) {
        if (id && typeof value === 'boolean') this.dialogueFlags.set(id, value);
      }
      this.acceptedDialogueTasks.clear();
      this.playerTasks = [];
      for (const id of saved.acceptedDialogueTasks ?? []) {
        if (typeof id === 'string' && id.length > 0 && id.length <= 100) {
          this.acceptedDialogueTasks.add(id);
          this.playerTasks = acceptPlayerTask(this.playerTasks, id);
        }
      }
      if (Array.isArray(saved.playerTasks)) {
        this.playerTasks = saved.playerTasks.flatMap((task) => {
          const definition = task && getPlayerTaskDefinition(task.id);
          if (!definition || !Number.isFinite(task.progress) || (task.status !== 'active' && task.status !== 'completed')) return [];
          const progress = THREE.MathUtils.clamp(Math.floor(task.progress), 0, definition.target);
          return [{ id: task.id, progress, status: task.status === 'completed' || progress >= definition.target ? 'completed' as const : 'active' as const }];
        });
      }
      this.taskCycle = cloneTaskCycleState(saved.taskCycle ?? createTaskCycleState());
      this.taskRewardDrops = normalizeTaskRewardDrops(saved.taskRewardDrops);
      for (const drop of this.taskRewardDrops) this.spawnTaskRewardDrop(drop);
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
      this.saveGame();
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
    if (this.waterSample.inWater) {
      // Na água, pular = nadar para cima (também funciona com toque no celular).
      this.swimAscendTimer = 0.45;
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

  // ---------------------------------------------------------------------
  // Modo batalha 1x1 (regras em src/game/battle/duel.ts)
  // ---------------------------------------------------------------------

  private resetDuel(): void {
    this.duelPhase = 'idle';
    this.duelOpponentId = null;
    this.duelStake = null;
    this.duelCandidateIds = [];
    this.duelFoeIds = [];
    this.duelNames = [];
    this.battleTarget = null;
    this.battle = null;
    this.pendingOpponentSpecial = null;
    this.battleEnding = false;
    this.battleStage.end();
    this.societyActors.setSceneControl(null);
    this.duelResultText = '';
    this.duelResultWon = null;
    this.duelResultTimer = 0;
  }

  private buildPlayerFighter(): DuelFighter {
    return {
      id: 'tomas',
      name: 'Tomas Vagabundo',
      coins: this.coins,
      items: { scrap: this.scrap },
      health: this.health,
      maxHealth: this.getEffectiveMaxHealth(),
      oxygen: this.oxygen,
      maxOxygen: 100,
    };
  }

  private buildAgentFighter(agent: { id: string; displayName: string; wallet: number; health: number }): DuelFighter {
    return {
      id: agent.id,
      name: agent.displayName,
      coins: agent.wallet,
      // Habitantes carregam um pouco de sucata (valor abstrato, não rastreado na simulação).
      items: { scrap: 12 },
      health: agent.health,
      maxHealth: 100,
      oxygen: 100,
      maxOxygen: 100,
    };
  }

  /** Habitantes para os atores 3D (o duelista é controlado pela cena de batalha). */
  private snapshotForActors() {
    return this.society.snapshot();
  }

  public challengeNearest(): void {
    if (this.phase !== 'playing' || this.duelPhase !== 'idle') return;
    if (this.waterSample.inWater) {
      this.callbacks.onToast('Não dá para duelar nadando.', 'warn');
      return;
    }
    const snap = this.society.snapshot();
    const near = snap.agents
      .filter((agent) => agent.status !== 'disabled')
      .map((agent) => ({ agent, d: Math.hypot(agent.position.x - this.catPos.x, agent.position.z - this.catPos.z) }))
      .filter((e) => e.d <= 12)
      .sort((x, y) => x.d - y.d);
    if (near.length === 0 || near[0].d > 7) {
      this.callbacks.onToast('Nenhum habitante por perto para desafiar (chegue a 7 m).', 'info');
      return;
    }
    this.duelOpponentId = near[0].agent.id;
    this.duelCandidateIds = near.slice(0, FOE_SIDES.length).map((e) => e.agent.id);
    this.duelPhase = 'offer';
  }

  public cancelDuelOffer(): void {
    if (this.duelPhase === 'offer') this.resetDuel();
  }

  /** `group`: desafia todos os habitantes próximos (2 a 4) de uma vez. A aposta é por oponente. */
  public submitDuelOffer(kind: DuelStake['kind'], amount: number, group = false): void {
    if (this.phase !== 'playing' || this.duelPhase !== 'offer' || !this.duelOpponentId) return;
    const all = this.society.snapshot().agents;
    const ids = group && this.duelCandidateIds.length >= 2 ? this.duelCandidateIds : [this.duelOpponentId];
    const agents = ids.map((id) => all.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => Boolean(a));
    if (agents.length === 0) {
      this.resetDuel();
      return;
    }
    const stake: DuelStake = kind === 'item' ? { kind, amount, itemId: 'scrap' } : { kind, amount };
    const me = this.buildPlayerFighter();
    const foes = agents.map((a) => this.buildAgentFighter(a));
    const invalid = validateGroupStake(me, foes, stake);
    if (invalid) {
      this.callbacks.onToast(invalid, 'warn');
      return;
    }
    // Cada oponente decide por si; quem recusa fica de fora (em grupo) — sem ninguém, não há duelo.
    const accepted: typeof agents = [];
    const refusals: string[] = [];
    agents.forEach((agent, i) => {
      const answer = decideChallengeResponse(
        me,
        foes[i],
        { morale: agent.needs.morale, health: agent.health, busyResting: agent.status === 'resting' },
        stake,
      );
      if (answer.accepted) accepted.push(agent);
      else refusals.push(answer.reason);
    });
    if (accepted.length === 0) {
      this.callbacks.onToast(refusals[0] ?? 'O desafio foi recusado.', 'warn');
      this.resetDuel();
      return;
    }
    if (accepted.length < agents.length) {
      const fm = accepted.map((a) => this.buildAgentFighter(a));
      const again = validateGroupStake(me, fm, stake);
      if (again) {
        this.callbacks.onToast(again, 'warn');
        return;
      }
    }
    this.duelStake = stake;
    this.startBattle(accepted);
    if (!this.battle) return;
    const names = accepted.map((a) => a.displayName).join(', ');
    const per = accepted.length > 1 ? ` por oponente (${accepted.length}×)` : ' cada';
    this.callbacks.onToast(
      accepted.length > 1
        ? `${names} aceitaram o desafio! Aposta: ${describeStake(stake)}${per}.`
        : `${accepted[0].displayName} aceitou o desafio! Aposta: ${describeStake(stake)}${per}.`,
      'success',
    );
    gameAudio.playAlert();
  }

  /** Inicia a batalha contra 1 a 4 habitantes. `levels` sobrescreve os níveis (ex.: chefes de gangue). */
  private startBattle(agents: Array<{ id: string; position: { x: number; z: number } }>, levels?: number[]): void {
    const foeList = agents
      .slice(0, FOE_SIDES.length)
      .map((a) => ({ agent: a, root: this.societyActors.getActorRoot(a.id) }))
      .filter((e): e is { agent: (typeof agents)[number]; root: THREE.Object3D } => Boolean(e.root));
    if (foeList.length === 0) {
      this.callbacks.onToast('O adversário não está disponível.', 'warn');
      this.resetDuel();
      return;
    }
    const playerPos = new THREE.Vector3(this.catPos.x, this.catPos.y, this.catPos.z);
    const foePositions = foeList.map((e) => new THREE.Vector3(e.agent.position.x, 0, e.agent.position.z));
    const fcx = foePositions.reduce((sum, v) => sum + v.x, 0) / foePositions.length;
    const fcz = foePositions.reduce((sum, v) => sum + v.z, 0) / foePositions.length;
    // Câmera do lado "livre" (sem prédios) em relação ao eixo da luta.
    const ax = fcx - playerPos.x;
    const az = fcz - playerPos.z;
    const len = Math.hypot(ax, az) || 1;
    const px = -az / len;
    const pz = ax / len;
    const cx = (fcx + playerPos.x) / 2;
    const cz = (fcz + playerPos.z) / 2;
    const reach = 9.6 + 1.6 * (foeList.length - 1);
    const blocked = (side: number) => this.checkHorizontalCollision(cx + px * side * reach, cz + pz * side * reach, 0.8);
    const cameraSide: 1 | -1 = blocked(1) && !blocked(-1) ? -1 : 1;

    const foeLevels = foeList.map((_, i) => levels?.[i] ?? Math.min(99, 6 + Math.floor(this.level * 0.6)));
    this.duelFoeIds = foeList.map((e) => e.agent.id);
    this.duelNames = foeList.map((e) => this.society.snapshot().agents.find((a) => a.id === e.agent.id)?.displayName ?? '—');
    this.battle = createBattle(
      seedFromText(`${this.duelFoeIds.join('+')}:${this.society.snapshot().tick}`),
      this.getCurrentAttackDamage() / 12,
      this.level,
      foeLevels[0],
      { playerMana: this.battleMana, foeLevels, playerItems: this.getBattleItemCount('ration') },
    );
    this.battleTarget = defaultTarget(this.battle);
    this.battleEnding = false;
    this.societyActors.setSceneControl(this.duelFoeIds);
    this.battleStage.begin({
      playerRoot: this.cat.root,
      playerPos,
      foes: foeList.map((e, i) => ({ root: e.root, pos: foePositions[i] })),
      cameraSide,
      onPlayerClaw: () => {
        this.cat.triggerAction('claw');
        gameAudio.playClawSlash();
      },
      onPlayerCheer: () => {
        this.cat.triggerAction('meow');
        gameAudio.playMeow();
      },
    });
    this.duelPhase = 'fighting';
    this.syncHud();
  }

  /** Seleciona o alvo do jogador (em batalha em grupo). */
  public selectBattleTarget(side: FoeSide): void {
    if (this.duelPhase !== 'fighting' || !this.battle) return;
    if (livingFoes(this.battle).includes(side)) this.battleTarget = side;
  }

  /** Comando do jogador (HUD, teclas 1–4 ou J/C = atacar). */
  public battleCommand(command: BattleCommand): void {
    if (this.phase !== 'playing' || this.duelPhase !== 'fighting' || !this.battle) return;
    if (this.battleStage.busy || this.battleEnding) return;
    if (!canUseCommand(this.battle, 'player', command)) {
      if (command === 'limit') this.callbacks.onToast('A barra de maná ainda não está cheia.', 'info');
      else if (command === 'item' && this.battle?.playerItems === 0) this.callbacks.onToast('Você não tem rações de combate.', 'info');
      else if (command === 'item') this.callbacks.onToast('O vigor já está cheio.', 'info');
      else if (command === 'combo_a' && this.level < 25) this.callbacks.onToast('Rasante Duplo desbloqueia no nível 25.', 'info');
      else if (command === 'combo_b' && this.level < 55) this.callbacks.onToast('Tempestade de Garras desbloqueia no nível 55.', 'info');
      else if (command === 'magic' || command === 'combo_a' || command === 'combo_b') this.callbacks.onToast('Maná insuficiente para esta técnica.', 'info');
      return;
    }
    this.runBattleCommand('player', command);
  }

  /** Ativação manual [9] durante a janela de interrupção do especial inimigo. */
  public activateComboBreaker(): void {
    const battle = this.battle;
    const special = this.pendingOpponentSpecial;
    if (!battle || !special || !isFoe(special.actor) || !this.battleStage.comboBreakerWindowOpen || this.battleEnding) return;

    // O primeiro impacto visual ainda não aconteceu; revertemos o dano pré-calculado.
    const restoredVigor = special.hits.reduce((sum, hit) => sum + hit.damage, 0);
    battle.player.vigor = Math.min(100, battle.player.vigor + restoredVigor);
    if (battle.finished && special.finishing) {
      battle.finished = false;
      battle.winner = null;
      battle.reason = null;
    }
    const counter = resolveComboBreaker(battle, special.actor);
    if (!counter) return;
    this.battleStage.displayVigor.player = battle.player.vigor;
    if (!this.battleStage.interruptWithComboBreaker(counter)) return;
    this.pendingOpponentSpecial = null;
    gameAudio.playSonar();
  }

  private runBattleCommand(side: Side, command: BattleCommand): void {
    const battle = this.battle;
    if (!battle) return;
    const chosen = side === 'player' && this.battleTarget && livingFoes(battle).includes(this.battleTarget) ? this.battleTarget : undefined;
    const action = resolveCommand(battle, side, command, chosen);
    if (side === 'player') this.battleTarget = livingFoes(battle).includes(action.target as FoeSide) ? (action.target as FoeSide) : defaultTarget(battle);
    if (side !== 'player' && command === 'limit') this.pendingOpponentSpecial = action;
    if (command === 'limit') gameAudio.playBossRoar();
    else if (command === 'guard') gameAudio.playSonar();
    else if (command === 'item') gameAudio.playEat();

    const defensiveCounter = side !== 'player' ? resolveGuardComboBreaker(battle, action) : null;
    this.battleStage.playAction(action, () => {
      if (defensiveCounter) {
        this.battleStage.displayVigor.player = battle.player.vigor;
        this.battleStage.playAction(defensiveCounter, () => {
          if (battle.finished) this.beginBattleEnding();
        });
        return;
      }
      this.pendingOpponentSpecial = null;
      if (battle.finished) this.beginBattleEnding();
    });
  }

  private beginBattleEnding(): void {
    const battle = this.battle;
    if (!battle || this.battleEnding) return;
    this.battleEnding = true;
    this.battleStage.playEnding(battle.winner, () => this.finishDuel());
  }

  public forfeitDuel(): void {
    if (this.duelPhase !== 'fighting' || !this.battle || this.battleEnding) return;
    forfeitBattle(this.battle);
    this.battleEnding = true;
    this.finishDuel();
  }

  /** Um quadro da batalha cinematográfica: o mundo fica "congelado" como num RPG. */
  private updateBattle(dt: number): void {
    this.updateEnvironmentLighting(dt);
    this.cat.update(dt, 0, true, false, false, false, false, 0, false, this.elapsed);
    this.battleStage.update(dt);
    // A interface só vê a batalha se o motor publicar o estado (o laço normal não roda aqui).
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.06) {
      this.hudSyncTimer = 0;
      this.syncHud();
    }
    const battle = this.battle;
    if (!battle || this.battleStage.busy || this.battleEnding) return;
    if (battle.finished) {
      this.beginBattleEnding();
      return;
    }
    if (battle.ready === 'player') {
      if (tickPlayerDecisionTimer(battle, dt)) {
        this.callbacks.onToast('Tempo esgotado! Tomas assumiu a defesa automaticamente.', 'info');
        this.runBattleCommand('player', 'guard');
      }
      return;
    }
    const ready = tickAtb(battle, dt);
    if (ready && isFoe(ready)) this.runBattleCommand(ready, chooseOpponentCommand(battle, ready));
  }

  private updateDuel(dt: number): void {
    if (this.duelPhase === 'result') {
      this.duelResultTimer -= dt;
      if (this.duelResultTimer <= 0) this.resetDuel();
      return;
    }
    if (this.duelPhase === 'offer') {
      const agent = this.society.snapshot().agents.find((a) => a.id === this.duelOpponentId);
      if (!agent || Math.hypot(agent.position.x - this.catPos.x, agent.position.z - this.catPos.z) > 12) {
        this.resetDuel();
      }
      return;
    }
  }

  private finishDuel(): void {
    const combat = this.battle;
    const stake = this.duelStake;
    const snapAgents = this.society.snapshot().agents;
    const agents = this.duelFoeIds
      .map((id) => snapAgents.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
    if (!combat || !stake || agents.length === 0) {
      this.resetDuel();
      return;
    }
    const me = this.buildPlayerFighter();
    const foes = agents.map((a) => this.buildAgentFighter(a));
    this.battleStage.end();
    this.societyActors.setSceneControl(null);
    this.cat.root.position.copy(this.catPos);

    // Cada par: oponente derrubado paga; se o jogador cai/desiste, paga aos que ficaram de pé; turnos esgotados = empate.
    const outcomes: PairOutcome[] = agents.map((_, i) => {
      const down = fighter(combat, FOE_SIDES[i]).vigor <= 0;
      if (down) return 'win';
      if (combat.winner === 'opponent') return 'lose';
      return 'draw';
    });
    const result = settleGroupDuel(me, foes, stake, outcomes);

    const mine = result.player;
    this.coins = Math.max(0, this.coins + mine.coins);
    this.scrap = Math.max(0, this.scrap + (mine.items.scrap ?? 0));
    const maxHp = this.getEffectiveMaxHealth();
    this.health = THREE.MathUtils.clamp(this.health + mine.health, Math.min(maxHp, maxHp * 0.25), maxHp);
    this.oxygen = THREE.MathUtils.clamp(this.oxygen + mine.oxygen, 25, 100);
    agents.forEach((agent) => {
      const theirs = result.foes[agent.id];
      if (theirs) this.society.applyDuelOutcome(agent.id, { coins: theirs.coins, health: theirs.health });
    });

    const names = agents.map((a) => a.displayName);
    const who = names.length === 1 ? names[0] : `o grupo (${names.join(', ')})`;
    const wonText = describeStake({ ...stake, amount: stake.amount * Math.max(1, result.wins) });
    const lostText = describeStake({ ...stake, amount: stake.amount * Math.max(1, result.losses) });
    if (result.wins === 0 && result.losses === 0) {
      this.duelResultWon = null;
      this.duelResultText = `Empate com ${who}! Ninguém perdeu a aposta (${describeStake(stake)}).`;
    } else if (combat.winner === 'player') {
      this.duelResultWon = true;
      this.duelResultText = `Vitória sobre ${who}! Você ganhou ${wonText}.`;
      this.gainXp(20 * agents.length);
    } else {
      this.duelResultWon = false;
      const earned = result.wins > 0 ? ` (mas ganhou ${wonText} dos que derrubou)` : '';
      this.duelResultText =
        combat.reason === 'forfeit'
          ? `Você desistiu. ${who} levou ${lostText}${earned}.`
          : `${who} venceu. Você perdeu ${lostText}${earned}.`;
      if (result.wins > 0) this.gainXp(10 * result.wins);
    }
    // O maná de uma batalha vencida é guardado para a próxima; derrota ou desistência zera.
    if (this.duelResultWon === true) this.battleMana = Math.round(combat.player.limit);
    else if (this.duelResultWon === false) this.battleMana = 0;
    this.battleInventory = combat.playerItems > 0 ? [{ itemId: 'ration', quantity: combat.playerItems }] : [];
    this.duelPhase = 'result';
    this.battle = null;
    this.pendingOpponentSpecial = null;
    this.battleEnding = false;
    this.duelResultTimer = 5;
    this.callbacks.onToast(this.duelResultText, this.duelResultWon === false ? 'warn' : 'success');
    this.saveGame();
    this.syncHud();
  }

  private buildDuelHud(): DuelHud | null {
    if (this.duelPhase === 'idle') return null;
    const agents = this.society.snapshot().agents;
    const primary = agents.find((a) => a.id === this.duelOpponentId);
    const me = this.buildPlayerFighter();
    const battle = this.battle;
    const foes: DuelHud['foes'] = [];
    if (battle) {
      for (let i = 0; i < battle.foeCount; i += 1) {
        const side = FOE_SIDES[i];
        const c = fighter(battle, side);
        foes.push({
          side,
          name: this.duelNames[i] ?? '—',
          vigor: this.battleStage.displayVigor[side],
          atb: Math.max(0, Math.min(100, c.atb)),
          guard: c.guarding,
          fallen: this.battleStage.displayVigor[side] <= 0 || c.vigor <= 0,
        });
      }
    }
    const first = foes[0];
    return {
      phase: this.duelPhase === 'offer' ? 'offer' : this.duelPhase === 'fighting' ? 'fighting' : 'result',
      opponentName: this.duelNames.length > 1 ? `Grupo (${this.duelNames.length})` : (this.duelNames[0] ?? primary?.displayName ?? '—'),
      stakeText: this.duelStake ? describeStake(this.duelStake) : '',
      playerVigor: this.battleStage.displayVigor.player,
      opponentVigor: first?.vigor ?? this.battleStage.displayVigor.opponent,
      playerAtb: Math.max(0, Math.min(100, battle?.player.atb ?? 0)),
      opponentAtb: first?.atb ?? 0,
      playerLimit: battle?.player.limit ?? 0,
      playerLevel: this.level,
      awaitingCommand: Boolean(
        battle && battle.ready === 'player' && !this.battleStage.busy && !this.battleEnding && !battle.finished,
      ),
      playerTurnTimeLeft: battle?.playerTurnTimeLeft ?? 0,
      comboBreakerWindowOpen: this.battleStage.comboBreakerWindowOpen,
      intro: this.battleStage.introActive,
      banner: this.battleStage.banner,
      darkness: this.battleStage.darkness,
      flash: this.battleStage.whiteFlash,
      playerGuard: Boolean(battle?.player.guarding),
      opponentGuard: first?.guard ?? false,
      foes,
      targetSide: this.battleTarget,
      storedMana: this.battleMana,
      playerItems: battle?.playerItems ?? this.getBattleItemCount('ration'),
      groupAvailable: this.duelPhase === 'offer' ? this.duelCandidateIds.length : 0,
      limits: {
        coins: me.coins,
        scrap: this.scrap,
        vitality: maxResourceStake(me.health, me.maxHealth),
        oxygen: maxResourceStake(me.oxygen, me.maxOxygen),
      },
      defaultCoins: DEFAULT_COIN_STAKE,
      resultText: this.duelResultText,
      resultWon: this.duelResultWon,
    };
  }

  public triggerClawAttack(): void {
    if (this.phase === 'playing' && this.duelPhase === 'fighting') {
      this.battleCommand('attack');
      return;
    }
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
    this.recordPlayerTaskEvent('enemy_defeated');
    this.scrap += pred.scrapReward;
    this.coins += Math.max(1, Math.round(pred.scrapReward / 2));

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

  private buildDialogueContext(agentId: string): DialogueContext | null {
    const agent = this.society.snapshot().agents.find((candidate) => candidate.id === agentId);
    if (!agent) return null;
    const relation = this.dialogueRelations.get(agentId) ?? { affinity: 50, trust: 50 };
    return {
      agentId,
      affinity: relation.affinity,
      trust: relation.trust,
      morale: agent.needs.morale,
      weather: this.weather,
      timeOfDay: this.timeOfDay,
      playerHealthRatio: this.health / Math.max(1, this.getEffectiveMaxHealth()),
      territoryControlled: this.conqueredTerritories.size > 0,
      completedTaskIds: [],
      flags: Object.fromEntries(this.dialogueFlags),
    };
  }

  /** Alcance máximo (m) para conversar com um habitante tocado/clicado. */
  private static readonly DIALOGUE_TAP_RANGE = 9;

  /** Habitante sob o toque/clique, por distância em tela (tolerante a dedos). */
  private pickResidentAt(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const tmp = new THREE.Vector3();
    let bestId: string | null = null;
    let bestDist = 56; // px
    for (const agent of this.society.snapshot().agents) {
      if (agent.status === 'disabled' || !DIALOGUE_DATA.some((node) => node.agentId === agent.id)) continue;
      const root = this.societyActors.getActorRoot(agent.id);
      if (!root || !root.visible) continue;
      for (const h of [0.5, 1.3]) {
        tmp.set(root.position.x, root.position.y + h, root.position.z).project(this.camera);
        if (tmp.z > 1) continue;
        const sx = (tmp.x * 0.5 + 0.5) * rect.width;
        const sy = (-tmp.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - px, sy - py);
        if (d < bestDist) { bestDist = d; bestId = agent.id; }
      }
    }
    return bestId;
  }

  private startDialogueWith(agentId: string): boolean {
    if (this.activeDialogue) return false;
    const agent = this.society.snapshot().agents.find((a) => a.id === agentId);
    if (!agent) return false;
    const dist = Math.hypot(agent.position.x - this.catPos.x, agent.position.z - this.catPos.z);
    if (dist > GameEngine.DIALOGUE_TAP_RANGE) {
      this.callbacks.onToast(`Aproxime-se de ${agent.displayName} para conversar.`, 'info');
      return true; // o toque foi consumido (não vira ataque)
    }
    const context = this.buildDialogueContext(agent.id);
    if (!context) return false;
    const state = startDialogue(agent.id, context, DIALOGUE_DATA);
    if (!state) return false;
    this.activeDialogue = state;
    this.phase = 'paused';
    this.syncHud();
    return true;
  }

  /** Posição na tela (0–1) acima da cabeça de quem está falando. */
  private getDialogueAnchor(): { x: number; y: number } | null {
    if (!this.activeDialogue) return null;
    const root = this.societyActors.getActorRoot(this.activeDialogue.agentId);
    if (!root) return null;
    const v = new THREE.Vector3(root.position.x, root.position.y + 2.5, root.position.z).project(this.camera);
    if (v.z > 1) return null;
    return { x: v.x * 0.5 + 0.5, y: -v.y * 0.5 + 0.5 };
  }

  private applyDialogueEffect(agentId: string, effect: DialogueEffect): void {
    switch (effect.kind) {
      case 'affinity':
      case 'trust': {
        const current = this.dialogueRelations.get(agentId) ?? { affinity: 50, trust: 50 };
        current[effect.kind] = THREE.MathUtils.clamp(current[effect.kind] + Math.trunc(effect.amount), 0, 100);
        this.dialogueRelations.set(agentId, current);
        break;
      }
      case 'give_item': {
        if (effect.itemId !== 'scrap' || !Number.isFinite(effect.quantity)) break;
        const quantity = Math.max(1, Math.min(10, Math.floor(effect.quantity)));
        this.scrap += quantity;
        this.callbacks.onToast(`Recebeu ${quantity} sucata.`, 'success');
        break;
      }
      case 'open_task': {
        if (!effect.taskId || effect.taskId.length > 100) break;
        const definition = getPlayerTaskDefinition(effect.taskId);
        if (!definition) break;
        const wasAccepted = this.acceptedDialogueTasks.has(effect.taskId);
        this.acceptedDialogueTasks.add(effect.taskId);
        this.playerTasks = acceptPlayerTask(this.playerTasks, effect.taskId);
        this.callbacks.onToast(wasAccepted ? 'Esse pedido já está registrado.' : `Tarefa aceita: ${definition.title}.`, 'success');
        break;
      }
      case 'grant_xp': {
        if (!Number.isFinite(effect.amount) || effect.amount <= 0) break;
        this.gainXp(Math.min(10000, Math.floor(effect.amount)));
        break;
      }
      case 'set_flag': {
        if (!effect.flagId || effect.flagId.length > 100 || typeof effect.value !== 'boolean') break;
        this.dialogueFlags.set(effect.flagId, effect.value);
        break;
      }
    }
  }

  private getBattleItemCount(itemId: string): number {
    return this.battleInventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
  }

  private addBattleItem(itemId: string, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const current = this.battleInventory.find((entry) => entry.itemId === itemId);
    if (current) current.quantity = Math.min(99, current.quantity + Math.floor(amount));
    else this.battleInventory.push({ itemId, quantity: Math.min(99, Math.floor(amount)) });
    this.callbacks.onToast('Ração energética +1: disponível para usar em batalhas.', 'success');
  }

  private spawnTaskRewardDrop(drop: TaskRewardDrop): void {
    if (this.world.interactables.some((item) => item.taskRewardId === drop.id)) return;
    const group = new THREE.Group();
    group.position.set(drop.x, drop.y, drop.z);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.9, metalness: 0.72, roughness: 0.24,
    });
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 1.1, transparent: true, opacity: 0.9,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), coreMaterial);
    core.position.y = 0.62;
    core.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 6, 18), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    group.add(core, ring);
    this.scene.add(group);
    this.world.interactables.push({
      id: drop.id, taskRewardId: drop.id, kind: 'scrap', name: `Recompensa: ${drop.title}`,
      position: new THREE.Vector3(drop.x, drop.y, drop.z), mesh: group, beaconRing: ring,
      active: true, respawnTimer: 0, maxRespawn: 0, amount: drop.amount, xpGain: 0,
    });
  }

  private clearTaskRewardDrops(): void {
    const rewardItems = this.world.interactables.filter((item) => item.taskRewardId);
    for (const item of rewardItems) {
      this.scene.remove(item.mesh);
      item.mesh.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
    }
    this.world.interactables = this.world.interactables.filter((item) => !item.taskRewardId);
    this.taskRewardDrops = [];
  }

  private recordPlayerTaskEvent(event: PlayerTaskEvent, amount = 1): void {
    const result = advancePlayerTasks(this.playerTasks, event, amount);
    this.playerTasks = result.states;
    for (const task of result.completed) {
      this.scrap += task.rewardScrap;
      this.gainXp(task.rewardXp);
      this.callbacks.onToast(`Tarefa concluída: ${task.title}. +${task.rewardXp} XP e +${task.rewardScrap} sucata.`, 'success');
    }
    const cycleResult = advanceTaskCycleEvent(this.taskCycle, event, amount);
    this.taskCycle = cycleResult.state;
    for (const task of cycleResult.completed) {
      this.gainXp(task.rewardXp);
      const drop: TaskRewardDrop = {
        id: `task-reward:${task.id}`, taskId: task.id, title: task.title,
        x: THREE.MathUtils.clamp(this.catPos.x + Math.sin(this.catYaw) * 2.4, -WORLD_BOUNDS + 4, WORLD_BOUNDS - 4),
        y: Math.max(0, this.catPos.y),
        z: THREE.MathUtils.clamp(this.catPos.z + Math.cos(this.catYaw) * 2.4, -WORLD_BOUNDS + 4, WORLD_BOUNDS - 4),
        amount: task.rewardScrap,
      };
      this.taskRewardDrops = [...this.taskRewardDrops.filter((item) => item.id !== drop.id), drop];
      this.spawnTaskRewardDrop(drop);
      this.callbacks.onToast(`Missão concluída: ${task.title}. +${task.rewardXp} XP. A recompensa física (${task.rewardScrap} sucatas) apareceu perto de Tomas.`, 'success');
    }
    this.saveGame();
  }

  public chooseDialogueOption(optionId: string): void {
    const state = this.activeDialogue;
    if (!state || state.ended) return;
    const context = this.buildDialogueContext(state.agentId);
    if (!context) return;
    const transition = chooseOption(state, optionId, context, DIALOGUE_DATA);
    if (!transition) return;
    for (const effect of transition.effects) this.applyDialogueEffect(state.agentId, effect);
    this.activeDialogue = transition.state;
    this.saveGame();
    this.syncHud();
  }

  public closeDialogue(): void {
    if (!this.activeDialogue) return;
    this.activeDialogue = null;
    if (this.phase === 'paused') this.phase = 'playing';
    this.syncHud();
  }

  public triggerInteract(): void {
    if (this.phase !== 'playing') return;
    if (!this.activeInteractableId) return;
    const item = this.world.interactables.find((i) => i.id === this.activeInteractableId);
    if (!item || !item.active) return;

    const def = EVOLUTION_STAGES[this.stageIndex];
    const maxHp = this.getEffectiveMaxHealth();
    const maxStam = this.getEffectiveMaxStamina();

    if (item.kind === 'food' || item.kind === 'prey' || item.kind === 'fish') {
      this.hunger = Math.min(def.maxHunger, this.hunger + item.amount);
      this.health = Math.min(maxHp, this.health + 12);
      this.gainXp(item.xpGain);
      this.foodCollected++;
      this.addBattleItem('ration', 1);
      this.recordPlayerTaskEvent('food_collected');
      item.active = false;
      item.mesh.visible = false;
      item.respawnTimer = item.maxRespawn;
      this.cat.triggerAction('eat');
      gameAudio.playEat();
      this.callbacks.onToast(item.kind === 'fish' ? `Peixe pescado: +${item.amount} Fome` : `+${item.amount} Fome (${item.name})`, 'success');
    } else if (item.kind === 'water') {
      this.thirst = Math.min(def.maxThirst, this.thirst + item.amount);
      this.stamina = Math.min(maxStam, this.stamina + 25);
      this.gainXp(item.xpGain);
      this.waterDrunk++;
      this.recordPlayerTaskEvent('water_drunk');
      item.active = false;
      item.mesh.visible = false;
      item.respawnTimer = item.maxRespawn;
      this.cat.triggerAction('drink');
      gameAudio.playDrink();
      this.callbacks.onToast(`+${item.amount} Sede (${item.name})`, 'success');
    } else if (item.kind === 'scrap' && item.taskRewardId) {
      this.scrap += item.amount;
      this.taskRewardDrops = this.taskRewardDrops.filter((drop) => drop.id !== item.taskRewardId);
      item.active = false;
      item.mesh.visible = false;
      this.cat.triggerAction('pounce');
      gameAudio.playCollectScrap();
      this.callbacks.onToast(`Recompensa recolhida: +${item.amount} sucatas.`, 'success');
      this.saveGame();
    } else if (item.kind === 'scrap') {
      this.scrap += item.amount;
      this.recordPlayerTaskEvent('scrap_collected', item.amount);
      this.gainXp(item.xpGain);
      item.active = false;
      item.mesh.visible = false;
      item.respawnTimer = item.maxRespawn;
      this.cat.triggerAction('pounce');
      gameAudio.playCollectScrap();
      this.callbacks.onToast('+1 Sucata Tecnológica coletada', 'info');
    } else if (item.kind === 'pickup' && item.itemId && isInventoryItemId(item.itemId)) {
      const itemId = item.itemId;
      const next = addInventoryItem(this.inventory, itemId, item.amount);
      const added = inventoryCount(next, itemId) - inventoryCount(this.inventory, itemId);
      if (added <= 0) {
        this.callbacks.onToast(`Inventário cheio: ${ITEM_CATALOG[itemId].name} já está no limite.`, 'warn');
        return;
      }
      this.inventory = next;
      item.active = false;
      item.mesh.visible = false;
      item.respawnTimer = item.maxRespawn;
      this.gainXp(item.xpGain);
      this.cat.triggerAction('pounce');
      this.callbacks.onToast(`+${added} · ${ITEM_CATALOG[itemId].name} guardado no inventário.`, 'success');
      this.saveGame();
    } else if (item.kind === 'shop') {
      this.openShopId = item.id.replace(/^shop-/, '');
      gameAudio.playCollectScrap();
    } else if (item.kind === 'shelter') {
      const lvl = item.shelterLevel || 1;
      this.warmth = def.maxWarmth;
      this.health = Math.min(maxHp, this.health + 35 * lvl);
      this.stamina = maxStam;
      this.gainXp(18);
      gameAudio.playMeow();
      if (isMoonTime(this.timeOfDay)) {
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

  public useInventoryItem(itemId: InventoryItemId): void {
    if (this.phase !== 'playing' || this.duelPhase === 'fighting') return;
    if (inventoryCount(this.inventory, itemId) <= 0) {
      this.callbacks.onToast('Você não possui esse item.', 'warn');
      return;
    }
    const definition = ITEM_CATALOG[itemId];
    if (definition.category !== 'consumable') {
      this.callbacks.onToast('Esse item é equipamento. Use a opção Equipar na mochila.', 'info');
      return;
    }
    const effect = definition.effect;
    const def = EVOLUTION_STAGES[this.stageIndex];
    let applied = 0;
    if (effect.kind === 'health') {
      const before = this.health;
      this.health = Math.min(this.getEffectiveMaxHealth(), this.health + effect.amount);
      applied = this.health - before;
    } else if (effect.kind === 'hunger') {
      const before = this.hunger;
      this.hunger = Math.min(def.maxHunger, this.hunger + effect.amount);
      applied = this.hunger - before;
    } else if (effect.kind === 'thirst') {
      const before = this.thirst;
      this.thirst = Math.min(def.maxThirst, this.thirst + effect.amount);
      applied = this.thirst - before;
    } else if (effect.kind === 'stamina') {
      const before = this.stamina;
      this.stamina = Math.min(this.getEffectiveMaxStamina(), this.stamina + effect.amount);
      applied = this.stamina - before;
    } else if (effect.kind === 'mana') {
      const before = this.battleMana;
      this.battleMana = Math.min(100, this.battleMana + effect.amount);
      applied = this.battleMana - before;
    }
    if (applied <= 0) {
      this.callbacks.onToast('Esse atributo já está cheio; o item foi preservado.', 'info');
      return;
    }
    const next = consumeInventoryItem(this.inventory, itemId);
    if (!next) return;
    this.inventory = next;
    if (effect.kind === 'thirst') {
      this.cat.triggerAction('drink');
      gameAudio.playDrink();
    } else {
      this.cat.triggerAction('eat');
      gameAudio.playEat();
    }
    this.callbacks.onToast(`${ITEM_CATALOG[itemId].name}: +${Math.round(applied)} ${effect.kind === 'health' ? 'Saúde' : effect.kind === 'thirst' ? 'Sede' : effect.kind === 'stamina' ? 'Resistência' : effect.kind === 'mana' ? 'Mana' : 'Fome'}.`, 'success');
    this.saveGame();
    this.syncHud();
  }

  public closeShop(): void {
    this.openShopId = null;
    this.syncHud();
  }

  public buyShopItem(itemId: InventoryItemId): void {
    if (this.phase !== 'playing' || this.duelPhase === 'fighting' || !this.openShopId) return;
    const stall = this.world.interactables.find((i) => i.id === `shop-${this.openShopId}`);
    if (!stall || this.catPos.distanceTo(stall.position) > 8) {
      this.openShopId = null;
      this.syncHud();
      return;
    }
    const result = purchaseItem({
      shopId: this.openShopId, itemId, coins: this.coins, level: this.level,
      timeOfDay: this.timeOfDay, inventory: this.inventory, equipment: this.equipment,
    });
    if (!result.ok) {
      this.callbacks.onToast(result.message, 'warn');
      return;
    }
    this.coins = result.coins;
    this.inventory = result.inventory;
    gameAudio.playCollectScrap();
    this.callbacks.onToast(`${ITEM_CATALOG[itemId].name} comprado por ${result.price} moedas.`, 'success');
    this.saveGame();
    this.syncHud();
  }

  private getShopHud(): ShopHud | null {
    if (!this.openShopId) return null;
    const shop = getShop(this.openShopId);
    const stall = this.world.interactables.find((i) => i.id === `shop-${this.openShopId}`);
    if (!shop || !stall || this.catPos.distanceTo(stall.position) > 9) {
      this.openShopId = null;
      return null;
    }
    const fmt = (h: number) => `${String(h).padStart(2, '0')}h`;
    return {
      id: shop.id, name: shop.name, open: isShopOpen(shop, this.timeOfDay), hours: `${fmt(shop.openHour)}–${fmt(shop.closeHour)}`,
      stock: shop.stock.map((entry) => ({ itemId: entry.itemId, price: entry.price, levelRequired: entry.levelRequired ?? 0 })),
    };
  }

  public equipInventoryItem(itemId: EquipmentItemId): void {
    if (this.phase !== 'playing' || this.duelPhase === 'fighting') return;
    const definition = ITEM_CATALOG[itemId];
    if (definition.category !== 'equipment') return;
    if (inventoryCount(this.inventory, itemId) <= 0) {
      this.callbacks.onToast('Você não possui esse equipamento.', 'warn');
      return;
    }
    const slot = definition.slot;
    const equipped = this.equipment[slot];
    if (equipped === itemId) {
      this.callbacks.onToast('Esse equipamento já está equipado.', 'info');
      return;
    }
    let nextInventory = consumeInventoryItem(this.inventory, itemId);
    if (!nextInventory) return;
    if (equipped) nextInventory = addInventoryItem(nextInventory, equipped, 1);
    this.inventory = nextInventory;
    this.equipment = { ...this.equipment, [slot]: itemId };
    this.callbacks.onToast(`${definition.name} equipado (${EQUIPMENT_SLOT_LABELS[slot]}). ${definition.description.replace(/^[^:]+: /, '')}`, 'success');
    this.saveGame();
    this.syncHud();
  }

  public unequipEquipment(slot: EquipmentSlot): void {
    if (this.phase !== 'playing' || this.duelPhase === 'fighting') return;
    const itemId = this.equipment[slot];
    if (!itemId) return;
    this.inventory = addInventoryItem(this.inventory, itemId, 1);
    this.equipment = { ...this.equipment, [slot]: null };
    this.health = Math.min(this.health, this.getEffectiveMaxHealth());
    this.stamina = Math.min(this.stamina, this.getEffectiveMaxStamina());
    this.callbacks.onToast(`${ITEM_CATALOG[itemId].name} removido e devolvido à mochila.`, 'info');
    this.saveGame();
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
    this.recordPlayerTaskEvent('shelter_upgraded');
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
      this.unlockMovesForLevel(prevLevel);
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

  private unlockMovesForLevel(previousLevel: number): void {
    const newlyUnlocked = getNewlyUnlockedMoves(previousLevel, this.level);
    for (const move of newlyUnlocked) {
      if (this.unlockedMoves.has(move.id)) continue;
      this.unlockedMoves.add(move.id);
      this.callbacks.onToast(`Nova técnica aprendida: ${move.name}!`, 'success');
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
    // Na tela de título não há personagem em jogo: gravar aqui sobrescrevia o
    // progresso real (local e remoto) com um personagem novo de nível 1.
    if (this.phase === 'title') return;
    try {
      const shelterLevels: Record<string, number> = {};
      this.world.interactables.forEach((item) => {
        if (item.kind === 'shelter') shelterLevels[item.id] = item.shelterLevel || 1;
      });
      this.worldTravel = updateActiveWorldPosition(this.worldTravel, { x: this.catPos.x, z: this.catPos.z });
      const payload: SavedGameState = {
        society: {
          schemaVersion: 1,
          worlds: Object.fromEntries(PLAYABLE_WORLD_IDS.map((worldId) => [worldId, {
            simulation: this.societyRegistry.simulationFor(worldId).exportState(),
            agents: this.agentRuntimeRegistry.runtimeFor(worldId).exportState(),
          }])),
        },
        stageIndex: this.stageIndex,
        level: this.level,
        stars: this.stars,
        starProgress: this.starProgress,
        chances: this.chances,
        scrap: this.scrap,
        coins: this.coins,
        battleMana: this.battleMana,
        battleInventory: this.battleInventory,
        inventory: this.inventory,
        equipment: this.equipment,
        taskRewardDrops: this.taskRewardDrops,
        unlockedMoves: Array.from(this.unlockedMoves),
        dialogueRelations: Object.fromEntries(this.dialogueRelations),
        dialogueFlags: Object.fromEntries(this.dialogueFlags),
        acceptedDialogueTasks: Array.from(this.acceptedDialogueTasks),
        playerTasks: this.playerTasks,
        taskCycle: this.taskCycle,
        worldTravel: this.worldTravel,
        day: this.day,
        timeOfDay: this.timeOfDay,
        currentPhase: this.currentPhase,
        defeatedBosses: Array.from(this.defeatedBosses),
        conqueredTerritories: Array.from(this.conqueredTerritories),
        health: this.health,
        hunger: this.hunger,
        thirst: this.thirst,
        warmth: this.warmth,
        oxygen: this.oxygen,
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
      localStorage.setItem(this.saveKey, JSON.stringify(payload));
      this.callbacks.onSaveGame?.(payload);
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
      } else if (this.duelPhase === 'fighting' && ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'].includes(code)) {
        const map: Record<string, BattleCommand | 'forfeit'> = { Digit1: 'attack', Digit2: 'flurry', Digit3: 'guard', Digit4: 'limit', Digit5: 'forfeit', Digit6: 'combo_a', Digit7: 'combo_b', Digit8: 'magic' };
        const cmd = map[code];
        if (cmd === 'forfeit') this.forfeitDuel();
        else this.battleCommand(cmd);
      } else if (code === 'Digit9' && this.duelPhase === 'fighting') {
        this.activateComboBreaker();
      } else if (code === 'KeyI' && this.duelPhase === 'fighting') {
        this.battleCommand('item');
      } else if (code === 'KeyT' && this.duelPhase === 'fighting' && this.battle) {
        // Troca o alvo entre os oponentes de pé.
        const alive = livingFoes(this.battle);
        if (alive.length > 1) {
          const i = this.battleTarget ? alive.indexOf(this.battleTarget) : -1;
          this.battleTarget = alive[(i + 1) % alive.length];
        }
      } else if (code === 'KeyB') {
        if (this.duelPhase === 'offer') this.cancelDuelOffer();
        else if (this.duelPhase === 'idle') this.challengeNearest();
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
      if (this.duelPhase === 'idle' && this.pickAndTalk(e.clientX, e.clientY)) return;
      this.triggerClawAttack();
    } else if (
      hadSingle &&
      this.pointerDownType !== 'mouse' &&
      this.phase === 'playing' &&
      this.duelPhase === 'idle' &&
      this.pointerMovedDist < 8
    ) {
      this.pickAndTalk(e.clientX, e.clientY);
    }
    if (this.activePointers.size === 0) {
      this.isDraggingCamera = false;
    }
  };

  private pickAndTalk(clientX: number, clientY: number): boolean {
    const id = this.pickResidentAt(clientX, clientY);
    return id ? this.startDialogueWith(id) : false;
  }

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
      this.cat.update(dt, 0, true, false, false, false, false, 0, false, this.elapsed);
      this.updateEnvironmentLighting(dt);
    } else if (this.phase === 'playing') {
      if (this.duelPhase === 'fighting') this.updateBattle(dt);
      else this.updateGameplay(dt);
      this.updateTaskGpsRoute();
      this.societyTickTimer += dt;
      while (this.societyTickTimer >= 1) {
        const frame = this.agentRuntime.step(this.society, 1);
        if (frame.registeredProjectIds.length > 0 && frame.directive) {
          this.callbacks.onToast(frame.directive.brief, 'info');
        }
        this.societyTickTimer -= 1;
      }
      // Persiste a evolução autônoma mesmo quando o jogador não executa ações.
      this.societySaveTimer += dt;
      if (this.societySaveTimer >= 30) {
        this.saveGame();
        this.societySaveTimer = 0;
      }
      this.societyActors.update(dt, this.snapshotForActors(), true);
    } else {
      // Durante a conversa o habitante permanece visível para ancorar o balão.
      this.societyActors.update(dt, this.society.snapshot(), this.activeDialogue !== null);
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

  private updateWaterBubbles(dt: number, water: WaterSample): void {
    const active = water.inWater && water.submerged && this.phase === 'playing';
    this.bubblePoints.visible = active;
    if (!active) {
      this.bubbleLife.fill(0);
      for (let i = 0; i < this.bubbleLife.length; i++) this.bubblePositions[i * 3 + 1] = -1000;
      (this.bubblePoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      this.bubbleSpawnTimer = 0;
      this.bubbleAudioTimer = 0;
      return;
    }

    this.bubbleSpawnTimer -= dt;
    if (this.bubbleSpawnTimer <= 0) {
      const slot = this.bubbleLife.findIndex((life) => life <= 0);
      if (slot >= 0) {
        this.bubbleLife[slot] = 1.1 + Math.random() * 0.7;
        this.bubblePositions[slot * 3] = this.catPos.x + (Math.random() - 0.5) * 0.42;
        this.bubblePositions[slot * 3 + 1] = this.catPos.y + 0.2 + Math.random() * 0.25;
        this.bubblePositions[slot * 3 + 2] = this.catPos.z + (Math.random() - 0.5) * 0.42;
      }
      this.bubbleSpawnTimer = 0.13 + Math.random() * 0.12;
    }

    for (let i = 0; i < this.bubbleLife.length; i++) {
      if (this.bubbleLife[i] <= 0) continue;
      this.bubbleLife[i] = Math.max(0, this.bubbleLife[i] - dt);
      if (this.bubbleLife[i] <= 0) {
        this.bubblePositions[i * 3 + 1] = -1000;
        continue;
      }
      this.bubblePositions[i * 3 + 1] += dt * (0.42 + (1 - this.bubbleLife[i]) * 0.12);
      this.bubblePositions[i * 3] += Math.sin(this.elapsed * 4 + i) * dt * 0.035;
    }
    (this.bubblePoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    this.bubbleAudioTimer -= dt;
    if (this.bubbleAudioTimer <= 0) {
      gameAudio.playSwimBubbles();
      this.bubbleAudioTimer = 0.72;
    }
  }

  private getTaskGpsTarget(): TaskGpsTarget | null {
    const objectives: Array<{ event: PlayerTaskEvent; objective: string; taskTitle: string }> = [];
    // Recompensas físicas de missões concluídas têm prioridade: não basta avisar
    // que existem sucatas no mundo, o GPS também precisa conduzir Tomas até elas.
    if (this.taskRewardDrops.length > 0) {
      objectives.push({
        event: 'scrap_collected',
        objective: 'Recolha a recompensa física da missão',
        taskTitle: 'Recompensa pendente',
      });
    }
    for (const task of this.playerTasks) {
      if (task.status !== 'active') continue;
      const definition = getPlayerTaskDefinition(task.id);
      if (definition) objectives.push({ event: definition.event, objective: definition.description, taskTitle: definition.title });
    }
    const cycleTask = this.taskCycle.tasks.find((candidate) => candidate.status === 'active');
    const cycleStage = cycleTask?.stages[cycleTask.stageIndex];
    if (cycleTask && cycleStage) {
      objectives.push({ event: cycleStage.event, objective: cycleStage.label, taskTitle: cycleTask.title });
    }
    if (objectives.length === 0) return null;

    const candidates: TaskGpsCandidate[] = this.taskRewardDrops.map((drop) => ({
      id: drop.id,
      label: `Recompensa: ${drop.title} (+${drop.amount} sucatas)`,
      event: 'scrap_collected',
      x: drop.x,
      y: drop.y,
      z: drop.z,
    }));
    for (const item of this.world.interactables) {
      if (!item.active || item.taskRewardId) continue;
      const event = item.kind === 'food' || item.kind === 'prey' || item.kind === 'fish'
        ? 'food_collected'
        : item.kind === 'water' ? 'water_drunk'
          : item.kind === 'scrap' ? 'scrap_collected'
            : item.kind === 'shelter' ? 'shelter_upgraded' : null;
      if (event) candidates.push({ id: item.id, label: item.name, event, x: item.position.x, y: item.position.y, z: item.position.z });
    }
    if (objectives.some((objective) => objective.event === 'enemy_defeated')) {
      for (const predator of this.world.predators) {
        if (predator.alive && !predator.isFriendly) candidates.push({ id: predator.id, label: predator.name, event: 'enemy_defeated', x: predator.group.position.x, y: predator.group.position.y, z: predator.group.position.z });
      }
    }
    return selectFirstAvailableTaskGpsTarget(
      objectives,
      { x: this.catPos.x, z: this.catPos.z },
      candidates,
    );
  }

  private updateTaskGpsRoute(): void {
    const target = this.getTaskGpsTarget();
    if (!target || this.duelPhase === 'fighting') {
      this.gpsRoute.visible = false;
      this.gpsRoutePath = [];
      this.gpsRouteTargetId = null;
      return;
    }
    const startCell = `${Math.floor((this.catPos.x + WORLD_BOUNDS) / 4)}:${Math.floor((this.catPos.z + WORLD_BOUNDS) / 4)}`;
    const targetMoved = Math.hypot(target.x - this.gpsRouteTargetPosition.x, target.z - this.gpsRouteTargetPosition.z) > 3;
    const needsRoute = target.id !== this.gpsRouteTargetId || startCell !== this.gpsRouteStartCell || targetMoved || this.gpsRoutePath.length < 2;
    if (needsRoute) {
      const elevated = Math.max(target.y, this.catPos.y) > 1.8 || Math.abs(target.y - this.catPos.y) > 1.8;
      if (elevated) {
        this.gpsRoutePath = [{ x: this.catPos.x, z: this.catPos.z }, { x: target.x, z: target.z }];
      } else {
        const obstacles = this.world.colliders
          .filter((box) => box.topY > 0 && (box.minY ?? 0) <= 0.25)
          .map((box) => ({ minX: box.minX, maxX: box.maxX, minZ: box.minZ, maxZ: box.maxZ }));
        const route = findGridRoute(
          { x: this.catPos.x, z: this.catPos.z },
          { x: target.x, z: target.z },
          obstacles,
          { bounds: WORLD_BOUNDS, cellSize: 4, clearance: 0.9, maxExpanded: 18000 },
        );
        this.gpsRoutePath = route.length >= 2 ? route : []; 
      }
      this.gpsRouteTargetId = target.id;
      this.gpsRouteStartCell = startCell;
      this.gpsRouteTargetPosition = { x: target.x, z: target.z };
    }
    if (this.gpsRoutePath.length < 2) {
      this.gpsRoute.visible = false;
      return;
    }
    const pointCount = Math.min(this.gpsRoutePath.length, this.gpsRoutePositions.length / 3);
    for (let i = 0; i < pointCount; i++) {
      const point = this.gpsRoutePath[i];
      const offset = i * 3;
      this.gpsRoutePositions[offset] = i === 0 ? this.catPos.x : i === pointCount - 1 ? target.x : point.x;
      this.gpsRoutePositions[offset + 1] = i === 0
        ? Math.max(0.22, this.catPos.y + 0.25)
        : i === pointCount - 1 ? Math.max(0.22, target.y + 0.25) : 0.22;
      this.gpsRoutePositions[offset + 2] = i === 0 ? this.catPos.z : i === pointCount - 1 ? target.z : point.z;
    }
    this.gpsRoute.geometry.setDrawRange(0, pointCount);
    (this.gpsRoute.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.gpsRoute.geometry.computeBoundingSphere();
    this.gpsRoute.visible = pointCount >= 2;
  }

  private updateGameplay(dt: number): void {
    const cycleTick = tickTaskCycle(this.taskCycle, dt);
    this.taskCycle = cycleTick.state;
    if (cycleTick.created.length > 0) {
      for (const task of cycleTick.created) this.callbacks.onToast(`Nova missão disponível: ${task.title}.`, 'info');
      this.saveGame();
    }
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
    const headHeight = 0.7 * def.scale;
    this.waterSample = sampleExpandedWater(
      this.world.waterBodies,
      this.world.rivers,
      this.catPos.x,
      this.catPos.y,
      this.catPos.z,
      headHeight,
      dt,
    );
    const water = this.waterSample;
    const shiftHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.virtualSprint;
    // Na água, Shift/sprint vira mergulho e não gasta energia de corrida.
    const wantsSprint = !water.inWater && shiftHeld && inputLen > 0.1 && this.stamina > 2;
    if (this.swimAscendTimer > 0) this.swimAscendTimer = Math.max(0, this.swimAscendTimer - dt);

    if (wantsSprint || this.isClimbing) {
      this.stamina = Math.max(0, this.stamina - (this.isClimbing ? 11 : 20) * dt);
    } else {
      const recoveryFactor = this.hunger < 15 || this.thirst < 15 ? 0.45 : 1;
      this.stamina = Math.min(
        maxStamina,
        this.stamina + (this.isInsideShelter ? 32 : 16) * recoveryFactor * dt,
      );
    }

    const hungerMobility = this.hunger < 15 ? 0.78 : this.hunger < 35 ? 0.9 : 1;
    const thirstMobility = this.thirst < 15 ? 0.72 : this.thirst < 35 ? 0.88 : 1;
    const exhaustionMobility = this.stamina < 8 ? 0.78 : this.stamina < 20 ? 0.9 : 1;
    const survivalMobility = Math.min(hungerMobility, thirstMobility, exhaustionMobility);
    const targetSpeed =
      inputLen > 0.04
        ? def.moveSpeed *
          (wantsSprint ? def.sprintMultiplier : 1) *
          survivalMobility *
          Math.min(1, inputLen)
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

      const waterFactor = !water.inWater
        ? 1
        : water.submerged
          ? SWIM_UNDERWATER_SPEED_FACTOR
          : SWIM_SURFACE_SPEED_FACTOR;
      const stepDist = Math.max(this.currentSpeed, targetSpeed * 0.4) * dt * waterFactor;
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

      if (this.isGrounded && !this.isClimbing && !water.inWater) {
        gameAudio.playStep(wantsSprint);
      }
    } else {
      // Immediately release wall grip when no longer pushing
      this.isClimbing = false;
    }

    // Correnteza suave: deslocamento determinístico proporcional ao delta real do frame.
    if (water.inWater && water.river && (water.currentDx !== 0 || water.currentDz !== 0)) {
      const pushedX = THREE.MathUtils.clamp(this.catPos.x + water.currentDx, -WORLD_BOUNDS, WORLD_BOUNDS);
      const pushedZ = THREE.MathUtils.clamp(this.catPos.z + water.currentDz, -WORLD_BOUNDS, WORLD_BOUNDS);
      if (!this.checkHorizontalCollision(pushedX, this.catPos.z, catRadius)) this.catPos.x = pushedX;
      if (!this.checkHorizontalCollision(this.catPos.x, pushedZ, catRadius)) this.catPos.z = pushedZ;
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
    } else if (water.inWater && water.body) {
      // Natação: flutua por padrão; Shift mergulha, Espaço sobe.
      this.wasSwimming = true;
      this.catVelY = swimVerticalVelocity(this.catPos.y, headHeight, water.body.surfaceY, {
        ascend: this.keys.has('Space') || this.swimAscendTimer > 0,
        dive: shiftHeld,
      });
      this.catPos.y = Math.max(water.floorY, this.catPos.y + this.catVelY * dt);
      this.peakFallSpeed = 0;
      this.isGrounded = false;
      this.jumpsUsed = 0;
      this.coyoteTimer = 0.14;
    } else {
      this.catVelY -= 25 * dt;
      if (this.catVelY < this.peakFallSpeed) {
        this.peakFallSpeed = this.catVelY;
      }
      this.catPos.y += this.catVelY * dt;

      // Dentro de uma bacia o "chão" é o fundo; fora, é a rua (y = 0).
      let groundHeight = water.floorY;
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

      if (this.wasSwimming && groundHeight - this.catPos.y > 0.02) {
        // Saindo da água: sobe suavemente até a calçada em vez de teleportar.
        this.catPos.y = Math.min(groundHeight, this.catPos.y + 5 * dt);
        this.catVelY = 0;
        this.peakFallSpeed = 0;
        this.isGrounded = true;
      } else if (this.catPos.y <= groundHeight) {
        this.wasSwimming = false;
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
      water.inWater,
      this.catVelY,
      this.isInsideShelter && isMoonTime(this.timeOfDay),
      this.elapsed,
    );

    this.updateWaterBubbles(dt, water);

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

    this.updateDuel(dt);
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
      const maxR = this.getSonarRadius();
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

      if (item.kind === 'scrap' || item.kind === 'food' || item.kind === 'fish') {
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
      if (this.sonarRevealTimer > 0 && dist <= this.getSonarRadius()) {
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
    const isNight = isMoonTime(this.timeOfDay) || this.timeOfDay > 0.75;
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

    // Oxigênio real: consome com a cabeça submersa, recupera na superfície
    // e causa afogamento quando acaba (lógica pura em survival/water.ts).
    const air = stepOxygen(this.oxygen, this.waterSample.submerged, dt);
    this.oxygen = air.oxygen;
    if (air.drowningDamage > 0) {
      this.health -= air.drowningDamage;
      this.lastThreatCause = 'Afogamento';
    }
    if (air.warning && !this.oxygenWarned) {
      this.oxygenWarned = true;
      this.callbacks.onToast('Oxigênio baixo! Suba para a superfície e respire.', 'warn');
    } else if (!air.warning && this.oxygen > 60) {
      this.oxygenWarned = false;
    }
    this.underwaterBlend = THREE.MathUtils.damp(this.underwaterBlend, this.waterSample.submerged ? 1 : 0, 6, dt);

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
    // Sol visível acima do horizonte; estrelas aparecem conforme o dia escurece.
    const sunDir = new THREE.Vector3(Math.cos(sunAngle) * 0.8, sunElev, -0.6).normalize();
    this.sunMesh.position.set(
      this.catPos.x + sunDir.x * 430,
      sunDir.y * 430,
      this.catPos.z + sunDir.z * 430,
    );
    this.sunMesh.visible = sunElev > -0.06 && this.weather === 'clear';
    (this.sunMesh.material as THREE.MeshBasicMaterial).color
      .setHex(0xfff1c2)
      .lerp(_sunsetColor, 1 - THREE.MathUtils.clamp(sunElev / 0.5, 0, 1));
    const starOpacity = this.weather === 'clear' ? THREE.MathUtils.clamp(1 - daylight * 1.6, 0, 1) : 0;
    this.starField.visible = starOpacity > 0.02;
    const starTwinkle = 0.9 + Math.sin(this.elapsed * 1.7) * 0.04 + Math.sin(this.elapsed * 2.9 + 1.2) * 0.03;
    (this.starField.material as THREE.PointsMaterial).opacity = starOpacity * starTwinkle;
    this.starField.position.set(this.catPos.x, 0, this.catPos.z);
    const weatherLightFactor =
      this.weather === 'freezing' ? 0.58 :
      this.weather === 'cold_wind' ? 0.7 :
      this.weather === 'rain' ? 0.82 :
      this.weather === 'snow' ? 0.9 : 1;
    this.sunLight.intensity = (0.62 + daylight * 1.55) * weatherLightFactor;
    const horizonWarmth = daylight > 0 ? 1 - THREE.MathUtils.clamp(Math.abs(sunElev) / 0.4, 0, 1) : 0;
    this.sunLight.color.setHex(0xfff1d6).lerp(_sunsetColor, horizonWarmth * 0.8);
    this.hemiLight.intensity = (1.55 + daylight * 0.45) * (this.weather === 'freezing' ? 0.76 : 1);

    // The moon rises during the night and its direct glow awakens Tomas's lunar strength.
    const isNight = isMoonTime(this.timeOfDay);
    const nightProgress = moonProgress(this.timeOfDay);
    const moonStrength = isNight
      ? THREE.MathUtils.clamp(0.76 + Math.sin(nightProgress * Math.PI) * 0.24, 0, 1)
      : 0;
    this.moonMesh.position.set(this.catPos.x + 40, 68, this.catPos.z - 65);
    this.moonLight.position.copy(this.moonMesh.position);
    this.moonMesh.visible = moonStrength > 0.08;
    const skySample = sampleSkyAtmosphere(this.day, this.timeOfDay, this.weather);
    this.moonLight.intensity = moonStrength * 3.6 * skySample.moonIllumination;
    this.skyVisuals.update(
      dt,
      this.catPos.x,
      this.catPos.z,
      skySample,
      this.moonMesh,
      this.sunMesh,
      this.duelPhase === 'fighting' || this.battle !== null,
    );
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
    else _skyColor.setHex(skyColorAt(this.timeOfDay));
    if (this.weather === 'rain') _skyColor.lerp(_rainColor, 0.42);
    if (this.weather === 'snow') _skyColor.lerp(_snowColor, 0.34);
    if (this.weather === 'cold_wind' || this.weather === 'freezing') _skyColor.lerp(_stormColor, this.weather === 'freezing' ? 0.62 : 0.44);

    (this.scene.background as THREE.Color).lerp(_skyColor, 1 - Math.exp(-2.5 * dt));
    const skyMat = this.world.skyDome.material as THREE.MeshBasicMaterial;
    skyMat.color.setHex(this.weather === 'acid_rain' ? 0x6ee7b7 : 0xffffff).lerp(
      this.scene.background as THREE.Color,
      1,
    );

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.scene.background as THREE.Color);
      const targetFog =
        this.weather === 'acid_rain' ? 0.0085 :
        this.weather === 'freezing' ? 0.007 :
        this.weather === 'snow' ? 0.0055 :
        this.weather === 'rain' || this.weather === 'cold_wind' ? 0.004 : 0.002;
      this.baseFogDensity = THREE.MathUtils.damp(this.baseFogDensity, targetFog, 2, dt);
      // Debaixo d'água: névoa azul-esverdeada densa.
      this.scene.fog.color.lerp(_underwaterColor, this.underwaterBlend);
      this.scene.fog.density = this.baseFogDensity + (0.07 - this.baseFogDensity) * this.underwaterBlend;
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

    if (item.kind === 'food' || item.kind === 'prey' || item.kind === 'fish') {
      return {
        id: item.id,
        kind: item.kind,
        label: item.name,
        detail: `+${item.amount} Fome · +${item.xpGain} XP`,
        actionText: item.kind === 'fish' ? 'Pescar' : 'Comer',
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
        detail: item.taskRewardId ? `+${item.amount} Sucatas · Recompensa de missão` : `+${item.amount} Sucata para Abrigo`,
        actionText: 'Coletar',
      };
    }
    if (item.kind === 'pickup' && item.itemId && isInventoryItemId(item.itemId)) {
      const definition = ITEM_CATALOG[item.itemId];
      return {
        id: item.id,
        kind: item.kind,
        itemId: item.itemId,
        label: item.name,
        detail: definition.description,
        actionText: 'Guardar',
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
    if (item.kind === 'shop') {
      const shop = getShop(item.id.replace(/^shop-/, ''));
      const open = shop ? isShopOpen(shop, this.timeOfDay) : false;
      return {
        id: item.id,
        kind: item.kind,
        label: item.name,
        detail: open ? 'Compre poções, armas, armaduras e aparatos com moedas' : `Fechada agora · abre às ${shop ? String(shop.openHour).padStart(2, '0') : '--'}h`,
        actionText: 'Ver mercadorias',
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
    const radarRange = this.sonarRevealTimer > 0 ? this.getSonarRadius() : 36;
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

    const dialogueNode = this.activeDialogue
      ? DIALOGUE_DATA.find((node) => node.id === this.activeDialogue?.nodeId)
      : undefined;
    const dialogueContext = this.activeDialogue && !this.activeDialogue.ended
      ? this.buildDialogueContext(this.activeDialogue.agentId)
      : null;
    const dialogueOptions = dialogueNode && dialogueContext
      ? availableOptions(dialogueNode, dialogueContext)
      : [];

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
      oxygen: this.oxygen,
      maxOxygen: 100,
      level: this.level,
      stars: this.stars,
      starProgress: this.starProgress,
      starNext: this.getStarNext(),
      unlockedMoves: Array.from(this.unlockedMoves),
      activeDialogue: this.activeDialogue,
      activeDialogueOptions: dialogueOptions,
      dialogueAnchor: this.getDialogueAnchor(),
      shop: this.getShopHud(),
      playerTasks: this.playerTasks.map((task) => { const definition = getPlayerTaskDefinition(task.id)!; return { ...task, title: definition.title, description: definition.description, target: definition.target }; }),
      cycleTasks: [
        ...this.taskCycle.tasks.filter((task) => task.status === 'active').slice(0, 3),
        ...this.taskCycle.tasks.filter((task) => task.status === 'completed').slice(-2),
      ].map((task) => ({ ...task, currentStage: task.stages[task.stageIndex] })),
      secondsToNextTask: Math.max(0, 600 - this.taskCycle.activeSeconds),
      gpsTarget: this.getTaskGpsTarget(),
      inventory: this.inventory,
      equipment: this.equipment,
      pendingTaskRewards: this.taskRewardDrops.length,
      isAlphaLeader: this.level >= MAX_CAT_LEVEL,
      rankTitle: this.getRankTitle(),
      attackPower: this.getCurrentAttackDamage(),
      stageIndex: this.stageIndex,
      scrap: this.scrap,
      coins: this.coins,
      duel: this.buildDuelHud(),
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
    this.saveGame();
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

    this.battleStage.dispose();
    this.gpsRoute.geometry.dispose();
    (this.gpsRoute.material as THREE.Material).dispose();
    this.societyActors.dispose();
    this.skyVisuals.dispose();
    this.worldSceneManager.dispose();
    this.textures.dispose();
    // THREE.Points is not covered by the Mesh-only traversal below.
    // Dispose the pooled underwater particle resources explicitly.
    this.bubblePoints.geometry.dispose();
    const bubbleMaterial = this.bubblePoints.material;
    if (Array.isArray(bubbleMaterial)) {
      bubbleMaterial.forEach((material) => material.dispose());
    } else {
      bubbleMaterial.dispose();
    }
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
