import { useEffect, useRef, useState } from 'react';
import { EngineCallbacks, GameEngine } from '../game/GameEngine';

interface GameCanvasProps {
  callbacks: EngineCallbacks;
  onEngineReady: (engine: GameEngine) => void;
  ownerId: string;
  ownerEmail: string;
}

export function GameCanvas({ callbacks, onEngineReady, ownerId, ownerEmail }: GameCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef(callbacks);
  const onReadyRef = useRef(onEngineReady);
  const [webglError, setWebglError] = useState(false);

  callbacksRef.current = callbacks;
  onReadyRef.current = onEngineReady;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let engine: GameEngine | null = null;
    try {
      engine = new GameEngine(container, {
        onHudUpdate: (s) => callbacksRef.current.onHudUpdate(s),
        onToast: (msg, tone) => callbacksRef.current.onToast(msg, tone),
        onLoreOpen: (lore) => callbacksRef.current.onLoreOpen(lore),
        onPlayerDown: (cause, snap) => callbacksRef.current.onPlayerDown(cause, snap),
        onGameOver: (cause, snap) => callbacksRef.current.onGameOver(cause, snap),
        onVictory: (snap) => callbacksRef.current.onVictory(snap),
        onEvolutionUnlocked: (idx) => callbacksRef.current.onEvolutionUnlocked(idx),
        onSaveGame: (payload) => callbacksRef.current.onSaveGame?.(payload),
      }, ownerId, ownerEmail);
      onReadyRef.current(engine);
    } catch {
      setWebglError(true);
    }

    return () => {
      engine?.dispose();
    };
  }, []);

  if (webglError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0B0F17] p-6 text-center">
        <div className="max-w-md rounded-xl border border-white/10 bg-[#121824] p-6">
          <h2 className="font-display text-xl font-bold text-slate-100">
            Renderização 3D Indisponível
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Seu navegador não conseguiu inicializar o contexto WebGL necessário para a cidade em 3D. Tente ativar a aceleração de hardware ou abrir em outro navegador.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="absolute inset-0 w-full h-full overflow-hidden" />;
}
