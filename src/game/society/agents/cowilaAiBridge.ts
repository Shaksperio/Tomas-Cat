/**
 * Converte propostas do Worker Cowila IA em SpecialistTaskProposal
 * alinhadas ao catálogo de skills canônicas (PR #62/#64).
 *
 * O GameEngine ainda monta a proposta manualmente sem skillId; esta ponte
 * preenche skillId, sectorId, prioridade limitada e valida o taskKind
 * contra a skill da profissão do agente.
 */

import type { AgentTask } from '../contracts';
import type { SocietySimulationSnapshot } from '../simulation';
import { getSpecialistProfile } from './catalog';
import type { CowilaAiProposal } from './cowilaAiClient';
import type { SpecialistTaskProposal } from './policies';
import { listSocietySkills } from './skills';
import { clampPriority } from './skillLearning';

const TASK_KINDS = new Set<string>([
  'survey_site', 'design_project', 'prepare_site', 'repair_structure',
  'gather_materials', 'transport_materials', 'build_module',
  'patrol_area', 'investigate_event', 'mediate_conflict',
  'cultivate_field', 'harvest_food', 'chop_wood', 'mine_stone',
  'craft_planks', 'trade_goods',
]);

function isTaskKind(value: string): value is AgentTask['kind'] {
  return TASK_KINDS.has(value);
}

/**
 * Resolve skill canônica pela profissão do agente e taskKind da proposta.
 * Preferência: skill cuja allowedTaskKinds inclui o taskKind.
 */
export function resolveSkillIdForAgentTask(
  profession: string,
  taskKind: AgentTask['kind'],
): string | undefined {
  const match = listSocietySkills().find(
    (skill) => skill.profession === profession && skill.allowedTaskKinds.includes(taskKind),
  );
  return match?.id;
}

/**
 * Constrói proposta local a partir da resposta remota da Cowila.
 * Devolve null se agente, taskKind ou skill forem incompatíveis.
 */
export function bridgeCowilaAiProposal(
  proposal: CowilaAiProposal,
  snapshot: SocietySimulationSnapshot,
  proposalId: string,
): SpecialistTaskProposal | null {
  if (!isTaskKind(proposal.taskKind)) return null;
  const agent = snapshot.agents.find((candidate) => candidate.id === proposal.agentId);
  if (!agent) return null;
  const profile = getSpecialistProfile(agent.profession);
  if (!profile || !profile.allowedTasks.includes(proposal.taskKind)) return null;

  const skillId = resolveSkillIdForAgentTask(agent.profession, proposal.taskKind);
  if (!skillId) return null;

  const reason = proposal.reason.trim().slice(0, 240);
  if (!reason) return null;

  return {
    proposalId,
    skillId,
    agentId: agent.id,
    taskKind: proposal.taskKind,
    sectorId: agent.position.sectorId,
    target: null,
    requiredResources: proposal.taskKind === 'craft_planks' ? { wood: 7 } : {},
    reason,
    priority: clampPriority(proposal.priority),
    createdAtTick: snapshot.tick,
  };
}

/**
 * Converte a lista de propostas do Worker; ignora entradas inválidas.
 */
export function bridgeCowilaAiDecisionProposals(
  proposals: readonly CowilaAiProposal[],
  snapshot: SocietySimulationSnapshot,
  tick: number,
): SpecialistTaskProposal[] {
  const out: SpecialistTaskProposal[] = [];
  for (const proposal of proposals) {
    const proposalId = `cowila-ai:${tick}:${proposal.agentId}:${proposal.taskKind}`;
    const bridged = bridgeCowilaAiProposal(proposal, snapshot, proposalId);
    if (bridged) out.push(bridged);
  }
  return out;
}
