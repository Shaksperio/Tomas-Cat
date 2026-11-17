/**
 * Núcleo determinístico de uniões e descendência da sociedade.
 *
 * Um ano simulado corresponde a 1.200 ticks (12 meses de 100 ticks).
 * Uniões exigem aceitação explícita de ambas as identidades. Um nascimento
 * exige consentimento explícito dos dois agentes no mesmo ano simulado.
 * Este módulo não cria agentes no mundo por conta própria: produz registros
 * de descendência para o controlador autoritativo integrar com segurança.
 */
export const SIMULATED_YEAR_TICKS = 1_200;
export const MATURITY_AGE_YEARS = 18;

export type UnionStatus = 'pending' | 'active' | 'declined';
export type LifeStage = 'infant' | 'child' | 'adolescent' | 'adult';

export interface AgentUnion {
  id: string;
  memberAgentIds: [string, string];
  status: UnionStatus;
  proposedAtTick: number;
  acceptedBy: string[];
  declinedBy: string[];
}

export interface OffspringRecord {
  id: string;
  unionId: string;
  parentAgentIds: [string, string];
  birthTick: number;
  birthYear: number;
  ageTicks: number;
  ageYears: number;
  lifeStage: LifeStage;
}

export interface SocietyFamilySnapshot {
  unions: AgentUnion[];
  offspring: OffspringRecord[];
}

export type FamilyResult<T> =
  | { accepted: true; value: T }
  | { accepted: false; reason: string };

const pairKey = (a: string, b: string): string => [a, b].sort().join(':');
const currentYear = (tick: number): number => Math.floor(tick / SIMULATED_YEAR_TICKS);

function lifeStageFor(ageYears: number): LifeStage {
  if (ageYears >= MATURITY_AGE_YEARS) return 'adult';
  if (ageYears >= 13) return 'adolescent';
  if (ageYears >= 3) return 'child';
  return 'infant';
}

/** Estado familiar isolado por instância; crie uma instância por mundo. */
export class SocietyFamilySystem {
  private readonly unions = new Map<string, AgentUnion>();
  private readonly offspring = new Map<string, OffspringRecord>();
  private readonly offspringConsent = new Map<string, Set<string>>();
  private readonly knownAgentIds: ReadonlySet<string>;

  constructor(knownAgentIds: readonly string[]) {
    this.knownAgentIds = new Set(knownAgentIds);
  }

  proposeUnion(proposerId: string, partnerId: string, tick: number): FamilyResult<AgentUnion> {
    if (proposerId === partnerId) return { accepted: false, reason: 'Um agente não pode formar união consigo mesmo.' };
    if (!this.knownAgentIds.has(proposerId) || !this.knownAgentIds.has(partnerId)) {
      return { accepted: false, reason: 'Ambos os agentes precisam existir neste mundo.' };
    }
    if (!Number.isSafeInteger(tick) || tick < 0) return { accepted: false, reason: 'Tick inválido.' };
    const pair = pairKey(proposerId, partnerId);
    const existing = [...this.unions.values()].find((union) =>
      pairKey(...union.memberAgentIds) === pair && union.status !== 'declined');
    if (existing) return { accepted: false, reason: 'Já existe uma proposta ou união para este casal.' };

    const id = `union:${pair}`;
    const union: AgentUnion = {
      id,
      memberAgentIds: [proposerId, partnerId],
      status: 'pending',
      proposedAtTick: tick,
      acceptedBy: [],
      declinedBy: [],
    };
    this.unions.set(id, union);
    return { accepted: true, value: this.copyUnion(union) };
  }

  respondToUnion(unionId: string, agentId: string, accept: boolean): FamilyResult<AgentUnion> {
    const union = this.unions.get(unionId);
    if (!union || union.status !== 'pending') return { accepted: false, reason: 'Proposta inexistente ou já encerrada.' };
    if (!union.memberAgentIds.includes(agentId)) return { accepted: false, reason: 'Somente os dois participantes podem responder.' };
    if (union.acceptedBy.includes(agentId) || union.declinedBy.includes(agentId)) {
      return { accepted: false, reason: 'Este agente já respondeu à proposta.' };
    }
    if (accept) union.acceptedBy.push(agentId);
    else union.declinedBy.push(agentId);
    if (!accept) union.status = 'declined';
    else if (union.acceptedBy.length === 2) union.status = 'active';
    return { accepted: true, value: this.copyUnion(union) };
  }

  /** Consentimento é específico por união e ano; ambos precisam confirmar. */
  consentToOffspring(
    unionId: string,
    agentId: string,
    consent: boolean,
    tick: number,
  ): FamilyResult<OffspringRecord | null> {
    const union = this.unions.get(unionId);
    if (!union || union.status !== 'active') return { accepted: false, reason: 'É necessária uma união ativa.' };
    if (!union.memberAgentIds.includes(agentId)) return { accepted: false, reason: 'Agente não pertence a esta união.' };
    if (!Number.isSafeInteger(tick) || tick < 0) return { accepted: false, reason: 'Tick inválido.' };
    const year = currentYear(tick);
    const id = `offspring:${unionId}:${year}`;
    if (this.offspring.has(id)) return { accepted: false, reason: 'O direito anual desta união já foi utilizado.' };

    const consentKey = `${unionId}:${year}`;
    const consents = this.offspringConsent.get(consentKey) ?? new Set<string>();
    if (!consent) {
      consents.delete(agentId);
      this.offspringConsent.set(consentKey, consents);
      return { accepted: true, value: null };
    }
    consents.add(agentId);
    this.offspringConsent.set(consentKey, consents);
    if (!union.memberAgentIds.every((memberId) => consents.has(memberId))) {
      return { accepted: true, value: null };
    }

    const record: OffspringRecord = {
      id,
      unionId,
      parentAgentIds: [...union.memberAgentIds],
      birthTick: tick,
      birthYear: year,
      ageTicks: 0,
      ageYears: 0,
      lifeStage: 'infant',
    };
    this.offspring.set(id, record);
    return { accepted: true, value: { ...record, parentAgentIds: [...record.parentAgentIds] } };
  }

  advanceToTick(tick: number): void {
    if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('Tick inválido.');
    for (const [id, child] of this.offspring) {
      const ageTicks = Math.max(0, tick - child.birthTick);
      const ageYears = ageTicks / SIMULATED_YEAR_TICKS;
      this.offspring.set(id, {
        ...child,
        ageTicks,
        ageYears,
        lifeStage: lifeStageFor(ageYears),
      });
    }
  }

  snapshot(): SocietyFamilySnapshot {
    return {
      unions: [...this.unions.values()].map((union) => this.copyUnion(union)),
      offspring: [...this.offspring.values()].map((child) => ({
        ...child,
        parentAgentIds: [...child.parentAgentIds],
      })),
    };
  }

  private copyUnion(union: AgentUnion): AgentUnion {
    return {
      ...union,
      memberAgentIds: [...union.memberAgentIds],
      acceptedBy: [...union.acceptedBy],
      declinedBy: [...union.declinedBy],
    };
  }
}
