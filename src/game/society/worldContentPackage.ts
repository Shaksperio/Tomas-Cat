import {
  validateConstructionProject,
  type ConstructionProject,
  type ValidationResult,
} from './contracts';

export interface WorldContentPackageInput {
  contentId: string;
  contentVersion: number;
  worldId: string;
  scenarioTemplateId: string;
  minimumEngineVersion: string;
  project: ConstructionProject;
}

export interface WorldContentPackage {
  manifest: {
    schemaVersion: 1;
    contentId: string;
    contentVersion: number;
    worldId: string;
    scenarioTemplateId: string;
    minimumEngineVersion: string;
    moduleCount: number;
  };
  district: {
    projectId: string;
    name: string;
    sectorId: string;
    createdAtTick: number;
  };
  placements: Array<{
    placementId: string;
    assetId: string;
    x: number;
    z: number;
    rotationY: number;
  }>;
  provenance: {
    createdByAgentId: string;
    sourceProjectVersion: number;
    sourceTaskIds: string[];
  };
}

const SAFE_CONTENT_ID = /^[a-z0-9][a-z0-9._-]{2,95}$/i;
const MAX_MODULES_PER_PACKAGE = 500;

/**
 * Converte um projeto já concluído em conteúdo declarativo versionável.
 * Não executa código, não cria geometria e não faz chamadas ao GitHub.
 */
export function createWorldContentPackage(
  input: WorldContentPackageInput,
  approvedWorldIds: ReadonlySet<string>,
  approvedTemplateIds: ReadonlySet<string>,
  approvedAssetIds: ReadonlySet<string>,
): { valid: true; package: WorldContentPackage } | { valid: false; reason: string } {
  if (!SAFE_CONTENT_ID.test(input.contentId) || !SAFE_CONTENT_ID.test(input.worldId)
    || !SAFE_CONTENT_ID.test(input.scenarioTemplateId)) {
    return { valid: false, reason: 'Identificador do pacote, mundo ou cenário inválido.' };
  }
  if (!Number.isInteger(input.contentVersion) || input.contentVersion < 1) {
    return { valid: false, reason: 'A versão do conteúdo deve ser um inteiro positivo.' };
  }
  if (!input.minimumEngineVersion.trim()) {
    return { valid: false, reason: 'A versão mínima do motor é obrigatória.' };
  }
  if (!approvedWorldIds.has(input.worldId) || !approvedTemplateIds.has(input.scenarioTemplateId)) {
    return { valid: false, reason: 'Mundo ou template não aprovado pelo catálogo do motor.' };
  }
  const projectValidation: ValidationResult = validateConstructionProject(input.project);
  if (!projectValidation.valid) return projectValidation;
  if (input.project.status !== 'completed') {
    return { valid: false, reason: 'Somente projetos concluídos podem ser promovidos.' };
  }
  if (input.project.modules.length > MAX_MODULES_PER_PACKAGE) {
    return { valid: false, reason: 'O pacote excede o limite de módulos permitido.' };
  }
  if (input.project.modules.some((module) => !approvedAssetIds.has(module.assetId))) {
    return { valid: false, reason: 'O projeto contém asset que não pertence ao catálogo aprovado.' };
  }

  const placements = input.project.modules.map((module, index) => ({
    placementId: `${input.project.id}:placement:${index + 1}`,
    assetId: module.assetId,
    x: module.position.x,
    z: module.position.z,
    rotationY: module.rotationY,
  }));

  return {
    valid: true,
    package: {
      manifest: {
        schemaVersion: 1,
        contentId: input.contentId,
        contentVersion: input.contentVersion,
        worldId: input.worldId,
        scenarioTemplateId: input.scenarioTemplateId,
        minimumEngineVersion: input.minimumEngineVersion,
        moduleCount: placements.length,
      },
      district: {
        projectId: input.project.id,
        name: input.project.name,
        sectorId: input.project.sectorId,
        createdAtTick: input.project.createdAtTick,
      },
      placements,
      provenance: {
        createdByAgentId: input.project.createdByAgentId,
        sourceProjectVersion: input.project.version,
        sourceTaskIds: [...input.project.taskIds].sort(),
      },
    },
  };
}

/** Serialização estável para commits reproduzíveis e comparação de revisões. */
export function serializeWorldContentPackage(content: WorldContentPackage): string {
  return JSON.stringify({
    manifest: content.manifest,
    district: content.district,
    placements: [...content.placements].sort((a, b) => a.placementId.localeCompare(b.placementId)),
    provenance: {
      ...content.provenance,
      sourceTaskIds: [...content.provenance.sourceTaskIds].sort(),
    },
  }, null, 2);
}
