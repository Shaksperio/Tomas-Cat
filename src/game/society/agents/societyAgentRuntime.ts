/**
 * Runtime unificado dos agentes de IA da sociedade.
 *
 * Encapsula: avanço da simulação, memória, ciclo estratégico da Cowila e
 * registro de blueprints no WorldConstructionRuntime.
 *
 * Quando a simulação emite task_completed de build_module, avança a próxima
 * tarefa pendente de um projeto registrado (ponte determinística até a obra 3D).
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
  cowilaEveryTicks?: number;
  approvedAssetIds?: ReadonlySet<string>;
}

export interface SocietyAgentRuntimeFrame {
  snapshot: SocietySimulationSnapshot;
  memory: AgentMemoryBook;
  directive: CowilaDirective | null;
  registeredProjectIds: string[];
  /** Projetos cuja tarefa de obra avançou neste frame. */
  advancedProjectIds: string[];
  readyPlacements: ReadyConstructionPlacement[];
}

const DEFAULT_ASSETS = new Set<string>([...COWILA_APPROVED_ASSETS]);

function canAfford(
  snapshot: SocietySimulationSnapshot,
  required: Record<string, number>,
): boolean {
  const craftCount = Math.ceil((required.planks ?? 0) / 2);
  const requiredWood = (required.wood ?? 0) + craftCount * 3;
  if (snapshot.resources.wood < requiredWood) return false;
  return Object.entries(required).every(([key, amount]) => {
    if (key === 'planks' || key === 'wood') return true;
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
  /** projectId → taskIds na ordem de execução. */
  private readonly projectTaskQueue = new Map<string, string[]>();
  private readonly processedBuildEventIds = new Set<string>();

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
        const craftCount = Math.ceil((bp.requiredResources.planks ?? 0) / 2);
        project.taskIds = [
          `construction:${bp.projectId}:gather`,
          ...Array.from({ length: craftCount }, (_, index) => `construction:${bp.projectId}:craft:${index}`),
          `construction:${bp.projectId}:transport`,
          `construction:${bp.projectId}:prepare`,
          ...project.modules.map((_, index) => `construction:${bp.projectId}:build:${index}`),
        ];
        const validation = validateConstructionProject(project);
        if (!validation.valid) continue;

        const registered = this.construction.registerProject(project);
        if (!registered.valid) continue;

        const scheduledTaskIds = simulation.scheduleConstructionProject(project);
        if (!scheduledTaskIds) {
          this.construction.unregisterProject(project.id);
          continue;
        }

        this.registeredBlueprintIds.add(bp.projectId);
        this.projectTaskQueue.set(project.id, scheduledTaskIds);
        registeredProjectIds.push(project.id);
      }
    }

    const advancedProjectIds = this.advanceConstructionFromBuildEvents(snapshot);

    return {
      snapshot,
      memory: this.memory,
      directive,
      registeredProjectIds,
      advancedProjectIds,
      readyPlacements: this.construction.getReadyPlacements(),
    };
  }

  /**
   * Só avança o projeto cuja tarefa vinculada aparece explicitamente no evento.
   * Eventos genéricos de build_module não podem concluir projetos por FIFO.
   */
  private advanceConstructionFromBuildEvents(
    snapshot: SocietySimulationSnapshot,
  ): string[] {
    const advanced: string[] = [];
    const buildEvents = snapshot.events
      .filter((e) => {
        if (e.kind !== 'task_completed') return false;
        if (this.processedBuildEventIds.has(e.id)) return false;
        const payload = e.payload as { constructionProjectId?: unknown; taskId?: unknown };
        return typeof payload.constructionProjectId === 'string'
          && typeof payload.taskId === 'string';
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const event of buildEvents) {
      const payload = event.payload as { taskId: string; constructionProjectId: string };
      // O evento precisa identificar o mesmo projeto e a próxima tarefa da
      // cadeia. Eventos genéricos ou fora de ordem nunca avançam a obra.
      const projectEntry = [...this.projectTaskQueue.entries()]
        .find(([projectId, queue]) => projectId === payload.constructionProjectId && queue[0] === payload.taskId);
      if (!projectEntry) continue;
      const [projectId, queue] = projectEntry;
      this.processedBuildEventIds.add(event.id);
      const taskId = payload.taskId;
      const progress = this.construction.getProjectProgress(projectId);
      if (!progress || progress.completedTasks >= progress.totalTasks) continue;
      if (!this.construction.completeTask(projectId, taskId)) continue;
      this.projectTaskQueue.set(projectId, queue.slice(1));
      advanced.push(projectId);
    }

    if (this.processedBuildEventIds.size > 400) {
      const keep = [...this.processedBuildEventIds].sort().slice(-200);
      this.processedBuildEventIds.clear();
      for (const id of keep) this.processedBuildEventIds.add(id);
    }

    return advanced;
  }

  notifyConstructionTaskComplete(projectId: string, taskId: string): boolean {
    return this.construction.completeTask(projectId, taskId);
  }

  markPlacementsPublished(projectIds: readonly string[]): number {
    let n = 0;
    for (const id of projectIds) {
      if (this.construction.markProjectPublished(id)) n += 1;
    }
    return n;
  }
}
