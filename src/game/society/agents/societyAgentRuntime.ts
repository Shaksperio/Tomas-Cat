/**
 * Runtime unificado dos agentes de IA da sociedade.
 *
 * Encapsula: avanço da simulação, memória, ciclo estratégico da Cowila e
 * registro de blueprints no WorldConstructionRuntime.
 *
 * Não modifica a classe SocietySimulation internamente — apenas a consome.
 * Sem LLM, sem rede, sem geometria inventada.
 */

import { validateConstructionProject } from '../contracts';
import type { SocietySimulation, SocietySimulationSnapshot } from '../simulation';
import { WorldConstructionRuntime } from '../worldConstructionRuntime';
import type { ReadyConstructionPlacement } from '../worldConstructionRuntime';
import {
  emptyAgentMemory,
  ingestEventsIntoMemory,
  type AgentMemoryBook,
} from './agentMemory';
import {
  blueprintToProposedProject,
  COWILA_APPROVED_ASSETS,
  runCowilaStrategicCycle,
  type CowilaDirective,
} from './cowilaCoordinator';

export interface SocietyAgentRuntimeConfig {
  /** Intervalo de ticks entre ciclos estratégicos da Cowila. */
  cowilaEveryTicks?: number;
  /** IDs de assets que o runtime de construção aceita. */
  approvedAssetIds?: ReadonlySet<string>;
}

export interface SocietyAgentRuntimeFrame {
  snapshot: SocietySimulationSnapshot;
  memory: AgentMemoryBook;
  directive: CowilaDirective | null;
  /** Blueprints aceitos e registrados neste frame (0..n). */
  registeredProjectIds: string[];
  /** Placements prontos para a camada 3D (ainda não publicados). */
  readyPlacements: ReadyConstructionPlacement[];
}

const DEFAULT_ASSETS = new Set<string>([...COWILA_APPROVED_ASSETS]);

function canAfford(
  snapshot: SocietySimulationSnapshot,
  required: Record<string, number>,
): boolean {
  return Object.entries(required).every(([key, amount]) => {
    const stock = snapshot.resources[key as keyof SocietySimulationSnapshot['resources']];
    return typeof stock === 'number' && stock >= amount;
  });
}

export class SocietyAgentRuntime {
  private memory: AgentMemoryBook = emptyAgentMemory();
  private lastDirective: CowilaDirective | null = null;
  private readonly construction: WorldConstructionRuntime;
  private readonly cowilaEveryTicks: number;
  private lastCowilaTick = -1;
  private readonly registeredBlueprintIds = new Set<string>();

  constructor(config: SocietyAgentRuntimeConfig = {}) {
    this.cowilaEveryTicks = Math.max(1, config.cowilaEveryTicks ?? 25);
    this.construction = new WorldConstructionRuntime(
      config.approvedAssetIds ?? DEFAULT_ASSETS,
    );
  }

  getMemory(): AgentMemoryBook {
    return this.memory;
  }

  getLastDirective(): CowilaDirective | null {
    return this.lastDirective;
  }

  getConstructionRuntime(): WorldConstructionRuntime {
    return this.construction;
  }

  /**
   * Avança a simulação e aplica a camada de agentes.
   * O GameEngine pode chamar isto no lugar de `simulation.step` isolado.
   */
  step(simulation: SocietySimulation, steps = 1): SocietyAgentRuntimeFrame {
    const snapshot = simulation.step(steps);
    this.memory = ingestEventsIntoMemory(this.memory, snapshot.events, snapshot.tick);

    const registeredProjectIds: string[] = [];
    let directive: CowilaDirective | null = this.lastDirective;

    const due =
      this.lastCowilaTick < 0
      || snapshot.tick - this.lastCowilaTick >= this.cowilaEveryTicks;

    if (due) {
      directive = runCowilaStrategicCycle(snapshot, this.memory);
      this.lastDirective = directive;
      this.lastCowilaTick = snapshot.tick;

      const engineer = snapshot.agents.find((a) => a.profession === 'engineer');
      for (const bp of directive.blueprints) {
        if (this.registeredBlueprintIds.has(bp.projectId)) continue;
        if (!engineer) continue;
        if (!canAfford(snapshot, bp.requiredResources)) continue;

        const project = blueprintToProposedProject(bp, engineer.id, snapshot.tick);
        // Validação de contrato; status precisa ser validated/active para o runtime de obra.
        project.status = 'validated';
        project.taskIds = [`build-${bp.projectId}-0`];
        const validation = validateConstructionProject(project);
        if (!validation.valid) continue;

        const registered = this.construction.registerProject(project);
        if (!registered.valid) continue;

        // Uma tarefa sintética concluída libera o placement (ponte até o scheduler de obras).
        this.construction.completeTask(project.id, project.taskIds[0]);
        this.registeredBlueprintIds.add(bp.projectId);
        registeredProjectIds.push(project.id);
      }
    }

    const readyPlacements = this.construction.getReadyPlacements();

    return {
      snapshot,
      memory: this.memory,
      directive,
      registeredProjectIds,
      readyPlacements,
    };
  }

  /** Marca placements já enviados ao SocietyActors / mundo 3D. */
  markPlacementsPublished(projectIds: readonly string[]): number {
    let n = 0;
    for (const id of projectIds) {
      if (this.construction.markProjectPublished(id)) n += 1;
    }
    return n;
  }
}
