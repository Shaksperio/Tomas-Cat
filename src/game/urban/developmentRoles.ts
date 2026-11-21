import type { AgentProfession } from '../society/contracts';

/**
 * Papéis de um empreendimento. Mapeados sobre as 8 profissões que já existem na
 * sociedade, sem criar uma segunda sociedade: o papel diz O QUE a pessoa faz no
 * projeto; a profissão continua sendo a autoridade para atribuir tarefas.
 */
export type DevelopmentRole =
  | 'urbanist' | 'architect' | 'civil_engineer' | 'electrical_engineer' | 'hydraulic_engineer'
  | 'safety_engineer' | 'site_foreman' | 'laborer' | 'inspector';

export const ROLE_PROFESSION: Readonly<Record<DevelopmentRole, AgentProfession>> = {
  urbanist: 'engineer',
  architect: 'engineer',
  civil_engineer: 'engineer',
  electrical_engineer: 'engineer',
  hydraulic_engineer: 'engineer',
  safety_engineer: 'engineer',
  site_foreman: 'carpenter',
  laborer: 'worker',
  inspector: 'agent',
};

export interface TeamSlot { role: DevelopmentRole; count: number }

/** Equipe mínima por porte: residência pequena (1–2 pavimentos) ou edifício (3+). */
export function requiredTeam(floors: number, units: number): TeamSlot[] {
  const big = floors >= 3 || units > 2;
  const team: TeamSlot[] = [
    { role: 'urbanist', count: 1 },
    { role: 'architect', count: 1 },
    { role: 'civil_engineer', count: 1 },
    { role: 'site_foreman', count: 1 },
    { role: 'laborer', count: big ? 4 : 2 },
    { role: 'inspector', count: 1 },
  ];
  if (big) team.push({ role: 'electrical_engineer', count: 1 }, { role: 'hydraulic_engineer', count: 1 }, { role: 'safety_engineer', count: 1 });
  return team;
}

/**
 * Conta quantos agentes de cada profissão o time exige (engenheiros acumulam papéis
 * de projeto: um engenheiro pode ser urbanista e arquiteto em obras pequenas, mas
 * nunca ser inspetor da própria obra).
 */
export function professionDemand(team: readonly TeamSlot[]): Map<AgentProfession, number> {
  const demand = new Map<AgentProfession, number>();
  for (const slot of team) demand.set(ROLE_PROFESSION[slot.role], (demand.get(ROLE_PROFESSION[slot.role]) ?? 0) + slot.count);
  return demand;
}

export function canStaff(team: readonly TeamSlot[], available: ReadonlyMap<AgentProfession, number>): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const [profession, needed] of professionDemand(team)) {
    // Papéis técnicos de projeto são sequenciais e podem ser acumulados por engenheiros: exige-se no mínimo 2.
    const required = profession === 'engineer' ? Math.min(needed, 2) : needed;
    if ((available.get(profession) ?? 0) < required) missing.push(`${profession}: faltam ${required - (available.get(profession) ?? 0)}`);
  }
  return { ok: missing.length === 0, missing };
}
