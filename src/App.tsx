import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browserPopupRedirectResolver, onAuthStateChanged, getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { GameCanvas } from './components/GameCanvas';
import { OracleDialogue } from './components/OracleDialogue';
import type { OracleWorldAction } from './game/society/agents/oracleWorldActions';
import { GameHUD } from './components/GameHUD';
import { LoginScreen } from './components/LoginScreen';
import { TitleScreen } from './components/TitleScreen';
import { gameAudio } from './game/audio';
import { GameEngine } from './game/GameEngine';
import { firebaseAuth, firebaseConfigured } from './firebase/client';
import { pickBestSave } from './game/saves/saveSelection';
import { isRecoverableConnectivityFailure } from './game/offline/connectivity';
import { flushAccountGameSave, loadAccountGameSave, queueAccountGameSave } from './firebase/gameSave';
import { EVOLUTION_STAGES, GamePhase, HudSnapshot, LoreLog, MAX_CHANCES, SavedGameState } from './types/game';

const INITIAL_HUD: HudSnapshot = {
  health: EVOLUTION_STAGES[0].maxHealth, maxHealth: EVOLUTION_STAGES[0].maxHealth,
  hunger: 92, maxHunger: EVOLUTION_STAGES[0].maxHunger,
  thirst: 90, maxThirst: EVOLUTION_STAGES[0].maxThirst,
  warmth: 96, maxWarmth: EVOLUTION_STAGES[0].maxWarmth,
  stamina: EVOLUTION_STAGES[0].maxStamina, maxStamina: EVOLUTION_STAGES[0].maxStamina,
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
  const [connectionOnline, setConnectionOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const currentUidRef = useRef<string | null>(null);
  const loadedAccountUidRef = useRef<string | null>(null);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'info' | 'success' | 'warn' } | null>(null);
  const [activeLore, setActiveLore] = useState<LoreLog | null>(null);
  const [oracleOpen, setOracleOpen] = useState(false);
  const [evolvedBannerStage, setEvolvedBannerStage] = useState<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: 'info' | 'success' | 'warn') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      setConnectionOnline(false);
      if (authUser) {
        setOfflineFallback(true);
        showToast('Conexão perdida. Tomas continuará usando o salvamento local.', 'warn');
      }
    };
    const handleOnline = () => {
      setConnectionOnline(true);
      if (authUser) engineRef.current?.persistNow();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [authUser, showToast]);

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
    const applyUser = (user: User | null) => {
      const nextUid = user?.uid ?? null;
      // Só reinicia a conta quando o UID muda; renovação de token reemite
      // onAuthStateChanged e não pode desmontar o jogo.
      if (currentUidRef.current !== nextUid) {
        currentUidRef.current = nextUid;
        setAccountReady(false);
        setPhotoFailed(false);
      }
      setAuthUser(user);
      setAuthReady(true);
      setAuthError(null);
    };
    void (async () => {
      try {
        const redirectResult = await getRedirectResult(firebaseAuth, browserPopupRedirectResolver);
        if (!active) return;
        if (redirectResult?.user) applyUser(redirectResult.user);
      } catch (error) {
        if (!active) return;
        setAuthError(errorMessage(error));
      }
      if (!active) return;
      unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (!active) return;
        applyUser(user);
      }, (error) => {
        if (!active) return;
        setAuthError(errorMessage(error));
        setAuthReady(true);
      });
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!authUser) return;
    const uid = authUser.uid;
    setAccountLoading(true);
    setAccountError(null);
    try {
      const remoteSave = await loadAccountGameSave(uid);
      const localSave = GameEngine.getSavedGame(uid);
      const legacySave = GameEngine.getLegacySavedGame();
      if (currentUidRef.current !== uid) return;
      loadedAccountUidRef.current = uid;
      setHasSave(Boolean(remoteSave || localSave || legacySave || GameEngine.getBackupSavedGame()));
      setOfflineFallback(false);
      setAccountReady(true);
    } catch (error) {
      if (isRecoverableConnectivityFailure(error)) {
        const localSave = GameEngine.getSavedGame(uid);
        const legacySave = GameEngine.getLegacySavedGame();
        const backupSave = GameEngine.getBackupSavedGame();
        if (currentUidRef.current !== uid) return;
        loadedAccountUidRef.current = uid;
        setHasSave(Boolean(localSave || legacySave || backupSave));
        setOfflineFallback(true);
        setAccountReady(true);
        setAccountError(null);
        showToast('Firebase indisponível. Modo de contingência ativado: seu progresso local continua disponível.', 'warn');
      } else {
        setAccountError(`Não foi possível validar o salvamento protegido no Firebase. Confira se o Firestore está criado e se as regras firestore.rules foram publicadas. Detalhe: ${errorMessage(error)}`);
      }
    } finally {
      setAccountLoading(false);
    }
  }, [authUser, showToast]);

  useEffect(() => {
    if (authUser) {
      if (loadedAccountUidRef.current !== authUser.uid) void refreshAccount();
    } else {
      loadedAccountUidRef.current = null;
      setAccountReady(false);
      setHasSave(false);
      setOfflineFallback(false);
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
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        const credential = await signInWithPopup(firebaseAuth, provider, browserPopupRedirectResolver);
        const nextUid = credential.user.uid;
        if (currentUidRef.current !== nextUid) {
          currentUidRef.current = nextUid;
          setAccountReady(false);
          setPhotoFailed(false);
        }
        setAuthUser(credential.user);
        setAuthReady(true);
        setAuthError(null);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'auth/popup-blocked' && window.self === window.top) {
          await signInWithRedirect(firebaseAuth, provider, browserPopupRedirectResolver);
          return;
        }
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          setAuthError('A janela de login do Google foi fechada antes de concluir. Tente novamente' + (window.self !== window.top ? ' ou abra o jogo em uma nova aba.' : '.'));
        } else if (code === 'auth/popup-blocked') {
          setAuthError('O navegador bloqueou a janela de login. Abra o jogo em uma nova aba para entrar.');
        } else {
          setAuthError(errorMessage(error));
        }
      }
    } catch (error) {
      setAuthError(errorMessage(error));
    } finally {
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
    onOracleInteract: () => { engineRef.current?.setPhase('paused'); setOracleOpen(true); },
    onSaveGame: (payload: SavedGameState) => {
      if (!authUser) return;
      queueAccountGameSave(
        authUser.uid,
        payload,
        () => setOfflineFallback(false),
        (error) => {
          setOfflineFallback(true);
          showToast(`Falha ao sincronizar seu personagem. O progresso permanece local: ${errorMessage(error)}`, 'warn');
        },
      );
    },
  }), [authUser, showToast]);

  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
  }, []);

  const handleNewGame = useCallback(() => {
    if (!authUser) return;
    // Preserva em backup o melhor save existente antes de iniciar outro personagem.
    const existing = pickBestSave([
      { origin: 'local', save: GameEngine.getSavedGame(authUser.uid) as SavedGameState },
      { origin: 'legacy', save: GameEngine.getLegacySavedGame() as SavedGameState },
    ]);
    if (existing) GameEngine.archiveSave(existing.save);
    GameEngine.clearLegacySavedGame();
    engineRef.current?.startNewGame();
    setPhase('playing');
    setHasSave(true);
  }, [authUser]);

  const handleContinue = useCallback(async () => {
    if (!authUser || !engineRef.current) return;
    try {
      const remoteSave = await loadAccountGameSave(authUser.uid);
      // Usa o save mais avançado entre nuvem, cópia local, save legado e backup.
      const best = pickBestSave([
        remoteSave ? { origin: 'remote', save: remoteSave } : null,
        { origin: 'local', save: GameEngine.getSavedGame(authUser.uid) as SavedGameState },
        { origin: 'legacy', save: GameEngine.getLegacySavedGame() as SavedGameState },
        { origin: 'backup', save: GameEngine.getBackupSavedGame() as SavedGameState },
      ]);
      const save = best?.save ?? null;
      if (save) {
        GameEngine.archiveSave(save);
        engineRef.current.continueSavedGame(save);
        GameEngine.clearLegacySavedGame();
        if (best && best.origin !== 'remote') showToast(`Personagem recuperado de ${best.origin === 'local' ? 'cópia local' : best.origin === 'legacy' ? 'save anterior ao login' : 'backup'} — Nível ${save.level}.`, 'success');
      } else {
        engineRef.current.startNewGame();
      }
      setPhase('playing');
      setHasSave(true);
    } catch (error) {
      if (isRecoverableConnectivityFailure(error)) {
        const best = pickBestSave([
          { origin: 'local', save: GameEngine.getSavedGame(authUser.uid) as SavedGameState },
          { origin: 'legacy', save: GameEngine.getLegacySavedGame() as SavedGameState },
          { origin: 'backup', save: GameEngine.getBackupSavedGame() as SavedGameState },
        ]);
        if (best) {
          GameEngine.archiveSave(best.save);
          engineRef.current.continueSavedGame(best.save);
          GameEngine.clearLegacySavedGame();
          showToast(`Personagem recuperado da cópia ${best.origin}. Continuando em modo de contingência.`, 'warn');
        } else {
          engineRef.current.startNewGame();
          showToast('Sem conexão com o Firestore. Novo progresso será mantido localmente até a reconexão.', 'warn');
        }
        setOfflineFallback(true);
        setPhase('playing');
        setHasSave(true);
      } else {
        showToast(`Não foi possível recuperar seu personagem: ${errorMessage(error)}`, 'warn');
      }
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
    return <LoginScreen configured={firebaseConfigured} busy={authBusy} error={authError ?? accountError} user={authUser} accountLoading={!authReady || accountLoading} inIframe={inIframe} onGoogleLogin={handleGoogleLogin} onRetry={refreshAccount} onLogout={handleLogout} />;
  }

  if (!authUser) {
    return <LoginScreen configured={firebaseConfigured} busy={authBusy} error={authError} inIframe={inIframe} onGoogleLogin={handleGoogleLogin} />;
  }

  return (
    <main className="relative flex h-full w-full flex-col overflow-hidden bg-[#0B0F17]">
      <header className="relative z-30 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#080d17]/95 px-3 py-1.5 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          {authUser.photoURL && !photoFailed
            ? <img src={authUser.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} className="h-7 w-7 rounded-full" />
            : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-200">{(authUser.displayName ?? authUser.email ?? 'G').slice(0, 1).toUpperCase()}</div>}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[11px] font-semibold text-slate-100">{authUser.displayName ?? authUser.email}</p>
            {authUser.displayName && authUser.email && <p className="truncate text-[10px] text-slate-400">{authUser.email}</p>}
          </div>
        </div>
        <button type="button" onClick={handleLogout} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-white/20">Sair</button>
      </header>

      {(offlineFallback || !connectionOnline) && (
        <div role="status" className="relative z-20 flex shrink-0 items-center justify-center gap-2 border-b border-amber-300/20 bg-amber-950/80 px-3 py-1.5 text-center text-[10px] font-medium text-amber-100">
          <span>{!connectionOnline ? 'Sem internet' : 'Servidor Firebase indisponível'} — modo de contingência ativo; progresso salvo localmente.</span>
        </div>
      )}

      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
      <GameCanvas key={authUser.uid} callbacks={callbacks} ownerId={authUser.uid} ownerEmail={authUser.email ?? ''} ownerEmailVerified={authUser.emailVerified} onEngineReady={handleEngineReady} />

      {oracleOpen && authUser?.emailVerified && authUser.email?.trim().toLowerCase() === 'antonyopintor@gmail.com' && (
        <OracleDialogue
          onClose={() => { setOracleOpen(false); engineRef.current?.setPhase('playing'); }}
          worldPosition={{ x: hud.catX, z: hud.catZ }}
          onWorldActions={(actions: OracleWorldAction[]) => {
            const applied = engineRef.current?.applyOracleWorldActions(actions) ?? 0;
            if (applied === 0) showToast('A Matrix recusou a alteração: posição, estrutura ou autorização inválida.', 'warn');
          }}
        />
      )}

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
          onBuyShopItem={(itemId) => engineRef.current?.buyShopItem(itemId)}
          onCloseShop={() => engineRef.current?.closeShop()}
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
      </div>
    </main>
  );
}
