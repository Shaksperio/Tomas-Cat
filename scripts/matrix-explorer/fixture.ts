import { GameEngine, type EngineCallbacks } from '../../src/game/GameEngine';
import type { HudSnapshot, LoreLog } from '../../src/types/game';

type ExplorerSnapshot = Pick<HudSnapshot,
  | 'health' | 'maxHealth' | 'hunger' | 'thirst' | 'stamina' | 'oxygen'
  | 'level' | 'day' | 'timeOfDay' | 'weather' | 'sectorName'
  | 'currentPhase' | 'catX' | 'catZ' | 'isInsideShelter' | 'isClimbing'
>;

interface ExplorerApi {
  ready: boolean;
  version: 1;
  getSnapshot: () => ExplorerSnapshot | null;
  getEvents: () => string[];
  actions: {
    move: (x: number, z: number, sprint?: boolean) => void;
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
    getEvents: () => [...events],
    actions: {
      move: (x, z, sprint = false) => activeEngine.setVirtualInput(
        Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0,
        Number.isFinite(z) ? Math.max(-1, Math.min(1, z)) : 0,
        Boolean(sprint),
      ),
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
