/**
 * Cowila — coordenadora estratégica local e determinística.
 *
 * Não executa movimentos, não altera recursos e não chama LLM.
 * Lê o snapshot da sociedade (+ memória opcional) e devolve diretivas
 * tipadas para o controlador autoritativo / engenheiros validarem.
 */

import type { SocietySimulationSnapshot } from '../simulation';
import type { ConstructionProject } from '../contracts';
import type { AgentMemoryBook } from './agentMemory';
import { memoryForAgent } from './agentMemory';

/** IDs de módulo que a Cowila pode sugerir (subconjunto seguro do catálogo futuro). */
export const COWILA_APPROVED_ASSETS = [
  'module_shelter_basic',
  'module_warehouse',
  'module_workshop',
  'module_farm_plot',
  'module_watchtower',
  'module_market_stall',
] as const;

export type CowilaApprovedAsset = (typeof COWILA_APPROVED_ASSETS)[number];

export type ResourceFocus = 'food' | 'wood' | 'stone' | 'planks' | 'coins' | 'balanced';

export interface CowilaBlueprintSuggestion {
  /** Skill que originou o planejamento; não concede autorização de execução. */
  skillId: string;
  projectId: string;
  name: string;
  sectorId: string;
  assetId: CowilaApprovedAsset;
  x: number;
  z: number;
  rotationY: number;
  requiredResources: Record<string, number>;
  reason: string;
}

export interface CowilaDirective {
  tick: number;
  mode: 'deterministic-strategic';
  resourceFocus: ResourceFocus;
  /** Mensagem curta em pt-BR para HUD / logs. */
  brief: string;
  /** Ênfase por profissão (0–100). */
  professionPriority: Record<string, number>;
  blueprints: CowilaBlueprintSuggestion[];
  /** Agentes que a Cowila destaca neste tick (ex.: engenheiro ocioso). */
  highlightedAgentIds: string[];
}

const DEFAULT_COST: Record<CowilaApprovedAsset, Record<string, number>> = {
  module_shelter_basic: { wood: 4, stone: 2 },
  module_warehouse: { wood: 6, stone: 4, planks: 2 },
  module_workshop: { wood: 5, stone: 2, planks: 3 },
  module_farm_plot: { wood: 2 },
  module_watchtower: { wood: 8, stone: 3 },
  module_market_stall: { wood: 3, planks: 2 },
};

function pickResourceFocus(snapshot: SocietySimulationSnapshot): ResourceFocus {
  const r = snapshot.resources;
  if (r.food < 12) return 'food';
  if (r.wood < 10) return 'wood';
  if (r.stone < 8) return 'stone';
  if (r.planks < 4) return 'planks';
  if (r.coins < 20) return 'coins';
  return 'balanced';
}

function professionPriorityForFocus(focus: ResourceFocus): Record<string, number> {
  const base: Record<string, number> = {
    engineer: 70,
    worker: 70,
    agent: 50,
    farmer: 60,
    lumberjack: 55,
    miner: 55,
    carpenter: 50,
    merchant: 45,
  };
  if (focus === 'food') base.farmer = 95;
  if (focus === 'wood') base.lumberjack = 95;
  if (focus === 'stone') base.miner = 95;
  if (focus === 'planks') base.carpenter = 95;
  if (focus === 'coins') base.merchant = 95;
  if (focus === 'balanced') {
    base.engineer = 85;
    base.worker = 80;
  }
  return base;
}

function chooseAsset(focus: ResourceFocus, tick: number): CowilaApprovedAsset {
  if (focus === 'food') return 'module_farm_plot';
  if (focus === 'wood' || focus === 'stone' || focus === 'planks') return 'module_warehouse';
  if (focus === 'coins') return 'module_market_stall';
  const cycle: CowilaApprovedAsset[] = [
    'module_shelter_basic',
    'module_workshop',
    'module_watchtower',
  ];
  return cycle[Math.abs(tick) % cycle.length];
}

/**
 * Ciclo estratégico da Cowila. Puro e determinístico.
 */
export function runCowilaStrategicCycle(
  snapshot: SocietySimulationSnapshot,
  memory: AgentMemoryBook = { byAgent: {} },
): CowilaDirective {
  const focus = pickResourceFocus(snapshot);
  const professionPriority = professionPriorityForFocus(focus);
  const assetId = chooseAsset(focus, snapshot.tick);

  const engineers = snapshot.agents
    .filter((a) => a.profession === 'engineer' && a.status !== 'disabled')
    .sort((a, b) => a.id.localeCompare(b.id));
  const engineer = engineers[0];

  const blueprints: CowilaBlueprintSuggestion[] = [];
  if (engineer) {
    const sectorId = engineer.position.sectorId;
    const offset = (snapshot.tick % 7) * 3;
    blueprints.push({
      skillId: 'engineer.survey-and-design',
      projectId: `cowila-bp-${snapshot.tick}-${assetId}`,
      name: `Obra prioritária (${assetId.replace(/^module_/, '').replace(/_/g, ' ')})`,
      sectorId,
      assetId,
      x: engineer.position.x + 6 + offset,
      z: engineer.position.z - 4,
      rotationY: 0,
      requiredResources: { ...DEFAULT_COST[assetId] },
      reason:
        focus === 'balanced'
          ? 'Expansão comunitária com módulo aprovado pelo motor.'
          : `Resposta à escassez relativa de ${focus}.`,
    });
  }

  const highlightedAgentIds = snapshot.agents
    .filter((a) => a.status === 'idle')
    .sort((a, b) => (professionPriority[b.profession] ?? 0) - (professionPriority[a.profession] ?? 0)
      || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((a) => a.id);

  const engineerMemory = engineer ? memoryForAgent(memory, engineer.id) : [];
  const memoryHint = engineerMemory[0]?.summary;

  const briefParts = [
    `Foco: ${focus}.`,
    blueprints[0] ? `Sugestão: ${blueprints[0].name}.` : 'Sem engenheiro disponível para blueprint.',
  ];
  if (memoryHint) briefParts.push(`Histórico: ${memoryHint}`);

  return {
    tick: snapshot.tick,
    mode: 'deterministic-strategic',
    resourceFocus: focus,
    brief: briefParts.join(' '),
    professionPriority,
    blueprints,
    highlightedAgentIds,
  };
}

/**
 * Converte um blueprint da Cowila em ConstructionProject 'proposed'
 * para validação via validateConstructionProject (contracts).
 */
export function blueprintToProposedProject(
  blueprint: CowilaBlueprintSuggestion,
  engineerAgentId: string,
  tick: number,
): ConstructionProject {
  return {
    id: blueprint.projectId,
    name: blueprint.name,
    status: 'proposed',
    sectorId: blueprint.sectorId,
    modules: [
      {
        assetId: blueprint.assetId,
        position: {
          x: blueprint.x,
          z: blueprint.z,
          sectorId: blueprint.sectorId,
        },
        rotationY: blueprint.rotationY,
      },
    ],
    requiredResources: { ...blueprint.requiredResources },
    taskIds: [],
    createdByAgentId: engineerAgentId,
    createdAtTick: tick,
    version: 1,
  };
}
