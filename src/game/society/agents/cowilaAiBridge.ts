/**
 * Ponte entre decisões remotas da Cowila e o catálogo canônico de skills.
 * A simulação continua sendo a autoridade final: cada proposta é revalidada
 * por scheduleAiSpecialistTask antes de entrar na fila executável.
 */
import type { AgentTask } from '../contracts';
import type { SocietySimulation, SocietySimulationSnapshot } from '../simulation';
import { getSpecialistProfile } from './catalog';
import type { CowilaAiDecision, CowilaAiProposal } from './cowilaAiClient';
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

export function resolveSkillIdForAgentTask(
  profession: string,
  taskKind: AgentTask['kind'],
): string | undefined {
  return listSocietySkills().find(
    (skill) => skill.profession === profession && skill.allowedTaskKinds.includes(taskKind),
  )?.id;
}

export function bridgeCowilaAiProposal(
  proposal: CowilaAiProposal,
  snapshot: SocietySimulationSnapshot,
  proposalId: string,
): SpecialistTaskProposal | null {
  if (!proposal || typeof proposal.agentId !== 'string'
    || typeof proposal.taskKind !== 'string' || !isTaskKind(proposal.taskKind)
    || typeof proposal.reason !== 'string' || !Number.isFinite(proposal.priority)) return null;

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
    requiredResources: {},
    reason,
    priority: clampPriority(proposal.priority),
    createdAtTick: snapshot.tick,
  };
}

export interface ApplyCowilaAiResult {
  accepted: number;
  skipped: number;
  brief: string;
}

export function applyCowilaAiDecision(
  simulation: SocietySimulation,
  decision: CowilaAiDecision,
): ApplyCowilaAiResult {
  const snapshot = simulation.snapshot();
  if (!decision || !Number.isSafeInteger(decision.tick)
    || decision.tick > snapshot.tick || snapshot.tick - decision.tick > 25
    || !Array.isArray(decision.proposals) || typeof decision.brief !== 'string') {
    return {
      accepted: 0,
      skipped: Array.isArray(decision?.proposals) ? decision.proposals.length : 0,
      brief: typeof decision?.brief === 'string' ? decision.brief : '',
    };
  }

  let accepted = 0;
  for (const proposal of decision.proposals) {
    const proposalId = `cowila-ai:${decision.tick}:${proposal?.agentId ?? 'unknown'}:${proposal?.taskKind ?? 'unknown'}`;
    const bridged = bridgeCowilaAiProposal(proposal, snapshot, proposalId);
    if (bridged && simulation.scheduleAiSpecialistTask(bridged)) accepted += 1;
  }

  return {
    accepted,
    skipped: Math.max(0, decision.proposals.length - accepted),
    brief: decision.brief.slice(0, 500),
  };
}
