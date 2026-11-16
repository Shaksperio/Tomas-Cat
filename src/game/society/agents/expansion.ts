import {
  validateConstructionProject,
  type ConstructionModule,
  type ConstructionProject,
  type ValidationResult,
} from '../contracts';

export type ExpansionKind = 'new_scenario' | 'city_district' | 'road_network' | 'bridge' | 'public_facility';

export interface WorldExpansionProposal {
  id: string;
  kind: ExpansionKind;
  title: string;
  worldId: string;
  sectorId: string;
  proposedByAgentId: string;
  engineerAgentId: string;
  workerAgentIds: string[];
  /** IDs de cenários e módulos precisam existir nos catálogos confiáveis do motor. */
  scenarioTemplateId: string;
  modules: ConstructionModule[];
  requiredResources: Record<string, number>;
  createdAtTick: number;
}

export interface ExpansionCatalog {
  playableWorldIds: ReadonlySet<string>;
  approvedScenarioTemplateIds: ReadonlySet<string>;
  approvedModuleAssetIds: ReadonlySet<string>;
}

const SAFE_ID = /^[a-z0-9][a-z0-9:_-]{2,95}$/i;

/**
 * Engenheiros desenham a expansão; operários executam as etapas materiais.
 * O catálogo é fornecido pelo motor: a IA não pode inventar templates ou assets.
 */
export function validateWorldExpansion(
  proposal: WorldExpansionProposal,
  catalog: ExpansionCatalog,
  projectCreator: ConstructionProject['createdByAgentId'] = proposal.engineerAgentId,
): ValidationResult {
  if (![proposal.id, proposal.worldId, proposal.sectorId, proposal.proposedByAgentId,
    proposal.engineerAgentId, proposal.scenarioTemplateId].every((id) => SAFE_ID.test(id))) {
    return { valid: false, reason: 'Identidade da expansão inválida.' };
  }
  if (!catalog.playableWorldIds.has(proposal.worldId)) {
    return { valid: false, reason: 'O mundo de destino não está habilitado para construção.' };
  }
  if (!catalog.approvedScenarioTemplateIds.has(proposal.scenarioTemplateId)) {
    return { valid: false, reason: 'Modelo de cenário não aprovado pelo motor.' };
  }
  if (proposal.modules.some((module) => !catalog.approvedModuleAssetIds.has(module.assetId))) {
    return { valid: false, reason: 'A expansão contém módulo 3D não autorizado.' };
  }
  if (!proposal.workerAgentIds.length || new Set(proposal.workerAgentIds).size !== proposal.workerAgentIds.length) {
    return { valid: false, reason: 'O projeto precisa de operários identificados sem duplicidade.' };
  }
  const project: ConstructionProject = {
    id: proposal.id,
    name: proposal.title,
    status: 'proposed',
    sectorId: proposal.sectorId,
    modules: proposal.modules,
    requiredResources: proposal.requiredResources,
    taskIds: [],
    createdByAgentId: projectCreator,
    createdAtTick: proposal.createdAtTick,
    version: 1,
  };
  return validateConstructionProject(project);
}

/** Cria tarefas de obra apenas depois da aprovação externa do projeto. */
export function canWorkersExecuteExpansion(
  proposal: WorldExpansionProposal,
  approvedProjectIds: ReadonlySet<string>,
  availableWorkerIds: ReadonlySet<string>,
): boolean {
  return approvedProjectIds.has(proposal.id)
    && proposal.workerAgentIds.length > 0
    && proposal.workerAgentIds.every((id) => availableWorkerIds.has(id));
}
