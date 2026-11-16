import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browserLocalPersistence, onAuthStateChanged, getRedirectResult, GoogleAuthProvider, setPersistence, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { LoginScreen } from './components/LoginScreen';
import { TitleScreen } from './components/TitleScreen';
import { gameAudio } from './game/audio';
import { GameEngine } from './game/GameEngine';
import { firebaseAuth, firebaseConfigured } from './firebase/client';
import { flushAccountGameSave, loadAccountGameSave, queueAccountGameSave } from './firebase/gameSave';
import { EVOLUTION_STAGES, GamePhase, HudSnapshot, LoreLog, MAX_CHANCES, SavedGameState } from './types/game';

const INITIAL_HUD: HudSnapshot = {
  health: EVOLUTION_STAGES[0].maxHealth, maxHealth: EVOLUTION_STAGES[0].maxHealth,
  hunger: 92, maxHunger: EVOLUTION_STAGES[0].maxHunger,
  thirst: 90, maxThirst: EVOLUTION_STAGES[0].maxThirst,
  warmth: 96, maxWarmth: EVOLUTION_STAGES[0].maxWarmth,
  stamina: 100, maxStamina: EVOLUTION_STAGES[0].maxStamina,
  oxygen: 100, maxOxygen: 100, level: 1, stars: 0, starProgress: 0, starNext: 57,
  unlockedMoves: ['basic-claw'], isAlphaLeader: false, rankTitle: 'Sobrevivente Errante',
  attackPower: EVOLUTION_STAGES[0].attackDamage, stageIndex: 0, scrap: 0, coins: 60,
  duel: null, day: 1, timeOfDay: 0.34, weather: 'clear', weatherCountdown: 75,
  sectorName: 'Rua da Quarentena (Fase 1)', currentPhase: 1, defeatedBosses: [],
  conqueredTerritories: [], totalTerritories: 9, activeBoss: null, isInsideShelter: false,
  isClimbing: false, sonarActive: false, sonarCooldown: 0, attackCooldown: 0, catYaw: 0,
  catX: 0, catZ: 8, prompt: null, radarBlips: [], discoveredTerminals: [],
  foodCollected: 0, waterDrunk: 0, sheltersUpgraded: 0, enemiesDefeated: 0,
  chances: MAX_CHANCES, maxChances: MAX_CHANCES, hasBossCheckpoint: false, checkpointPhase: 1,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro inesperado ao acessar sua conta.';
}

export default function App() {
  const engineRef = useRef<GameEngine | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'info' | 'success' | 'warn' } | null>(null);
  const [activeLore, setActiveLore] = useState<LoreLog | null>(null);
  const [evolvedBannerStage, setEvolvedBannerStage] = useState<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: 'info' | 'success' | 'warn') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  // Wait for Firebase's persisted browser session and redirect result before
  // exposing the login screen. This prevents an initial null auth snapshot
  // from racing the mobile OAuth callback.
  useEffect(() => {
    if (!firebaseAuth) {
      setAuthReady(true);
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        await setPersistence(firebaseAuth, browserLocalPersistence);
        const redirectResult = await getRedirectResult(firebaseAuth);
        if (!active) return;
        if (redirectResult?.user) setAuthUser(redirectResult.user);
        else setAuthUser(firebaseAuth.currentUser);
        unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (!active) return;
          setAuthUser(user);
          setAuthError(null);
          setAuthReady(true);
          setAccountReady(false);
        }, (error) => {
          if (!active) return;
          setAuthError(errorMessage(error));
          setAuthReady(true);
        });
      } catch (error) {
        if (!active) return;
        setAuthError(errorMessage(error));
        setAuthUser(firebaseAuth.currentUser);
        setAuthReady(true);
      }
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!authUser) return;
    setAccountLoading(true);
    setAccountError(null);
    setAccountReady(false);
    try {
      const remoteSave = await loadAccountGameSave(authUser.uid);
      const localSave = GameEngine.getSavedGame(authUser.uid);
      const legacySave = GameEngine.getLegacySavedGame();
      setHasSave(Boolean(remoteSave || localSave || legacySave));
      setAccountReady(true);
    } catch (error) {
      setAccountError(`Não foi possível validar o salvamento protegido no Firebase. Confira se o Firestore está criado e se as regras firestore.rules foram publicadas. Detalhe: ${errorMessage(error)}`);
    } finally {
      setAccountLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) void refreshAccount();
    else {
      setAccountReady(false);
      setHasSave(false);
      setPhase('title');
    }
  }, [authUser, refreshAccount]);

  useEffect(() => {
    if (!authUser || !accountReady) return;
    const flushOnExit = () => {
      engineRef.current?.persistNow();
      void flushAccountGameSave(authUser.uid).catch((error) => {
        console.error('Não foi possível sincronizar o save antes de sair:', error);
      });
    };
    window.addEventListener('pagehide', flushOnExit);
    return () => window.removeEventListener('pagehide', flushOnExit);
  }, [authUser, accountReady]);

  const handleGoogleLogin = useCallback(async () => {
    if (!firebaseAuth) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        // Popup avoids the mobile full-page redirect race and returns the
        // credential directly to this tab after Google authentication.
        const result = await signInWithPopup(firebaseAuth, provider);
        setAuthUser(result.user);
        setAuthReady(true);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(firebaseAuth, provider);
          return;
        }
        throw error;
      }
    } catch (error) {
      setAuthError(errorMessage(error));
      setAuthBusy(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    if (!firebaseAuth || !authUser) return;
    try {
      engineRef.current?.persistNow();
      await flushAccountGameSave(authUser.uid);
      await signOut(firebaseAuth);
      engineRef.current = null;
      setPhase('title');
    } catch (error) {
      showToast(`Não foi possível concluir a sincronização antes de sair: ${errorMessage(error)}`, 'warn');
    }
  }, [authUser, showToast]);

  const callbacks = useMemo(() => ({
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
    onSaveGame: (payload: SavedGameState) => {
      if (!authUser) return;
      queueAccountGameSave(
        authUser.uid,
        payload,
        undefined,
        (error) => showToast(`Falha ao sincronizar seu personagem: ${errorMessage(error)}`, 'warn'),
      );
    },
  }), [authUser, showToast]);

  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
  }, []);

  const handleNewGame = useCallback(() => {
    if (!authUser) return;
    GameEngine.clearLegacySavedGame();
    engineRef.current?.startNewGame();
    setPhase('playing');
    setHasSave(true);
  }, [authUser]);

  const handleContinue = useCallback(async () => {
    if (!authUser || !engineRef.current) return;
    try {
      const remoteSave = await loadAccountGameSave(authUser.uid);
      const save = remoteSave ?? GameEngine.getSavedGame(authUser.uid) ?? GameEngine.getLegacySavedGame();
      if (save) {
        engineRef.current.continueSavedGame(save);
        GameEngine.clearLegacySavedGame();
      } else {
        engineRef.current.startNewGame();
      }
      setPhase('playing');
      setHasSave(true);
    } catch (error) {
      showToast(`Não foi possível recuperar seu personagem: ${errorMessage(error)}`, 'warn');
    }
  }, [authUser, showToast]);

  const handleToggleMute = useCallback(() => {
    gameAudio.init();
    const next = !gameAudio.isMuted();
    gameAudio.setMuted(next);
    setMuted(next);
  }, []);

  const handlePauseToggle = useCallback(() => {
    setPhase((prev) => {
      const next = prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev;
      if (next === 'playing' || next === 'paused') engineRef.current?.setPhase(next);
      return next;
    });
  }, []);

  const handleContinueAfterVictory = useCallback(() => {
    setPhase('playing');
    engineRef.current?.setPhase('playing');
  }, []);

  const handleCloseLore = useCallback(() => {
    setActiveLore(null);
    if (phase === 'playing') engineRef.current?.setPhase('playing');
  }, [phase]);

  const handleDismissEvolved = useCallback(() => {
    setEvolvedBannerStage(null);
    if (phase === 'playing') engineRef.current?.setPhase('playing');
  }, [phase]);

  const handleRestart = useCallback(() => {
    setEvolvedBannerStage(null);
    setActiveLore(null);
    engineRef.current?.startNewGame();
    setPhase('playing');
  }, []);

  if (!authReady || (authUser && (!accountReady || accountLoading || accountError))) {
    return <LoginScreen configured={firebaseConfigured} busy={authBusy} error={authError ?? accountError} user={authUser} accountLoading={!authReady || accountLoading} onGoogleLogin={handleGoogleLogin} onRetry={refreshAccount} onLogout={handleLogout} />;
  }

  if (!authUser) {
    return <LoginScreen configured={firebaseConfigured} busy={authBusy} error={authError} onGoogleLogin={handleGoogleLogin} />;
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#0B0F17]">
      <GameCanvas key={authUser.uid} callbacks={callbacks} ownerId={authUser.uid} onEngineReady={handleEngineReady} />
      <div className="pointer-events-auto fixed left-1/2 top-2 z-50 flex max-w-[min(72vw,22rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#0b1421]/90 py-1 pl-2 pr-1 shadow-xl backdrop-blur-md">
        {authUser.photoURL ? <img src={authUser.photoURL} alt="" className="h-7 w-7 rounded-full" /> : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-200">{(authUser.displayName ?? authUser.email ?? 'G').slice(0, 1).toUpperCase()}</div>}
        <span className="max-w-32 truncate text-[11px] text-slate-200">{authUser.displayName ?? authUser.email}</span>
        <button type="button" onClick={handleLogout} className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-white/20">Sair</button>
      </div>

      {phase === 'title' && <TitleScreen hasSave={hasSave} onNewGame={handleNewGame} onContinue={() => void handleContinue()} />}

      {phase !== 'title' && (
        <GameHUD
          phase={phase} hud={hud} muted={muted} toast={toast} activeLore={activeLore}
          evolvedBannerStage={evolvedBannerStage} onToggleMute={handleToggleMute}
          onPauseToggle={handlePauseToggle} onContinueAfterVictory={handleContinueAfterVictory}
          onInteract={() => engineRef.current?.triggerInteract()}
          onUseInventoryItem={(itemId) => engineRef.current?.useInventoryItem(itemId)}
          onEquipInventoryItem={(itemId) => engineRef.current?.equipInventoryItem(itemId)}
          onUnequipEquipment={(slot) => engineRef.current?.unequipEquipment(slot)}
          onDialogueOption={(optionId) => engineRef.current?.chooseDialogueOption(optionId)}
          onDialogueClose={() => engineRef.current?.closeDialogue()}
          onUpgradeShelter={() => engineRef.current?.triggerShelterUpgrade()}
          onClawAttack={() => engineRef.current?.triggerClawAttack()}
          onChallenge={() => engineRef.current?.challengeNearest()}
          onDuelOffer={(kind, amount, group) => engineRef.current?.submitDuelOffer(kind, amount, group)}
          onDuelCancel={() => engineRef.current?.cancelDuelOffer()}
          onDuelForfeit={() => engineRef.current?.forfeitDuel()}
          onBattleCommand={(cmd) => engineRef.current?.battleCommand(cmd)}
          onComboBreaker={() => engineRef.current?.activateComboBreaker()}
          onBattleTarget={(side) => engineRef.current?.selectBattleTarget(side)}
          onMeow={() => engineRef.current?.triggerMeow()}
          onSonar={() => engineRef.current?.triggerSonar()}
          onJump={() => engineRef.current?.triggerJump()}
          onCloseLore={handleCloseLore} onDismissEvolved={handleDismissEvolved}
          onReviveHere={() => { engineRef.current?.reviveAtDeathSpot(); setPhase('playing'); }}
          onContinueCheckpoint={() => { engineRef.current?.continueFromBossCheckpoint(); setPhase('playing'); }}
          onZoomIn={() => engineRef.current?.adjustZoom(-2.4)}
          onZoomOut={() => engineRef.current?.adjustZoom(2.4)}
          onCycleCamera={() => engineRef.current?.cycleCameraPreset()}
          onRestart={handleRestart}
          onVirtualInput={(mx, my, sprint) => engineRef.current?.setVirtualInput(mx, my, sprint)}
        />
      )}
    </main>
  );
}
