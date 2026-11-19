import {
  validateResourceMap,
  validateWorldPosition,
  type AgentTask,
  type ValidationResult,
} from '../contracts';
import type { SocietySimulationSnapshot } from '../simulation';
import { getSpecialistProfile } from './catalog';

export interface SpecialistTaskProposal {
  proposalId: string;
  skillId?: string;
  agentId: string;
  taskKind: AgentTask['kind'];
  sectorId: string;
  target: AgentTask['target'];
  requiredResources: Record<string, number>;
  reason: string;
  priority: number;
  createdAtTick: number;
}

export interface ProposalDecision {
  accepted: boolean;
  reason: string;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{2,95}$/i;
const MAX_REASON_LENGTH = 240;

export function validateSpecialistProposal(
  proposal: SpecialistTaskProposal,
  snapshot: SocietySimulationSnapshot,
): ValidationResult {
  if (!ID_PATTERN.test(proposal.proposalId) || !ID_PATTERN.test(proposal.agentId)) {
    return { valid: false, reason: 'Identificador de proposta ou agente inválido.' };
  }
  if (!Number.isSafeInteger(proposal.createdAtTick) || proposal.createdAtTick !== snapshot.tick) {
    return { valid: false, reason: 'A proposta pertence a outro tick da simulação.' };
  }
  if (!Number.isFinite(proposal.priority) || proposal.priority < 0 || proposal.priority > 100) {
    return { valid: false, reason: 'Prioridade fora do intervalo permitido.' };
  }
  if (!proposal.reason.trim() || proposal.reason.length > MAX_REASON_LENGTH) {
    return { valid: false, reason: 'A justificativa está vazia ou excede o limite.' };
  }
  if (!proposal.sectorId.trim()) {
    return { valid: false, reason: 'Setor de destino inválido.' };
  }
  const resources = validateResourceMap(proposal.requiredResources);
  if (!resources.valid) return resources;

  const agent = snapshot.agents.find((candidate) => candidate.id === proposal.agentId);
  if (!agent) return { valid: false, reason: 'Agente não encontrado.' };
  const profile = getSpecialistProfile(agent.profession);
  if (!profile || !profile.allowedTasks.includes(proposal.taskKind)) {
    return { valid: false, reason: 'A profissão não tem autorização para esta tarefa.' };
  }
  if (agent.status !== 'idle' || agent.activeTaskId !== null || agent.energy <= 0 || agent.health <= 0) {
    return { valid: false, reason: 'Agente indisponível para receber nova tarefa.' };
  }
  if (proposal.sectorId !== agent.position.sectorId && proposal.sectorId !== agent.homeSectorId) {
    return { valid: false, reason: 'Agente não pode receber tarefa fora de seu setor autorizado.' };
  }
  if (proposal.target) {
    const position = validateWorldPosition(proposal.target);
    if (!position.valid) return position;
    if (proposal.target.sectorId !== proposal.sectorId) {
      return { valid: false, reason: 'Alvo e tarefa precisam pertencer ao mesmo setor.' };
    }
  }
  if (Object.entries(proposal.requiredResources).some(([resource, amount]) =>
    amount > (snapshot.resources[resource as keyof typeof snapshot.resources] ?? 0))) {
    return { valid: false, reason: 'Estoque comunitário insuficiente.' };
  }
  if (snapshot.tasks.some((task) =>
    task.assignedAgentId === agent.id && ['queued', 'assigned', 'in_progress'].includes(task.status))) {
    return { valid: false, reason: 'O agente já possui trabalho pendente.' };
  }
  if (snapshot.tasks.some((task) =>
    task.kind === proposal.taskKind && task.sectorId === proposal.sectorId
      && ['queued', 'assigned', 'in_progress'].includes(task.status))) {
    return { valid: false, reason: 'Já existe uma tarefa equivalente em andamento.' };
  }
  return { valid: true };
}

/**
 * Política final de autorização. Propostas nunca alteram a simulação: o chamador
 * recebe apenas uma decisão e deve encaminhar tarefas aceitas ao controlador
 * autoritativo, que fará a atribuição e consumirá recursos atomicamente.
 */
export function authorizeSpecialistProposal(
  proposal: SpecialistTaskProposal,
  snapshot: SocietySimulationSnapshot,
): ProposalDecision {
  const validation = validateSpecialistProposal(proposal, snapshot);
  return validation.valid
    ? { accepted: true, reason: 'Proposta validada; aguardando controlador autoritativo.' }
    : { accepted: false, reason: validation.reason };
}
