/**
 * Contratos locais da sociedade artificial.
 *
 * Este módulo é deliberadamente independente do GameEngine e de serviços remotos.
 * Ele define o vocabulário estável da simulação; nenhuma entidade é instanciada
 * automaticamente no mundo atual nesta fase.
 */

export const SOCIETY_CONTRACT_VERSION = 1 as const;

export type AgentProfession =
  | 'engineer'
  | 'worker'
  | 'agent'
  | 'farmer'
  | 'lumberjack'
  | 'miner'
  | 'carpenter'
  | 'merchant';
export type SocietyAgentStatus = 'idle' | 'working' | 'resting' | 'travelling' | 'disabled';
export type AgentTaskKind =
  | 'survey_site'
  | 'design_project'
  | 'gather_materials'
  | 'transport_materials'
  | 'prepare_site'
  | 'build_module'
  | 'repair_structure'
  | 'mediate_conflict'
  | 'patrol_area'
  | 'investigate_event'
  | 'cultivate_field'
  | 'harvest_food'
  | 'chop_wood'
  | 'mine_stone'
  | 'craft_planks'
  | 'trade_goods';
export type AgentTaskStatus = 'queued' | 'assigned' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type ConstructionProjectStatus = 'proposed' | 'validated' | 'active' | 'paused' | 'completed' | 'rejected';
export type WorldEventKind =
  | 'agent_spawned'
  | 'agent_state_changed'
  | 'task_created'
  | 'task_completed'
  | 'project_proposed'
  | 'project_started'
  | 'project_completed'
  | 'resource_changed'
  | 'trade_completed'
  | 'community_need_changed'
  | 'territory_changed'
  | 'wildlife_encounter'
  | 'social_interaction'
  | 'relationship_changed';

export interface WorldPosition {
  x: number;
  z: number;
  sectorId: string;
}

export interface SocietyAgent {
  id: string;
  displayName: string;
  profession: AgentProfession;
  status: SocietyAgentStatus;
  position: WorldPosition;
  level: number;
  energy: number;
  health: number;
  factionId: string;
  homeSectorId: string;
  activeTaskId: string | null;
  version: number;
}

export interface AgentTask {
  id: string;
  kind: AgentTaskKind;
  status: AgentTaskStatus;
  requiredProfession: AgentProfession;
  assignedAgentId: string | null;
  sectorId: string;
  target: WorldPosition | null;
  dependencies: string[];
  requiredResources: Record<string, number>;
  createdAtTick: number;
  updatedAtTick: number;
  version: number;
}

export interface ConstructionModule {
  /** Identificador de um módulo previamente aprovado pelo jogo. */
  assetId: string;
  position: WorldPosition;
  rotationY: number;
}

export interface ConstructionProject {
  id: string;
  name: string;
  status: ConstructionProjectStatus;
  sectorId: string;
  modules: ConstructionModule[];
  requiredResources: Record<string, number>;
  taskIds: string[];
  createdByAgentId: string;
  createdAtTick: number;
  version: number;
}

export interface WorldEvent<TPayload = Record<string, unknown>> {
  id: string;
  kind: WorldEventKind;
  regionId: string;
  tick: number;
  /** Chave estável para impedir que a mesma consequência seja aplicada duas vezes. */
  idempotencyKey: string;
  payload: TPayload;
  schemaVersion: typeof SOCIETY_CONTRACT_VERSION;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

const RESOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function validateResourceMap(resources: Record<string, number>): ValidationResult {
  for (const [resourceId, amount] of Object.entries(resources)) {
    if (!RESOURCE_ID_PATTERN.test(resourceId)) {
      return { valid: false, reason: `Invalid resource id: ${resourceId}` };
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return { valid: false, reason: `Invalid amount for resource: ${resourceId}` };
    }
  }
  return { valid: true };
}

export function validateWorldPosition(position: WorldPosition): ValidationResult {
  if (!position.sectorId.trim()) {
    return { valid: false, reason: 'Position must reference a sector.' };
  }
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) {
    return { valid: false, reason: 'Position coordinates must be finite numbers.' };
  }
  return { valid: true };
}

/**
 * Verifica se um agente pode receber uma tarefa sem alterar nenhum estado.
 * A atribuição efetiva e as transições continuam sendo responsabilidade do
 * futuro controlador autoritativo do mundo.
 */
export function canAgentAcceptTask(agent: SocietyAgent, task: AgentTask): ValidationResult {
  if (agent.status === 'disabled' || agent.status === 'resting') {
    return { valid: false, reason: 'Agent is not available for work.' };
  }
  if (agent.activeTaskId !== null) {
    return { valid: false, reason: 'Agent already has an active task.' };
  }
  if (task.status !== 'queued') {
    return { valid: false, reason: 'Only queued tasks can be assigned.' };
  }
  if (task.assignedAgentId !== null) {
    return { valid: false, reason: 'Task is already assigned.' };
  }
  if (agent.profession !== task.requiredProfession) {
    return { valid: false, reason: 'Agent profession does not match task requirement.' };
  }
  if (agent.level < 1 || agent.energy <= 0 || agent.health <= 0) {
    return { valid: false, reason: 'Agent does not meet minimum operational requirements.' };
  }
  return validateWorldPosition(agent.position);
}

export function canStartTask(task: AgentTask, completedTaskIds: ReadonlySet<string>): ValidationResult {
  if (task.status !== 'assigned') {
    return { valid: false, reason: 'Only assigned tasks can start.' };
  }
  const unresolvedDependency = task.dependencies.find((id) => !completedTaskIds.has(id));
  if (unresolvedDependency) {
    return { valid: false, reason: `Unresolved dependency: ${unresolvedDependency}` };
  }
  return validateResourceMap(task.requiredResources);
}

export function validateConstructionProject(project: ConstructionProject): ValidationResult {
  if (!project.id.trim() || !project.sectorId.trim() || !project.createdByAgentId.trim()) {
    return { valid: false, reason: 'Project identity, sector and creator are required.' };
  }
  if (project.modules.length === 0) {
    return { valid: false, reason: 'A construction project must contain at least one approved module.' };
  }
  if (project.modules.some((module) =>
    !module.assetId.trim()
    || module.position.sectorId !== project.sectorId
    || !Number.isFinite(module.rotationY)
    || !validateWorldPosition(module.position).valid
  )) {
    return { valid: false, reason: 'Project contains an invalid module placement.' };
  }
  return validateResourceMap(project.requiredResources);
}

export function isNewWorldEvent(
  event: WorldEvent,
  processedEventIds: ReadonlySet<string>,
  processedIdempotencyKeys: ReadonlySet<string>,
): boolean {
  return Boolean(
    event.id.trim()
    && event.regionId.trim()
    && event.idempotencyKey.trim()
    && Number.isInteger(event.tick)
    && event.tick >= 0
    && !processedEventIds.has(event.id)
    && !processedIdempotencyKeys.has(event.idempotencyKey),
  );
}
