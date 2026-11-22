// Renderiza o GameHUD real (React + Tailwind) sobre o GameEngine real, em tela de celular, para checar sobreposição.
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { GameEngine } from '../../src/game/GameEngine';
import { GameHUD } from '../../src/components/GameHUD';
import { AgentTasksPanel } from '../../src/components/AgentTasksPanel';
declare const LEGACY_AGENTS: boolean;

const noop = () => {};
const agentTasks = {
  tick: 120,
  agents: Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, name: `Agente ${i + 1}`, profession: i % 2 ? 'worker' : 'engineer', status: 'working', activeTaskId: i < 8 ? `t${i}` : null, energy: 80, health: 90 })),
  tasks: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, kind: 'gather_wood', status: i < 3 ? 'queued' : 'in_progress', requiredProfession: 'worker', assignedAgentId: null, updatedAtTick: i })),
  cowilaBrief: 'Priorizar abrigo e água antes da próxima noite.',
};
const LONG_TOAST = 'Organismo catalogado: Mingau (+22 XP · sem cópia de consciência)';

function App() {
  const [hud, setHud] = useState<any>(null);
  useEffect(() => {
    const engine = new GameEngine(document.getElementById('game')!, {
      onHudUpdate: (s: any) => setHud(s), onToast: noop, onLoreOpen: noop, onPlayerDown: noop, onGameOver: noop, onVictory: noop, onEvolutionUnlocked: noop,
    } as any, 'hud-layout-check');
    (window as any).engine = engine;
    engine.startNewGame();
  }, []);
  if (!hud) return null;
  const p: any = new Proxy({}, { get: () => noop });
  return (
    <>
    {LEGACY_AGENTS && <AgentTasksPanel snapshot={agentTasks} />}
    <GameHUD {...p} phase="playing" hud={hud} muted={false} toast={{ id: 1, message: LONG_TOAST, tone: 'success' }} activeLore={null}
      agentTasks={agentTasks} evolvedBannerStage={null} />
    </>
  );
}
createRoot(document.getElementById('hud')!).render(<App />);
