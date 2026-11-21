import { useMemo, useState } from 'react';
import type { AgentTasksHudSnapshot } from '../types/game';

interface AgentTasksPanelProps {
  snapshot: AgentTasksHudSnapshot;
}

const PROFESSION_LABELS: Record<string, string> = {
  engineer: 'Engenheira',
  worker: 'Operário',
  agent: 'Guardião',
  farmer: 'Agricultora',
  lumberjack: 'Lenhador',
  miner: 'Mineradora',
  carpenter: 'Carpinteiro',
  merchant: 'Comerciante',
};

const TASK_LABELS: Record<string, string> = {
  survey_site: 'Explorar terreno',
  design_project: 'Planejar projeto',
  gather_materials: 'Coletar materiais',
  transport_materials: 'Transportar materiais',
  prepare_site: 'Preparar terreno',
  build_module: 'Construir módulo',
  repair_structure: 'Reparar estrutura',
  mediate_conflict: 'Medir conflito',
  patrol_area: 'Patrulhar região',
  investigate_event: 'Investigar evento',
  cultivate_field: 'Cultivar plantação',
  harvest_food: 'Colher alimentos',
  chop_wood: 'Coletar madeira',
  mine_stone: 'Minerar pedra',
  craft_planks: 'Fabricar tábuas',
  trade_goods: 'Negociar mercadorias',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Disponível',
  travelling: 'A caminho',
  working: 'Trabalhando',
  resting: 'Descansando',
  disabled: 'Suspenso',
  queued: 'Na fila',
  assigned: 'Atribuída',
  in_progress: 'Em execução',
  completed: 'Concluída',
};

export function AgentTasksPanel({ snapshot }: AgentTasksPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const taskById = useMemo(
    () => new Map(snapshot.tasks.map((task) => [task.id, task])),
    [snapshot.tasks],
  );
  const activeTasks = snapshot.tasks.filter((task) => task.status === 'assigned' || task.status === 'in_progress');
  const queuedTasks = snapshot.tasks.filter((task) => task.status === 'queued');
  const completedTasks = snapshot.tasks
    .filter((task) => task.status === 'completed')
    .sort((a, b) => b.updatedAtTick - a.updatedAtTick)
    .slice(0, 3);
  const workingCount = snapshot.agents.filter((agent) => agent.activeTaskId !== null).length;

  return (
    <section
      aria-label="Tarefas dos agentes de inteligência artificial"
      className="pointer-events-auto absolute left-2 top-16 z-[60] w-[min(19rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-violet-300/30 bg-[#0a1020]/95 text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.48)] backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-violet-400/10"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-base" aria-hidden="true">✦</span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-violet-200">Agentes de IA</span>
            <span className="block text-[10px] text-slate-400">{workingCount} em atividade · {queuedTasks.length} na fila</span>
          </span>
        </span>
        <span className="shrink-0 text-xs text-violet-200">{expanded ? 'Recolher −' : 'Ver tarefas +'}</span>
      </button>

      {expanded && (
        <div className="max-h-[42vh] space-y-3 overflow-y-auto border-t border-white/10 px-3 py-2.5">
          {snapshot.cowilaBrief && (
            <div className="rounded-lg border border-violet-300/20 bg-violet-400/10 px-2.5 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-violet-200">Cowila · Diretriz</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-200">{snapshot.cowilaBrief}</p>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Equipe</h3>
              <span className="text-[9px] tabular-nums text-slate-500">{snapshot.agents.length} especialistas</span>
            </div>
            <ul className="space-y-1.5">
              {snapshot.agents.map((agent) => {
                const task = agent.activeTaskId ? taskById.get(agent.activeTaskId) : undefined;
                const isBusy = Boolean(task);
                const activity = task
                  ? TASK_LABELS[task.kind] ?? task.kind
                  : STATUS_LABELS[agent.status] ?? agent.status;
                return (
                  <li key={agent.id} className="flex items-center gap-2 rounded-md bg-white/[0.04] px-2 py-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${isBusy ? 'bg-emerald-400' : agent.status === 'resting' ? 'bg-amber-300' : 'bg-slate-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold">{agent.name} <span className="font-normal text-slate-500">· {PROFESSION_LABELS[agent.profession] ?? agent.profession}</span></span>
                      <span className="block truncate text-[10px] text-slate-400">{activity}</span>
                    </span>
                    <span className="shrink-0 text-[9px] tabular-nums text-slate-500">{Math.round(agent.energy)}% energia</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">Fila de trabalho</h3>
            {queuedTasks.length === 0 ? (
              <p className="rounded-md bg-white/[0.04] px-2 py-2 text-[10px] text-slate-500">Nenhuma tarefa aguardando atribuição.</p>
            ) : (
              <ul className="space-y-1">
                {queuedTasks.slice(0, 5).map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2 rounded-md bg-white/[0.04] px-2 py-1.5">
                    <span className="truncate text-[10px] text-slate-200">{TASK_LABELS[task.kind] ?? task.kind}</span>
                    <span className="shrink-0 text-[9px] text-slate-500">{PROFESSION_LABELS[task.requiredProfession] ?? task.requiredProfession}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {completedTasks.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">Concluídas recentemente</h3>
              <ul className="space-y-1">
                {completedTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-[10px] text-slate-400">
                    <span className="text-emerald-400" aria-hidden="true">✓</span>
                    <span className="truncate">{TASK_LABELS[task.kind] ?? task.kind}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-t border-white/10 pt-1 text-right text-[9px] text-slate-600">Ciclo da sociedade · {snapshot.tick}</div>
        </div>
      )}
    </section>
  );
}
