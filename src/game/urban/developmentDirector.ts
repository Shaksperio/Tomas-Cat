import type { AgentProfession } from '../society/contracts';
import { canStaff, requiredTeam, type TeamSlot } from './developmentRoles';
import type { ProjectProposal, UrbanContext, Violation } from './types';
import { buildableEnvelope, evaluateProject, ZONING_RULES } from './urbanPlanning';

export const MUNICIPAL_DEVELOPER_ID = 'cowila-municipal';
const PEOPLE_PER_UNIT = 2;

interface Template { id: string; width: number; depth: number; floors: number; height: number; units: number }
/** Modelos aprovados do desenvolvedor: a IA escolhe um, nunca inventa dimensões. */
export const HOUSING_TEMPLATES: readonly Template[] = [
  { id: 'predio', width: 10, depth: 10, floors: 3, height: 10, units: 6 },
  { id: 'sobrado', width: 7, depth: 7, floors: 2, height: 7, units: 2 },
  { id: 'casa', width: 5, depth: 5, floors: 1, height: 3.5, units: 1 },
];

export interface DevelopmentState {
  tick: number;
  worldId: string;
  population: number;
  /** Moradias prontas + em obra neste mundo. */
  housingUnits: number;
  availableProfessions: ReadonlyMap<AgentProfession, number>;
}

export interface RejectedCandidate { lotId: string; template: string; violations: Violation[] }

export interface DevelopmentDecision {
  decision: 'approve' | 'none';
  reason: string;
  proposal?: ProjectProposal;
  team?: TeamSlot[];
  rejected: RejectedCandidate[];
}

/**
 * Diretor de desenvolvimento da Cowila (determinístico, sem rede): identifica o
 * déficit de moradia, escolhe lote e modelo, e só devolve projeto que o motor de
 * urbanismo aprova e que a equipe disponível consegue executar. Cada rejeição fica
 * registrada para auditoria. Nada aqui altera o mundo: quem executa é a sociedade.
 */
export function planHousingDevelopment(state: DevelopmentState, ctx: UrbanContext): DevelopmentDecision {
  const deficit = Math.ceil(state.population / PEOPLE_PER_UNIT) - state.housingUnits;
  if (deficit <= 0) return { decision: 'none', reason: 'Sem déficit de moradia.', rejected: [] };

  const rejected: RejectedCandidate[] = [];
  const lots = [...ctx.lots.values()]
    .filter((l) => l.worldId === state.worldId && l.status === 'free' && l.ownerId === MUNICIPAL_DEVELOPER_ID
      && ZONING_RULES[l.zone].allowedUses.includes('residential'))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (lots.length === 0) return { decision: 'none', reason: 'Nenhum lote residencial municipal livre.', rejected };

  let staffingNote = '';
  for (const lot of lots) {
    const envelope = buildableEnvelope(lot);
    if (!envelope) continue;
    // Prefere o maior modelo que cobre o déficit sem passar muito; cai para menores.
    const templates = HOUSING_TEMPLATES.filter((t) => t.units <= Math.max(deficit, 1) || t.units === 1);
    for (const template of templates) {
      if (template.width > envelope.width || template.depth > envelope.depth) continue;
      const proposal: ProjectProposal = {
        id: `dev:${state.worldId}:${lot.id}:${template.id}`,
        lotId: lot.id,
        developerId: MUNICIPAL_DEVELOPER_ID,
        use: 'residential',
        footprint: { width: template.width, depth: template.depth },
        offset: { x: envelope.x - lot.x, z: envelope.z - lot.z },
        floors: template.floors,
        height: template.height,
        units: template.units,
      };
      const result = evaluateProject(proposal, ctx);
      if (!result.approved) { rejected.push({ lotId: lot.id, template: template.id, violations: result.violations }); continue; }
      const team = requiredTeam(template.floors, template.units);
      const staffing = canStaff(team, state.availableProfessions);
      if (!staffing.ok) { staffingNote = staffing.missing.join('; '); continue; }
      return { decision: 'approve', reason: `Déficit de ${deficit} moradia(s): ${template.id} no lote ${lot.id}.`, proposal, team, rejected };
    }
  }
  return {
    decision: 'none',
    reason: staffingNote ? `Projeto viável, mas sem equipe: ${staffingNote}.` : 'Nenhum projeto aprovado pelas regras urbanísticas.',
    rejected,
  };
}
