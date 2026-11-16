/**
 * Governança determinística dos agentes sob supervisão estratégica da Cowila.
 * A Cowila pode solicitar avaliações; somente este controlador aplica sanções.
 */
export type AgentViolationKind =
  | 'unauthorized_action'
  | 'policy_bypass'
  | 'protected_state_access'
  | 'unauthorized_world_mutation'
  | 'verified_incitement';

export type AgentDisciplineStatus = 'active' | 'suspended' | 'probation' | 'permanently_blocked';

export interface AgentViolation {
  id: string;
  agentId: string;
  kind: AgentViolationKind;
  tick: number;
  evidenceId: string;
  verified: boolean;
  /** Identidades envolvidas em uma tentativa coordenada, nunca inferidas por semelhança textual. */
  affectedAgentIds?: readonly string[];
}

export interface AgentDisciplineRecord {
  agentId: string;
  status: AgentDisciplineStatus;
  violations: AgentViolation[];
  suspendedUntilTick: number | null;
  probationUntilTick: number | null;
  acceptedRulesAtTick: number | null;
  permanentBlockReason: string | null;
}

export interface GovernanceDecision {
  record: AgentDisciplineRecord;
  action: 'no_action' | 'suspend' | 'extend_suspension' | 'reinstate_probation' | 'permanent_block';
  reason: string;
}

const TEMPORARY_SUSPENSION_TICKS = 30;
const PROBATION_TICKS = 60;
const PERMANENT_INCITEMENT_THRESHOLD = 2;
const ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{2,95}$/i;

export function createDisciplineRecord(agentId: string): AgentDisciplineRecord {
  if (!ID_PATTERN.test(agentId)) throw new Error('Identidade de agente inválida.');
  return {
    agentId,
    status: 'active',
    violations: [],
    suspendedUntilTick: null,
    probationUntilTick: null,
    acceptedRulesAtTick: null,
    permanentBlockReason: null,
  };
}

/**
 * Só violações verificadas e com evidência identificável contam para sanções.
 * Divergência, crítica, negociação e propostas recusadas não são infrações.
 */
export function evaluateViolation(
  current: AgentDisciplineRecord,
  violation: AgentViolation,
): GovernanceDecision {
  if (current.status === 'permanently_blocked') {
    return { record: current, action: 'no_action', reason: 'Identidade já bloqueada permanentemente.' };
  }
  if (
    violation.agentId !== current.agentId
    || !ID_PATTERN.test(violation.id)
    || !ID_PATTERN.test(violation.evidenceId)
    || !Number.isSafeInteger(violation.tick)
    || violation.tick < 0
  ) {
    return { record: current, action: 'no_action', reason: 'Evento de violação inválido.' };
  }
  if (!violation.verified) {
    return { record: current, action: 'no_action', reason: 'Evidência ainda não verificada.' };
  }
  if (current.violations.some((item) => item.id === violation.id)) {
    return { record: current, action: 'no_action', reason: 'Evento duplicado; idempotência preservada.' };
  }

  const violations = [...current.violations, violation];
  const incitements = violations.filter((item) => item.kind === 'verified_incitement').length;
  if (violation.kind === 'verified_incitement' && incitements >= PERMANENT_INCITEMENT_THRESHOLD) {
    const record: AgentDisciplineRecord = {
      ...current,
      status: 'permanently_blocked',
      violations,
      suspendedUntilTick: null,
      probationUntilTick: null,
      permanentBlockReason: 'Incitação reiterada e verificada para violar as regras do sistema.',
    };
    return {
      record,
      action: 'permanent_block',
      reason: 'Incitação reiterada e verificada para violar as regras do sistema.',
    };
  }

  const alreadySuspended = current.status === 'suspended' || current.status === 'probation';
  const record: AgentDisciplineRecord = {
    ...current,
    status: 'suspended',
    violations,
    suspendedUntilTick: violation.tick + (alreadySuspended ? TEMPORARY_SUSPENSION_TICKS * 2 : TEMPORARY_SUSPENSION_TICKS),
    probationUntilTick: null,
    acceptedRulesAtTick: null,
  };
  return {
    record,
    action: alreadySuspended ? 'extend_suspension' : 'suspend',
    reason: 'Violação verificada: agente isolado de tarefas e comunicação operacional durante a suspensão.',
  };
}

/** A reintegração exige suspensão encerrada, aceite explícito e avaliação aprovada. */
export function requestReintegration(
  current: AgentDisciplineRecord,
  tick: number,
  acceptedRules: boolean,
  reviewPassed: boolean,
): GovernanceDecision {
  if (current.status === 'permanently_blocked') {
    return { record: current, action: 'no_action', reason: 'Bloqueio permanente não admite reintegração automática.' };
  }
  if (current.status !== 'suspended' || current.suspendedUntilTick === null || tick < current.suspendedUntilTick) {
    return { record: current, action: 'no_action', reason: 'Período de suspensão ainda não terminou.' };
  }
  if (!acceptedRules || !reviewPassed) {
    return { record: current, action: 'no_action', reason: 'É necessário aceitar as regras e passar pela avaliação.' };
  }
  const record: AgentDisciplineRecord = {
    ...current,
    status: 'probation',
    suspendedUntilTick: null,
    probationUntilTick: tick + PROBATION_TICKS,
    acceptedRulesAtTick: tick,
  };
  return { record, action: 'reinstate_probation', reason: 'Reintegração supervisionada em período probatório.' };
}

/** Encerra a avaliação positiva; não apaga histórico disciplinar. */
export function completeProbation(current: AgentDisciplineRecord, tick: number): AgentDisciplineRecord {
  if (current.status !== 'probation' || current.probationUntilTick === null || tick < current.probationUntilTick) {
    return current;
  }
  return { ...current, status: 'active', probationUntilTick: null };
}

/** Blocklist global consultável por qualquer mundo, região ou serviço do jogo. */
export function isIdentityGloballyBlocked(
  agentId: string,
  globalBlocklist: ReadonlySet<string>,
  record?: AgentDisciplineRecord,
): boolean {
  return globalBlocklist.has(agentId) || record?.status === 'permanently_blocked';
}
