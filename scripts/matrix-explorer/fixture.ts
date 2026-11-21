import { GameEngine, type EngineCallbacks } from '../../src/game/GameEngine';
import type { HudSnapshot, LoreLog } from '../../src/types/game';
import type { BuiltWorld } from '../../src/game/worldBuilder';
import type { SocietySimulation, SocietySimulationSnapshot } from '../../src/game/society/simulation';

type ExplorerSnapshot = Pick<HudSnapshot,
  | 'health' | 'maxHealth' | 'hunger' | 'thirst' | 'stamina' | 'oxygen'
  | 'level' | 'day' | 'timeOfDay' | 'weather' | 'sectorName'
  | 'currentPhase' | 'catX' | 'catZ' | 'isInsideShelter' | 'isClimbing'
>;

interface ExplorerWorldSnapshot {
  interactables: Array<{
    id: string; kind: string; name: string; x: number; y: number; z: number;
    active: boolean; respawnTimer: number; itemId?: string; shelterLevel?: number;
  }>;
  predators: Array<{
    id: string; name: string; kind: string; isBoss: boolean; isFriendly: boolean;
    isTerritoryRival: boolean; rivalLevel: number | null; phaseIndex: number;
    x: number; y: number; z: number; alive: boolean; hp: number; maxHp: number;
  }>;
  phaseGates: Array<{ phaseRequired: number; unlocked: boolean; x: number; z: number; collider: BuiltWorld['phaseGates'][number]['collider'] }>;
  waterBodies: BuiltWorld['waterBodies'];
  rivers: BuiltWorld['rivers'];
  indoorZones: BuiltWorld['indoorZones'];
  colliders: BuiltWorld['colliders'];
  colliderCount: number;
  society: {
    tick: number;
    agents: SocietySimulationSnapshot['agents'];
    tasks: SocietySimulationSnapshot['tasks'];
    resources: SocietySimulationSnapshot['resources'];
  };
}

// Contrato de inspeção do adaptador local. world/society são membros internos
// do GameEngine; a validação abaixo falha explicitamente se a estrutura mudar.
interface EngineInspection {
  world: BuiltWorld;
  society: Pick<SocietySimulation, 'snapshot'>;
  catPos: { x: number; z: number };
  camYaw: number;
}

interface ExplorerApi {
  ready: boolean;
  version: 1;
  getSnapshot: () => ExplorerSnapshot | null;
  getWorldSnapshot: () => ExplorerWorldSnapshot;
  getEvents: () => string[];
  actions: {
    move: (x: number, z: number, sprint?: boolean) => void;
    moveToward: (x: number, z: number, sprint?: boolean) => void;
    stop: () => void;
    jump: () => void;
    interact: () => void;
    attack: () => void;
    meow: () => void;
    sonar: () => void;
    nextCamera: () => void;
    zoom: (delta: number) => void;
  };
  dispose: () => void;
}

declare global {
  interface Window {
    __MATRIX_EXPLORER__?: ExplorerApi;
    __MATRIX_EXPLORER_ERROR__?: string;
  }
}

const container = document.querySelector<HTMLDivElement>('#world');
const status = document.querySelector<HTMLDivElement>('#status');
const events: string[] = [];
let latestHud: HudSnapshot | null = null;
let engine: GameEngine | null = null;

function worldSnapshot(): ExplorerWorldSnapshot {
  if (!engine) throw new Error('GameEngine ainda não foi inicializado.');
  const internal = engine as unknown as EngineInspection;
  const world = internal.world;
  if (!world || !Array.isArray(world.interactables) || !Array.isArray(world.predators)
    || !Array.isArray(world.phaseGates) || !Array.isArray(world.waterBodies)) {
    throw new Error('Contrato de observação do mundo mudou; adaptador interrompido por segurança.');
  }
  const society = internal.society.snapshot();
  return {
    interactables: world.interactables.map((item) => ({
      id: item.id, kind: item.kind, name: item.name,
      x: item.position.x, y: item.position.y, z: item.position.z,
      active: item.active, respawnTimer: item.respawnTimer,
      ...(item.itemId ? { itemId: item.itemId } : {}),
      ...(item.shelterLevel !== undefined ? { shelterLevel: item.shelterLevel } : {}),
    })),
    predators: world.predators.map((actor) => ({
      id: actor.id, name: actor.name, kind: actor.kind,
      isBoss: actor.isBoss, isFriendly: Boolean(actor.isFriendly),
      isTerritoryRival: Boolean(actor.isTerritoryRival),
      rivalLevel: actor.rivalLevel ?? null, phaseIndex: actor.phaseIndex,
      x: actor.group.position.x, y: actor.group.position.y, z: actor.group.position.z,
      alive: actor.alive, hp: actor.hp, maxHp: actor.maxHp,
    })),
    phaseGates: world.phaseGates.map((gate) => ({
      phaseRequired: gate.phaseRequired, unlocked: gate.unlocked,
      x: gate.mesh.position.x, z: gate.mesh.position.z,
      collider: { ...gate.collider },
    })),
    waterBodies: world.waterBodies.map((body) => ({ ...body })),
    rivers: world.rivers.map((river) => ({ ...river })),
    indoorZones: world.indoorZones.map((zone) => ({ ...zone })),
    colliders: world.colliders.map((collider) => ({ ...collider })),
    colliderCount: world.colliders.length,
    society: {
      tick: society.tick,
      agents: society.agents.map((agent) => ({
        ...agent, position: { ...agent.position }, needs: { ...agent.needs },
      })),
      tasks: society.tasks.map((task) => ({
        ...task, dependencies: [...task.dependencies], requiredResources: { ...task.requiredResources },
        target: task.target ? { ...task.target } : null,
      })),
      resources: { ...society.resources },
    },
  };
}

function snapshot(): ExplorerSnapshot | null {
  if (!latestHud) return null;
  const { health, maxHealth, hunger, thirst, stamina, oxygen, level, day,
    timeOfDay, weather, sectorName, currentPhase, catX, catZ,
    isInsideShelter, isClimbing } = latestHud;
  return { health, maxHealth, hunger, thirst, stamina, oxygen, level, day,
    timeOfDay, weather, sectorName, currentPhase, catX, catZ,
    isInsideShelter, isClimbing };
}

try {
  if (!container || !status) throw new Error('Fixture sem contêiner de mundo ou status.');
  const callbacks: EngineCallbacks = {
    onHudUpdate: (value) => { latestHud = value; },
    onToast: (message) => { events.push(message); },
    onLoreOpen: (_lore: LoreLog) => { events.push('lore_opened'); },
    onPlayerDown: () => { events.push('player_down'); },
    onGameOver: () => { events.push('game_over'); },
    onVictory: () => { events.push('victory'); },
    onEvolutionUnlocked: (stage) => { events.push(`evolution:${stage}`); },
  };

  // Identidade sintética isolada: sem Firebase, conta real ou save remoto.
  engine = new GameEngine(container, callbacks, 'matrix-explorer-fixture', '', false);
  engine.startNewGame();
  const activeEngine = engine;

  window.__MATRIX_EXPLORER__ = {
    ready: true,
    version: 1,
    getSnapshot: snapshot,
    getWorldSnapshot: worldSnapshot,
    getEvents: () => [...events],
    actions: {
      move: (x, z, sprint = false) => activeEngine.setVirtualInput(
        Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0,
        Number.isFinite(z) ? Math.max(-1, Math.min(1, z)) : 0,
        Boolean(sprint),
      ),
      moveToward: (x, z, sprint = false) => {
        const state = activeEngine as unknown as EngineInspection;
        const dx = x - state.catPos.x;
        const dz = z - state.catPos.z;
        const distance = Math.hypot(dx, dz);
        if (!Number.isFinite(distance) || distance < 0.15) {
          activeEngine.setVirtualInput(0, 0, false);
          return;
        }
        const yaw = state.camYaw;
        const inputX = (Math.cos(yaw) * dx - Math.sin(yaw) * dz) / distance;
        const inputZ = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / distance;
        activeEngine.setVirtualInput(inputX, inputZ, Boolean(sprint));
      },
      stop: () => activeEngine.setVirtualInput(0, 0, false),
      jump: () => activeEngine.triggerJump(),
      interact: () => activeEngine.triggerInteract(),
      attack: () => activeEngine.triggerClawAttack(),
      meow: () => activeEngine.triggerMeow(),
      sonar: () => activeEngine.triggerSonar(),
      nextCamera: () => activeEngine.cycleCameraPreset(),
      zoom: (delta) => activeEngine.adjustZoom(Number.isFinite(delta) ? Math.max(-2, Math.min(2, delta)) : 0),
    },
    dispose: () => {
      activeEngine.setVirtualInput(0, 0, false);
      activeEngine.dispose();
      window.__MATRIX_EXPLORER__ = undefined;
    },
  };
  status.textContent = 'OBSERVADOR PRONTO · mundo local isolado';
  status.dataset.state = 'ready';
  document.body.dataset.matrixExplorer = 'ready';
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  window.__MATRIX_EXPLORER_ERROR__ = message;
  if (status) {
    status.textContent = `FALHA DO OBSERVADOR · ${message}`;
    status.dataset.state = 'error';
  }
  document.body.dataset.matrixExplorer = 'error';
  throw error;
}
