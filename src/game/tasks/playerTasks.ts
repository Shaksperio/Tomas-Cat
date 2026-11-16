/** Sistema determinístico de pedidos dos habitantes. Não depende de UI ou do motor. */
export type PlayerTaskEvent = 'food_collected' | 'water_drunk' | 'scrap_collected' | 'enemy_defeated' | 'shelter_upgraded';
export interface PlayerTaskDefinition {
  id: string;
  agentId: string;
  title: string;
  description: string;
  event: PlayerTaskEvent;
  target: number;
  rewardXp: number;
  rewardScrap: number;
}
export interface PlayerTaskState {
  id: string;
  progress: number;
  status: 'active' | 'completed';
}
export const PLAYER_TASKS: readonly PlayerTaskDefinition[] = [
  { id: 'help:engineer-01', agentId: 'engineer-01', title: 'Materiais para Íris', description: 'Recolha 3 unidades de sucata.', event: 'scrap_collected', target: 3, rewardXp: 35, rewardScrap: 2 },
  { id: 'help:worker-01', agentId: 'worker-01', title: 'Materiais para Tico', description: 'Recolha 5 unidades de sucata.', event: 'scrap_collected', target: 5, rewardXp: 45, rewardScrap: 3 },
  { id: 'help:worker-02', agentId: 'worker-02', title: 'Reparo para Nina', description: 'Melhore um abrigo.', event: 'shelter_upgraded', target: 1, rewardXp: 40, rewardScrap: 2 },
  { id: 'help:agent-01', agentId: 'agent-01', title: 'Ronda de Bento', description: 'Derrote um inimigo nas ruas.', event: 'enemy_defeated', target: 1, rewardXp: 50, rewardScrap: 2 },
  { id: 'help:farmer-01', agentId: 'farmer-01', title: 'Colheita de Amora', description: 'Recolha 3 alimentos.', event: 'food_collected', target: 3, rewardXp: 35, rewardScrap: 1 },
  { id: 'help:lumberjack-01', agentId: 'lumberjack-01', title: 'Madeira reaproveitada', description: 'Recolha 4 unidades de sucata útil.', event: 'scrap_collected', target: 4, rewardXp: 40, rewardScrap: 2 },
  { id: 'help:miner-01', agentId: 'miner-01', title: 'Segurança na encosta', description: 'Derrote 2 inimigos durante a exploração.', event: 'enemy_defeated', target: 2, rewardXp: 65, rewardScrap: 3 },
  { id: 'help:carpenter-01', agentId: 'carpenter-01', title: 'Reparo de Serafim', description: 'Melhore um abrigo.', event: 'shelter_upgraded', target: 1, rewardXp: 45, rewardScrap: 3 },
  { id: 'help:merchant-01', agentId: 'merchant-01', title: 'Água para o depósito', description: 'Beba água limpa duas vezes.', event: 'water_drunk', target: 2, rewardXp: 30, rewardScrap: 2 },
] as const;
const definitions = new Map(PLAYER_TASKS.map((task) => [task.id, task]));
export function acceptPlayerTask(states: readonly PlayerTaskState[], taskId: string): PlayerTaskState[] {
  if (!definitions.has(taskId) || states.some((task) => task.id === taskId)) return [...states];
  return [...states, { id: taskId, progress: 0, status: 'active' }];
}
export function advancePlayerTasks(states: readonly PlayerTaskState[], event: PlayerTaskEvent, amount = 1): { states: PlayerTaskState[]; completed: PlayerTaskDefinition[] } {
  if (!Number.isFinite(amount) || amount <= 0) return { states: states.map((task) => ({ ...task })), completed: [] };
  const completed: PlayerTaskDefinition[] = [];
  const next = states.map((state) => {
    if (state.status !== 'active') return { ...state };
    const definition = definitions.get(state.id);
    if (!definition || definition.event !== event) return { ...state };
    const progress = Math.min(definition.target, state.progress + Math.floor(amount));
    if (progress >= definition.target) completed.push(definition);
    return { ...state, progress, status: progress >= definition.target ? 'completed' as const : 'active' as const };
  });
  return { states: next, completed };
}
export function getPlayerTaskDefinition(taskId: string): PlayerTaskDefinition | undefined { return definitions.get(taskId); }
