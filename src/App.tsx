import { useCallback, useMemo, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { TitleScreen } from './components/TitleScreen';
import { gameAudio } from './game/audio';
import { GameEngine } from './game/GameEngine';
import { EVOLUTION_STAGES, GamePhase, HudSnapshot, LoreLog, MAX_CHANCES } from './types/game';

const INITIAL_HUD: HudSnapshot = {
  health: EVOLUTION_STAGES[0].maxHealth,
  maxHealth: EVOLUTION_STAGES[0].maxHealth,
  hunger: 92,
  maxHunger: EVOLUTION_STAGES[0].maxHunger,
  thirst: 90,
  maxThirst: EVOLUTION_STAGES[0].maxThirst,
  warmth: 96,
  maxWarmth: EVOLUTION_STAGES[0].maxWarmth,
  stamina: EVOLUTION_STAGES[0].maxStamina,
  maxStamina: EVOLUTION_STAGES[0].maxStamina,
  level: 1,
  stars: 0,
  starProgress: 0,
  starNext: 57,
  isAlphaLeader: false,
  rankTitle: 'Sobrevivente Errante',
  attackPower: EVOLUTION_STAGES[0].attackDamage,
  stageIndex: 0,
  scrap: 0,
  day: 1,
  timeOfDay: 0.34,
  weather: 'clear',
  weatherCountdown: 75,
  sectorName: 'Rua da Quarentena (Fase 1)',
  currentPhase: 1,
  defeatedBosses: [],
  conqueredTerritories: [],
  totalTerritories: 9,
  activeBoss: null,
  isInsideShelter: false,
  isClimbing: false,
  sonarActive: false,
  sonarCooldown: 0,
  attackCooldown: 0,
  catYaw: 0,
  catX: 0,
  catZ: 8,
  prompt: null,
  radarBlips: [],
  discoveredTerminals: [],
  foodCollected: 0,
  waterDrunk: 0,
  sheltersUpgraded: 0,
  enemiesDefeated: 0,
  chances: MAX_CHANCES,
  maxChances: MAX_CHANCES,
  hasBossCheckpoint: false,
  checkpointPhase: 1,
};

export default function App() {
  const engineRef = useRef<GameEngine | null>(null);
  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [hasSave, setHasSave] = useState(() => GameEngine.hasSavedGame());
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    tone: 'info' | 'success' | 'warn';
  } | null>(null);
  const [activeLore, setActiveLore] = useState<LoreLog | null>(null);
  const [evolvedBannerStage, setEvolvedBannerStage] = useState<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: 'info' | 'success' | 'warn') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3400);
  }, []);

  const callbacks = useMemo(
    () => ({
      onHudUpdate: (snapshot: HudSnapshot) => setHud(snapshot),
      onToast: showToast,
      onLoreOpen: (lore: LoreLog) => {
        setActiveLore(lore);
        engineRef.current?.setPhase('paused');
      },
      onPlayerDown: (cause: string, snapshot: HudSnapshot) => {
        setHud({ ...snapshot, causeOfDeath: cause });
        setPhase('fallen');
      },
      onGameOver: (cause: string, snapshot: HudSnapshot) => {
        setHud({ ...snapshot, causeOfDeath: cause });
        setPhase('gameover');
      },
      onVictory: (snapshot: HudSnapshot) => {
        setHud(snapshot);
        setPhase('victory');
      },
      onEvolutionUnlocked: (newStageIndex: number) => {
        setEvolvedBannerStage(newStageIndex);
        engineRef.current?.setPhase('paused');
      },
    }),
    [showToast],
  );

  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
  }, []);

  const handleNewGame = useCallback(() => {
    engineRef.current?.startNewGame();
    setPhase('playing');
    setHasSave(true);
  }, []);

  const handleContinue = useCallback(() => {
    engineRef.current?.continueSavedGame();
    setPhase('playing');
  }, []);

  const handleToggleMute = useCallback(() => {
    gameAudio.init();
    const next = !gameAudio.isMuted();
    gameAudio.setMuted(next);
    setMuted(next);
  }, []);

  const handlePauseToggle = useCallback(() => {
    setPhase((prev) => {
      const next = prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev;
      if (next === 'playing' || next === 'paused') {
        engineRef.current?.setPhase(next);
      }
      return next;
    });
  }, []);

  const handleContinueAfterVictory = useCallback(() => {
    setPhase('playing');
    engineRef.current?.setPhase('playing');
  }, []);

  const handleCloseLore = useCallback(() => {
    setActiveLore(null);
    if (phase === 'playing') {
      engineRef.current?.setPhase('playing');
    }
  }, [phase]);

  const handleDismissEvolved = useCallback(() => {
    setEvolvedBannerStage(null);
    if (phase === 'playing') {
      engineRef.current?.setPhase('playing');
    }
  }, [phase]);

  const handleRestart = useCallback(() => {
    setEvolvedBannerStage(null);
    setActiveLore(null);
    engineRef.current?.startNewGame();
    setPhase('playing');
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0B0F17]">
      <GameCanvas callbacks={callbacks} onEngineReady={handleEngineReady} />

      {phase === 'title' && (
        <TitleScreen
          hasSave={hasSave}
          onNewGame={handleNewGame}
          onContinue={handleContinue}
        />
      )}

      {phase !== 'title' && (
        <GameHUD
          phase={phase}
          hud={hud}
          muted={muted}
          toast={toast}
          activeLore={activeLore}
          evolvedBannerStage={evolvedBannerStage}
          onToggleMute={handleToggleMute}
          onPauseToggle={handlePauseToggle}
          onContinueAfterVictory={handleContinueAfterVictory}
          onInteract={() => engineRef.current?.triggerInteract()}
          onUpgradeShelter={() => engineRef.current?.triggerShelterUpgrade()}
          onClawAttack={() => engineRef.current?.triggerClawAttack()}
          onMeow={() => engineRef.current?.triggerMeow()}
          onSonar={() => engineRef.current?.triggerSonar()}
          onJump={() => engineRef.current?.triggerJump()}
          onCloseLore={handleCloseLore}
          onDismissEvolved={handleDismissEvolved}
          onReviveHere={() => {
            engineRef.current?.reviveAtDeathSpot();
            setPhase('playing');
          }}
          onContinueCheckpoint={() => {
            engineRef.current?.continueFromBossCheckpoint();
            setPhase('playing');
          }}
          onZoomIn={() => engineRef.current?.adjustZoom(-2.4)}
          onZoomOut={() => engineRef.current?.adjustZoom(2.4)}
          onCycleCamera={() => engineRef.current?.cycleCameraPreset()}
          onRestart={handleRestart}
          onVirtualInput={(mx, my, sprint) =>
            engineRef.current?.setVirtualInput(mx, my, sprint)
          }
        />
      )}
    </main>
  );
}
