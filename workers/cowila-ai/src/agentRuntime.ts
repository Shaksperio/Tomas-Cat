/**
 * Hermes-inspired runtime primitives for Cowila's specialist agents.
 *
 * Skills describe bounded expertise; tools describe capabilities, not arbitrary
 * executable code. The game simulation remains the only authority that mutates
 * world state. Delegation is single-hop and every proposal is auditable.
 */
export const AGENT_RUNTIME_VERSION = '1.0.0';
export const MAX_DELEGATION_DEPTH = 1;
export const MAX_PROPOSALS_PER_CYCLE = 3;

export interface RuntimeAgent {
  id: string;
  profession: string;
  allowedTasks: readonly string[];
  status: string;
  activeTaskId: string | null;
}

export interface AgentSkill {
  id: string;
  version: number;
  profession: string;
  description: string;
  taskKinds: readonly string[];
  toolCapabilities: readonly string[];
}

export interface ToolCapability {
  id: string;
  description: string;
  effect: 'read' | 'propose';
  requiresWorldAuthority: boolean;
}

export interface DelegationRequest {
  agentId: string;
  taskKind: string;
  reason: string;
  priority: number;
  depth?: number;
}

export interface DelegationAudit {
  agentId: string;
  skillId: string | null;
  taskKind: string;
  accepted: boolean;
  reason: string;
  depth: number;
}

export const AGENT_TOOL_CAPABILITIES: readonly ToolCapability[] = [
  { id: 'world.read_snapshot', description: 'Ler snapshot autorizado da sociedade.', effect: 'read', requiresWorldAuthority: false },
  { id: 'society.propose_task', description: 'Propor tarefa para validação determinística.', effect: 'propose', requiresWorldAuthority: true },
  { id: 'construction.propose_blueprint', description: 'Propor blueprint com módulos aprovados.', effect: 'propose', requiresWorldAuthority: true },
  { id: 'memory.read_agent', description: 'Consultar memória resumida do próprio agente.', effect: 'read', requiresWorldAuthority: false },
] as const;

export const AGENT_SKILLS: readonly AgentSkill[] = [
  { id: 'skill.engineering', version: 1, profession: 'engineer', description: 'Exploração, planejamento urbano e projetos de construção.', taskKinds: ['survey_site', 'design_project', 'prepare_site', 'repair_structure'], toolCapabilities: ['world.read_snapshot', 'society.propose_task', 'construction.propose_blueprint', 'memory.read_agent'] },
  { id: 'skill.construction', version: 1, profession: 'worker', description: 'Preparação de terreno, transporte, construção e reparo.', taskKinds: ['gather_materials', 'transport_materials', 'prepare_site', 'build_module', 'repair_structure'], toolCapabilities: ['world.read_snapshot', 'society.propose_task', 'memory.read_agent'] },
  { id: 'skill.warden', version: 1, profession: 'agent', description: 'Patrulha, investigação e mediação comunitária.', taskKinds: ['patrol_area', 'investigate_event', 'mediate_conflict'], toolCapabilities: ['world.read_snapshot', 'society.propose_task', 'memory.read_agent'] },
  { id: 'skill.agriculture', version: 1, profession: 'farmer', description: 'Cultivo, colheita e segurança alimentar.', taskKinds: ['cultivate_field', 'harvest_food'], toolCapabilities: ['world.read_snapshot', 'society.propose_task', 'memory.read_agent'] },
  { id: 'skill.forestry', version: 1, profession: 'lumberjack', description: 'Coleta sustentável de madeira.', taskKinds: ['chop_wood'], toolCapabilities: ['world.read_snapshot', 'society.propose_task', 'memory.read_agent'] },
  { id: 'skill.mining', version: 1, profession: 'miner', description: 'Extração controlada de pedra e minerais.', taskKinds: ['mine_stone'], toolCapabilities: ['world.read_snapshot', 'society.propose_task', 'memory.read_agent'] },
  { id: 'skill.carpentry', version: 1, profession: 'carpenter', description: 'Transformação de madeira em materiais de construção.', taskKinds: ['craft_planks'], toolCapabilities: ['world.read_snapshot', 'society.propose_task', 'memory.read_agent'] },
  { id: 'skill.trade', version: 1, profession: 'merchant', description: 'Trocas e equilíbrio dos estoques comunitários.', taskKinds: ['trade_goods'], toolCapabilities: ['world.read_snapshot', 'society.propose_task', 'memory.read_agent'] },
] as const;

export function getSkillForProfession(profession: string): AgentSkill | undefined {
  return AGENT_SKILLS.find((skill) => skill.profession === profession);
}

export function buildAgentRuntimeContext(agents: readonly RuntimeAgent[]) {
  return {
    version: AGENT_RUNTIME_VERSION,
    maxDelegationDepth: MAX_DELEGATION_DEPTH,
    maxProposalsPerCycle: MAX_PROPOSALS_PER_CYCLE,
    skills: agents.map((agent) => {
      const skill = getSkillForProfession(agent.profession);
      return {
        agentId: agent.id,
        skillId: skill?.id ?? null,
        skillVersion: skill?.version ?? null,
        taskKinds: skill ? skill.taskKinds.filter((task) => agent.allowedTasks.includes(task)) : [],
        toolCapabilities: skill?.toolCapabilities ?? ['world.read_snapshot'],
      };
    }),
    toolPolicy: AGENT_TOOL_CAPABILITIES,
  };
}

/** One-hop delegation only; validates both runtime skill and caller permissions. */
export function authorizeDelegation(
  request: DelegationRequest,
  agents: readonly RuntimeAgent[],
): DelegationAudit {
  const depth = Number.isSafeInteger(request.depth) ? Number(request.depth) : 0;
  const agent = agents.find((candidate) => candidate.id === request.agentId);
  const skill = agent ? getSkillForProfession(agent.profession) : undefined;
  let reason = 'Proposta autorizada para validação pelo motor.';
  let accepted = true;
  if (depth > MAX_DELEGATION_DEPTH || depth < 0) {
    accepted = false;
    reason = 'Profundidade de delegação excede o limite de um nível.';
  } else if (!agent || agent.status !== 'idle' || agent.activeTaskId !== null) {
    accepted = false;
    reason = 'Agente inexistente ou indisponível.';
  } else if (!skill || !skill.taskKinds.includes(request.taskKind) || !agent.allowedTasks.includes(request.taskKind)) {
    accepted = false;
    reason = 'Skill ou permissão do agente não autoriza esta tarefa.';
  } else if (!request.reason.trim() || request.reason.length > 220 || !Number.isFinite(request.priority)) {
    accepted = false;
    reason = 'Justificativa ou prioridade inválida.';
  }
  return { agentId: request.agentId, skillId: skill?.id ?? null, taskKind: request.taskKind, accepted, reason, depth };
}
