/**
 * Runtime unificado dos agentes de IA da sociedade.
 *
 * Encapsula: avanço da simulação, memória, ciclo estratégico da Cowila e
 * registro de blueprints no WorldConstructionRuntime.
 *
 * Não modifica a classe SocietySimulation internamente — apenas a consome.
 * Não conclui tarefas de construção sozinho (operários / scheduler fazem isso).
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
  /** Projetos validados e registrados neste frame (aguardando tarefas). */
  registeredProjectIds: string[];
  /** Placements prontos quando todas as tarefas do projeto forem completeTask'd. */
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
        project.status = 'validated';
        // Tarefa de obra a ser cumprida pelo scheduler/operários — não auto-concluída aqui.
        project.taskIds = [`build-${bp.projectId}-0`];
        const validation = validateConstructionProject(project);
        if (!validation.valid) continue;

        const registered = this.construction.registerProject(project);
        if (!registered.valid) continue;

        this.registeredBlueprintIds.add(bp.projectId);
        registeredProjectIds.push(project.id);
      }
    }

    return {
      snapshot,
      memory: this.memory,
      directive,
      registeredProjectIds,
      readyPlacements: this.construction.getReadyPlacements(),
    };
  }

  /**
   * Notifica o runtime de construção que uma tarefa de obra foi concluída
   * (chamado quando o simulador emite task_completed de build_module, etc.).
   */
  notifyConstructionTaskComplete(projectId: string, taskId: string): boolean {
    return this.construction.completeTask(projectId, taskId);
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
