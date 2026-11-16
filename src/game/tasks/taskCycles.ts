/** Tarefas cíclicas determinísticas: um ciclo a cada 600 s de jogo ativo. */
export const TASK_CYCLE_SECONDS = 600;
export type CycleTaskEvent = 'food_collected' | 'water_drunk' | 'scrap_collected' | 'enemy_defeated';
export interface CycleTaskStage {
  event: CycleTaskEvent;
  target: number;
  label: string;
}
export interface CycleTaskDefinition {
  id: string;
  title: string;
  description: string;
  stages: readonly CycleTaskStage[];
  rewardXp: number;
  rewardScrap: number;
}
export interface CycleTaskInstance {
  id: string;
  cycle: number;
  title: string;
  description: string;
  stages: CycleTaskStage[];
  stageIndex: number;
  progress: number;
  status: 'active' | 'completed';
  rewardXp: number;
  rewardScrap: number;
}
export interface TaskCycleState {
  activeSeconds: number;
  cycleNumber: number;
  issuedIds: string[];
  tasks: CycleTaskInstance[];
}
export const CYCLE_TASK_CATALOG: readonly CycleTaskDefinition[] = [
  { id: 'scavenge-food', title: 'Suprimentos para a jornada', description: 'Reúna alimentos e depois sucata para preparar o abrigo.', stages: [{ event: 'food_collected', target: 3, label: 'Recolher alimentos' }, { event: 'scrap_collected', target: 2, label: 'Recolher sucata' }], rewardXp: 55, rewardScrap: 4 },
  { id: 'clean-water', title: 'Água segura', description: 'Encontre água e mantenha Tomas abastecido.', stages: [{ event: 'water_drunk', target: 2, label: 'Beber água' }, { event: 'food_collected', target: 2, label: 'Recolher alimentos' }], rewardXp: 45, rewardScrap: 3 },
  { id: 'street-patrol', title: 'Patrulha das ruas', description: 'Afaste ameaças e recolha materiais úteis.', stages: [{ event: 'enemy_defeated', target: 2, label: 'Derrotar inimigos' }, { event: 'scrap_collected', target: 3, label: 'Recolher sucata' }], rewardXp: 75, rewardScrap: 5 },
  { id: 'emergency-cache', title: 'Reserva de emergência', description: 'Monte uma reserva de comida e água.', stages: [{ event: 'food_collected', target: 4, label: 'Recolher alimentos' }, { event: 'water_drunk', target: 2, label: 'Beber água' }], rewardXp: 60, rewardScrap: 3 },
  { id: 'repair-materials', title: 'Materiais de reparo', description: 'Reúna materiais e proteja a comunidade.', stages: [{ event: 'scrap_collected', target: 5, label: 'Recolher sucata' }, { event: 'enemy_defeated', target: 1, label: 'Derrotar uma ameaça' }], rewardXp: 65, rewardScrap: 6 },
  { id: 'hunter-route', title: 'Trilha do caçador', description: 'Consiga alimento e vença os perigos do caminho.', stages: [{ event: 'enemy_defeated', target: 1, label: 'Derrotar uma ameaça' }, { event: 'food_collected', target: 3, label: 'Recolher alimentos' }], rewardXp: 70, rewardScrap: 4 },
  { id: 'recon-mission', title: 'Reconhecimento', description: 'Explore com cautela, enfrentando ameaças e reunindo suprimentos.', stages: [{ event: 'water_drunk', target: 1, label: 'Beber água' }, { event: 'enemy_defeated', target: 2, label: 'Derrotar inimigos' }], rewardXp: 80, rewardScrap: 5 },
  { id: 'community-stock', title: 'Estoque comunitário', description: 'Ajude a reforçar os estoques da cidade.', stages: [{ event: 'food_collected', target: 2, label: 'Recolher alimentos' }, { event: 'scrap_collected', target: 4, label: 'Recolher sucata' }, { event: 'water_drunk', target: 1, label: 'Beber água' }], rewardXp: 90, rewardScrap: 7 },
] as const;
export function createTaskCycleState(): TaskCycleState {
  return { activeSeconds: 0, cycleNumber: 0, issuedIds: [], tasks: [] };
}
function nextDefinition(state: TaskCycleState): CycleTaskDefinition | undefined {
  const available = CYCLE_TASK_CATALOG.filter((definition) => !state.issuedIds.includes(definition.id));
  if (available.length === 0) return undefined;
  // Ordem determinística; a sequência varia por ciclo sem depender de Math.random.
  const index = (state.cycleNumber * 5 + 3) % available.length;
  return available[index];
}
export function tickTaskCycle(state: TaskCycleState, deltaSeconds: number): { state: TaskCycleState; created: CycleTaskInstance[] } {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { state: cloneTaskCycleState(state), created: [] };
  const next = cloneTaskCycleState(state);
  next.activeSeconds += Math.min(deltaSeconds, 1);
  const created: CycleTaskInstance[] = [];
  while (next.activeSeconds >= TASK_CYCLE_SECONDS) {
    next.activeSeconds -= TASK_CYCLE_SECONDS;
    next.cycleNumber += 1;
    const definition = nextDefinition(next);
    if (!definition) continue;
    next.issuedIds.push(definition.id);
    const task: CycleTaskInstance = {
      id: `cycle-${next.cycleNumber}:${definition.id}`,
      cycle: next.cycleNumber,
      title: definition.title,
      description: definition.description,
      stages: definition.stages.map((stage) => ({ ...stage })),
      stageIndex: 0,
      progress: 0,
      status: 'active',
      rewardXp: definition.rewardXp,
      rewardScrap: definition.rewardScrap,
    };
    next.tasks.push(task);
    created.push(task);
  }
  return { state: next, created };
}
export function advanceTaskCycleEvent(state: TaskCycleState, event: CycleTaskEvent, amount = 1): { state: TaskCycleState; completed: CycleTaskInstance[] } {
  const next = cloneTaskCycleState(state);
  if (!Number.isFinite(amount) || amount <= 0) return { state: next, completed: [] };
  const completed: CycleTaskInstance[] = [];
  for (const task of next.tasks) {
    if (task.status !== 'active') continue;
    const stage = task.stages[task.stageIndex];
    if (!stage || stage.event !== event) continue;
    task.progress = Math.min(stage.target, task.progress + Math.floor(amount));
    if (task.progress >= stage.target) {
      if (task.stageIndex < task.stages.length - 1) {
        task.stageIndex += 1;
        task.progress = 0;
      } else {
        task.status = 'completed';
        completed.push({ ...task, stages: task.stages.map((item) => ({ ...item })) });
      }
    }
  }
  return { state: next, completed };
}
export function cloneTaskCycleState(state: TaskCycleState): TaskCycleState {
  return {
    activeSeconds: Number.isFinite(state.activeSeconds) ? Math.max(0, state.activeSeconds % TASK_CYCLE_SECONDS) : 0,
    cycleNumber: Number.isFinite(state.cycleNumber) ? Math.max(0, Math.floor(state.cycleNumber)) : 0,
    issuedIds: Array.isArray(state.issuedIds) ? [...new Set(state.issuedIds.filter((id) => CYCLE_TASK_CATALOG.some((item) => item.id === id)))] : [],
    tasks: Array.isArray(state.tasks) ? state.tasks.flatMap((task) => {
      if (!task || typeof task.id !== 'string' || !Array.isArray(task.stages) || task.stages.length === 0) return [];
      const stageIndex = Math.max(0, Math.min(task.stages.length - 1, Math.floor(task.stageIndex || 0)));
      const stages = task.stages.filter((stage) => stage && Number.isFinite(stage.target) && stage.target > 0 && ['food_collected', 'water_drunk', 'scrap_collected', 'enemy_defeated'].includes(stage.event));
      if (stages.length !== task.stages.length) return [];
      return [{ ...task, stages: stages.map((stage) => ({ ...stage, target: Math.floor(stage.target) })), stageIndex, progress: Math.max(0, Math.min(stages[stageIndex].target, Math.floor(task.progress || 0))), status: task.status === 'completed' ? 'completed' as const : 'active' as const }];
    }) : [],
  };
}
