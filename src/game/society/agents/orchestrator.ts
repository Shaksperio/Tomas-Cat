import type { AgentTask } from '../contracts';
import type { SocietySimulationSnapshot } from '../simulation';
import { getSpecialistProfile, SPECIALIST_PROFILES } from './catalog';
import {
  authorizeSpecialistProposal,
  type SpecialistTaskProposal,
} from './policies';

export interface SpecialistCycleReport {
  tick: number;
  proposals: SpecialistTaskProposal[];
  rejected: Array<{ proposalId: string; reason: string }>;
  mode: 'deterministic-fallback';
}

/** Tarefa-padrão por papel: a IA pode sugerir, mas não inventa tipos de tarefa. */
const DEFAULT_TASK: Partial<Record<AgentTask['requiredProfession'], AgentTask['kind']>> = {
  engineer: 'survey_site',
  worker: 'gather_materials',
  agent: 'patrol_area',
  farmer: 'cultivate_field',
  lumberjack: 'chop_wood',
  miner: 'mine_stone',
  carpenter: 'craft_planks',
  merchant: 'trade_goods',
};

/**
 * Ciclo determinístico da Cowila local. Produz propostas tipadas para agentes
 * ociosos sem alterar agentes, tarefas, recursos, relações ou eventos.
 * Quando o provedor generativo estiver indisponível, este caminho continua
 * funcionando e mantém a simulação reproduzível.
 */
export function runSpecialistCycle(snapshot: SocietySimulationSnapshot): SpecialistCycleReport {
  const proposals: SpecialistTaskProposal[] = [];
  const rejected: SpecialistCycleReport['rejected'] = [];
  const agents = [...snapshot.agents].sort((a, b) => a.id.localeCompare(b.id));

  for (const agent of agents) {
    const profile = getSpecialistProfile(agent.profession);
    const taskKind = DEFAULT_TASK[agent.profession];
    if (!profile || !taskKind || agent.status !== 'idle' || agent.activeTaskId !== null) continue;

    const proposalId = `specialist:${agent.id}:${snapshot.tick}:${taskKind}`;
    const proposal: SpecialistTaskProposal = {
      proposalId,
      agentId: agent.id,
      taskKind,
      sectorId: agent.position.sectorId,
      target: null,
      requiredResources: taskKind === 'craft_planks' ? { wood: 7 } : {},
      reason: `Rotina de ${profile.title.toLocaleLowerCase('pt-BR')} para manter a comunidade operacional.`,
      priority: profile.priority,
      createdAtTick: snapshot.tick,
    };
    const decision = authorizeSpecialistProposal(proposal, snapshot);
    if (decision.accepted) proposals.push(proposal);
    else if (!snapshot.tasks.some((task) => task.kind === taskKind
      && ['queued', 'assigned', 'in_progress'].includes(task.status))) {
      rejected.push({ proposalId, reason: decision.reason });
    }
  }

  proposals.sort((a, b) => b.priority - a.priority || a.proposalId.localeCompare(b.proposalId));
  return { tick: snapshot.tick, proposals, rejected, mode: 'deterministic-fallback' };
}

/** Exposição do catálogo em ordem estável para HUD, debug e ferramentas da Cowila. */
export function listSpecialistRoles(): readonly string[] {
  return SPECIALIST_PROFILES.map((profile) => profile.id);
}
