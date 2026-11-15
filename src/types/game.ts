import type { DialogueState } from '../game/dialogue/types';
import type { BattleInventoryItem } from '../game/battle/commands';

export type GamePhase = 'title' | 'playing' | 'paused' | 'fallen' | 'gameover' | 'victory';

export type WeatherState =
  | 'clear'
  | 'rain'
  | 'snow'
  | 'cold_wind'
  | 'freezing'
  | 'acid_warning'
  | 'acid_rain';

export type InteractionKind =
  | 'food'
  | 'prey'
  | 'fish'
  | 'water'
  | 'shelter'
  | 'scrap'
  | 'terminal';

export type EnemyKind = 'rat' | 'feral_cat' | 'hound' | 'lion';

export const MAX_CAT_LEVEL = 99;
export const MAX_CHANCES = 5;

export interface ChapterPhaseDef {
  phase: number;
  title: string;
  sectorName: string;
  objective: string;
  bossName: string;
  bossKind: EnemyKind;
  bossPos: [number, number];
}

export const CHAPTER_PHASES: ChapterPhaseDef[] = [
  {
    phase: 1,
    title: 'Fase 1 · Subúrbio em Quarentena',
    sectorName: 'Rua da Quarentena',
    objective: 'Sobreviva, dispute telhados contra gatos rivais e derrote o Rei Rato Gigante.',
    bossName: 'Rei Rato Gigante',
    bossKind: 'rat',
    bossPos: [0, -58],
  },
  {
    phase: 2,
    title: 'Fase 2 · Prédios & Telhados',
    sectorName: 'Bairro dos Telhados',
    objective: 'Escale prédios, vença os gatos dominantes dos telhados e derrote o Gato Cicatriz.',
    bossName: 'Gato Selvagem Cicatriz',
    bossKind: 'feral_cat',
    bossPos: [118, -6],
  },
  {
    phase: 3,
    title: 'Fase 3 · Hospital & Aqueduto',
    sectorName: 'Complexo Submerso',
    objective: 'Domine as coberturas do hospital e enfrente o Cão Alfa Cibernético.',
    bossName: 'Cão Alfa Cibernético',
    bossKind: 'hound',
    bossPos: [-120, 4],
  },
  {
    phase: 4,
    title: 'Fase 4 · Arena do Bio-Domo',
    sectorName: 'Estádio Devastado',
    objective: 'Alcance o nível máximo, conquiste o estádio e derrote o Leão Apex.',
    bossName: 'Leão Apex da Tempestade',
    bossKind: 'lion',
    bossPos: [0, 128],
  },
];

export interface EvolutionStageDef {
  level: number;
  minCatLevel: number;
  name: string;
  subtitle: string;
  scale: number;
  moveSpeed: number;
  sprintMultiplier: number;
  jumpForce: number;
  attackDamage: number;
  maxHealth: number;
  maxHunger: number;
  maxThirst: number;
  maxWarmth: number;
  maxStamina: number;
  sonarRadius: number;
  acidResistance: number;
  canDoubleJump: boolean;
  canEmpPulse: boolean;
  abilities: string[];
  eyeColor: number;
  accentColor: number;
}

export const EVOLUTION_STAGES: EvolutionStageDef[] = [
  {
    level: 1,
    minCatLevel: 1,
    name: 'Filhote Abandonado',
    subtitle: 'Pequeno, ágil, escala paredes e sempre cai em pé (Nv. 1–14)',
    scale: 0.74,
    moveSpeed: 8.2,
    sprintMultiplier: 1.55,
    jumpForce: 9.4,
    attackDamage: 18,
    maxHealth: 100,
    maxHunger: 100,
    maxThirst: 100,
    maxWarmth: 100,
    maxStamina: 100,
    sonarRadius: 34,
    acidResistance: 0,
    canDoubleJump: false,
    canEmpPulse: false,
    abilities: ['Azunhar', 'Subir Paredes', 'Cair sempre em pé', 'Miar para distrair'],
    eyeColor: 0xf59e0b,
    accentColor: 0xf59e0b,
  },
  {
    level: 2,
    minCatLevel: 15,
    name: 'Gato Sobrevivente',
    subtitle: 'Garras firmes para disputar telhados contra rivais (Nv. 15–34)',
    scale: 0.94,
    moveSpeed: 9.8,
    sprintMultiplier: 1.65,
    jumpForce: 10.8,
    attackDamage: 28,
    maxHealth: 135,
    maxHunger: 120,
    maxThirst: 120,
    maxWarmth: 115,
    maxStamina: 130,
    sonarRadius: 50,
    acidResistance: 0.25,
    canDoubleJump: false,
    canEmpPulse: false,
    abilities: ['Garras afiadas', 'Escalada rápida em prédios', 'Coleira ótica'],
    eyeColor: 0x38bdf8,
    accentColor: 0x06b6d4,
  },
  {
    level: 3,
    minCatLevel: 35,
    name: 'Felino Cibernético',
    subtitle: 'Implantes dorsais, garras de titânio e salto duplo (Nv. 35–64)',
    scale: 1.15,
    moveSpeed: 11.4,
    sprintMultiplier: 1.75,
    jumpForce: 12.2,
    attackDamage: 42,
    maxHealth: 175,
    maxHunger: 145,
    maxThirst: 145,
    maxWarmth: 135,
    maxStamina: 160,
    sonarRadius: 72,
    acidResistance: 0.55,
    canDoubleJump: true,
    canEmpPulse: false,
    abilities: ['Salto Duplo no ar', 'Garras de Titânio', 'Sonar amplo (72m)'],
    eyeColor: 0x22d3ee,
    accentColor: 0x22d3ee,
  },
  {
    level: 4,
    minCatLevel: 65,
    name: 'Guardião Apex',
    subtitle: 'Predador supremo — rumo ao Nível 99 Gato Líder & Alpha (Nv. 65–99)',
    scale: 1.38,
    moveSpeed: 13.0,
    sprintMultiplier: 1.85,
    jumpForce: 13.5,
    attackDamage: 62,
    maxHealth: 230,
    maxHunger: 175,
    maxThirst: 175,
    maxWarmth: 165,
    maxStamina: 200,
    sonarRadius: 95,
    acidResistance: 0.85,
    canDoubleJump: true,
    canEmpPulse: true,
    abilities: ['Pulso EMP/Choque', 'Escudo anti-ácido', 'Nível 99: Líder & Alpha'],
    eyeColor: 0x10b981,
    accentColor: 0x10b981,
  },
];

export interface PromptInfo {
  id: string;
  kind: InteractionKind;
  label: string;
  detail: string;
  actionText: string;
  secondaryLabel?: string;
  canUpgrade?: boolean;
  upgradeCost?: number;
}

export interface RadarBlip {
  id: string;
  kind: InteractionKind | 'enemy' | 'boss' | 'rival';
  dx: number;
  dz: number;
}

export interface LoreLog {
  id: string;
  title: string;
  sector: string;
  content: string;
}

export interface BossHudInfo {
  name: string;
  kind: EnemyKind;
  isRivalCat?: boolean;
  rivalLevel?: number;
  hp: number;
  maxHp: number;
  distance: number;
}

export type DuelStakeKind = 'coins' | 'item' | 'vitality' | 'oxygen';

export interface DuelFoeHud {
  side: 'opponent' | 'opponent2' | 'opponent3' | 'opponent4';
  name: string;
  vigor: number;
  atb: number;
  guard: boolean;
  fallen: boolean;
}

export interface DuelHud {
  phase: 'offer' | 'fighting' | 'result';
  opponentName: string;
  stakeText: string;
  /** Vigor mostrado (cai no instante do impacto). */
  playerVigor: number;
  opponentVigor: number;
  /** Barras ATB e LIMIT (0–100). */
  playerAtb: number;
  opponentAtb: number;
  playerLimit: number;
  /** Aguardando o comando do jogador. */
  awaitingCommand: boolean;
  intro: boolean;
  banner: { text: string; id: number } | null;
  darkness: number;
  flash: number;
  playerGuard: boolean;
  opponentGuard: boolean;
  /** Todos os oponentes da batalha (1 a 4). */
  foes: DuelFoeHud[];
  /** Alvo selecionado do jogador (em grupo). */
  targetSide: 'opponent' | 'opponent2' | 'opponent3' | 'opponent4' | null;
  /** Maná guardado de batalhas vencidas (0–100). */
  storedMana: number;
  /** Quantos habitantes por perto podem entrar num duelo em grupo (0–4). */
  groupAvailable: number;
  /** Limites que o jogador pode apostar agora (já aplicando as regras de segurança). */
  limits: { coins: number; scrap: number; vitality: number; oxygen: number };
  defaultCoins: number;
  resultText: string;
  resultWon: boolean | null;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  thirst: number;
  maxThirst: number;
  warmth: number;
  maxWarmth: number;
  stamina: number;
  maxStamina: number;
  oxygen: number;
  maxOxygen: number;
  level: number; // 1..99
  stars: number;
  starProgress: number;
  starNext: number;
  unlockedMoves: string[];
  /** Campos opcionais para ativação gradual dos diálogos e itens de batalha. */
  activeDialogue?: DialogueState | null;
  unlockedCommands?: string[];
  battleInventory?: BattleInventoryItem[];
  isAlphaLeader: boolean;
  rankTitle: string;
  attackPower: number;
  stageIndex: number;
  scrap: number;
  coins: number;
  duel: DuelHud | null;
  day: number;
  timeOfDay: number;
  weather: WeatherState;
  weatherCountdown: number;
  sectorName: string;
  currentPhase: number;
  defeatedBosses: number[];
  conqueredTerritories: string[];
  totalTerritories: number;
  activeBoss: BossHudInfo | null;
  isInsideShelter: boolean;
  isClimbing: boolean;
  sonarActive: boolean;
  sonarCooldown: number;
  attackCooldown: number;
  catYaw: number;
  catX: number;
  catZ: number;
  prompt: PromptInfo | null;
  radarBlips: RadarBlip[];
  discoveredTerminals: string[];
  foodCollected: number;
  waterDrunk: number;
  sheltersUpgraded: number;
  enemiesDefeated: number;
  chances: number;
  maxChances: number;
  hasBossCheckpoint: boolean;
  checkpointPhase: number;
  causeOfDeath?: string;
}

export interface BossCheckpointData {
  stageIndex: number;
  level: number;
  stars: number;
  starProgress: number;
  unlockedMoves?: string[];
  scrap: number;
  day: number;
  timeOfDay: number;
  currentPhase: number;
  defeatedBosses: number[];
  conqueredTerritories: string[];
  catX: number;
  catZ: number;
  discoveredTerminals: string[];
  shelterLevels: Record<string, number>;
  foodCollected: number;
  waterDrunk: number;
  sheltersUpgraded: number;
  enemiesDefeated: number;
}

export interface SavedGameState {
  stageIndex: number;
  level: number;
  stars: number;
  starProgress: number;
  chances: number;
  scrap: number;
  coins?: number;
  battleMana?: number;
  /** Técnicas liberadas por nível; opcional para compatibilidade com saves v4 antigos. */
  unlockedMoves?: string[];
  /** Estado conversacional opcional; saves antigos continuam válidos. */
  activeDialogue?: DialogueState | null;
  unlockedCommands?: string[];
  battleInventory?: BattleInventoryItem[];
  day: number;
  timeOfDay: number;
  currentPhase: number;
  defeatedBosses: number[];
  conqueredTerritories: string[];
  health: number;
  hunger: number;
  thirst: number;
  warmth: number;
  oxygen?: number;
  catX: number;
  catY: number;
  catZ: number;
  discoveredTerminals: string[];
  shelterLevels: Record<string, number>;
  foodCollected: number;
  waterDrunk: number;
  sheltersUpgraded: number;
  enemiesDefeated: number;
  bossCheckpoint?: BossCheckpointData | null;
}
