import {
  type AgentProfession,
  type AgentTask,
  type SocietyAgent,
  type WorldEvent,
  canAgentAcceptTask,
} from './contracts';

export interface AgentNeeds {
  hunger: number;
  social: number;
  morale: number;
}

export interface AgentRelationship {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  trust: number;
  affinity: number;
  interactionCount: number;
}

export interface SimulatedAgent extends SocietyAgent {
  needs: AgentNeeds;
}

export interface SocietySimulationSnapshot {
  tick: number;
  agents: SimulatedAgent[];
  tasks: AgentTask[];
  relationships: AgentRelationship[];
  events: WorldEvent[];
}

interface TaskRuntime {
  elapsedTicks: number;
  durationTicks: number;
}

const TASK_DURATION: Record<AgentTask['kind'], number> = {
  survey_site: 3,
  design_project: 5,
  gather_materials: 4,
  transport_materials: 3,
  prepare_site: 4,
  build_module: 8,
  repair_structure: 5,
  mediate_conflict: 3,
  patrol_area: 6,
  investigate_event: 4,
};

const clampNeed = (value: number): number => Math.max(0, Math.min(100, value));

function makeAgent(
  id: string,
  displayName: string,
  profession: AgentProfession,
  x: number,
  z: number,
): SimulatedAgent {
  return {
    id,
    displayName,
    profession,
    status: 'idle',
    position: { x, z, sectorId: 'suburb-01' },
    level: 1,
    energy: 100,
    health: 100,
    factionId: 'neighborhood',
    homeSectorId: 'suburb-01',
    activeTaskId: null,
    version: 1,
    needs: { hunger: 12, social: 18, morale: 75 },
  };
}

function makeTask(
  id: string,
  kind: AgentTask['kind'],
  profession: AgentProfession,
  tick: number,
): AgentTask {
  return {
    id,
    kind,
    status: 'queued',
    requiredProfession: profession,
    assignedAgentId: null,
    sectorId: 'suburb-01',
    target: null,
    dependencies: [],
    requiredResources: {},
    createdAtTick: tick,
    updatedAtTick: tick,
    version: 1,
  };
}

/**
 * Simulação local e reproduzível da sociedade. Não usa Date, Math.random,
 * rede ou IA generativa. A autoridade de servidor poderá reutilizar as mesmas
 * regras quando a persistência compartilhada for implantada.
 */
export class SocietySimulation {
  private tickCount = 0;
  private readonly agents = new Map<string, SimulatedAgent>();
  private readonly tasks = new Map<string, AgentTask>();
  private readonly taskRuntime = new Map<string, TaskRuntime>();
  private readonly relationships = new Map<string, AgentRelationship>();
  private readonly events: WorldEvent[] = [];
  private eventSequence = 0;

  constructor() {
    this.addAgent(makeAgent('engineer-01', 'Íris', 'engineer', -4, 2));
    this.addAgent(makeAgent('worker-01', 'Tico', 'worker', 2, 1));
    this.addAgent(makeAgent('worker-02', 'Nina', 'worker', 4, -2));
    this.addAgent(makeAgent('agent-01', 'Bento', 'agent', -2, -4));

    this.addRelationship('engineer-01', 'worker-01', 62, 48);
    this.addRelationship('engineer-01', 'worker-02', 58, 54);
    this.addRelationship('worker-01', 'worker-02', 72, 78);

    this.enqueueTask(makeTask('task-survey-01', 'survey_site', 'engineer', 0));
    this.enqueueTask(makeTask('task-gather-01', 'gather_materials', 'worker', 0));
    this.enqueueTask(makeTask('task-patrol-01', 'patrol_area', 'agent', 0));
  }

  private addAgent(agent: SimulatedAgent): void {
    this.agents.set(agent.id, agent);
    this.emit('agent_spawned', agent.id, { agentId: agent.id, profession: agent.profession });
  }

  private addRelationship(fromAgentId: string, toAgentId: string, trust: number, affinity: number): void {
    const id = [fromAgentId, toAgentId].sort().join(':');
    this.relationships.set(id, {
      id,
      fromAgentId,
      toAgentId,
      trust,
      affinity,
      interactionCount: 0,
    });
  }

  private enqueueTask(task: AgentTask): void {
    this.tasks.set(task.id, task);
    this.taskRuntime.set(task.id, {
      elapsedTicks: 0,
      durationTicks: TASK_DURATION[task.kind],
    });
    this.emit('task_created', task.id, { taskId: task.id, kind: task.kind });
  }

  private emit(
    kind: WorldEvent['kind'],
    sourceId: string,
    payload: Record<string, unknown>,
  ): void {
    this.eventSequence += 1;
    const id = `local-event-${this.eventSequence}`;
    this.events.push({
      id,
      kind,
      regionId: 'local-suburb',
      tick: this.tickCount,
      idempotencyKey: `local:${kind}:${sourceId}:${this.tickCount}`,
      payload,
      schemaVersion: 1,
    });
    if (this.events.length > 200) this.events.shift();
  }

  private assignQueuedTasks(): void {
    const queued = [...this.tasks.values()]
      .filter((task) => task.status === 'queued')
      .sort((a, b) => a.createdAtTick - b.createdAtTick || a.id.localeCompare(b.id));

    for (const task of queued) {
      const candidate = [...this.agents.values()]
        .filter((agent) => canAgentAcceptTask(agent, task).valid)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!candidate) continue;

      task.status = 'assigned';
      task.assignedAgentId = candidate.id;
      task.updatedAtTick = this.tickCount;
      task.version += 1;
      candidate.activeTaskId = task.id;
      candidate.status = 'working';
      candidate.version += 1;
      this.emit('agent_state_changed', candidate.id, { agentId: candidate.id, status: candidate.status });
    }
  }

  private updateNeeds(agent: SimulatedAgent): void {
    agent.needs.hunger = clampNeed(agent.needs.hunger + 0.45);
    agent.needs.social = clampNeed(agent.needs.social + 0.18);
    if (agent.status === 'working') {
      agent.energy = clampNeed(agent.energy - 1.1);
      agent.needs.morale = clampNeed(agent.needs.morale - 0.12);
    } else if (agent.status === 'resting') {
      agent.energy = clampNeed(agent.energy + 3.2);
      agent.needs.hunger = clampNeed(agent.needs.hunger - 0.12);
      agent.needs.morale = clampNeed(agent.needs.morale + 0.35);
      if (agent.energy >= 72) {
        agent.status = 'idle';
        agent.version += 1;
      }
    } else {
      agent.energy = clampNeed(agent.energy + 0.65);
      agent.needs.morale = clampNeed(agent.needs.morale + 0.08);
    }

    if (agent.energy <= 18 && agent.status !== 'working') {
      agent.status = 'resting';
      agent.version += 1;
    }
  }

  private progressTasks(): void {
    for (const task of this.tasks.values()) {
      if (task.status !== 'assigned' && task.status !== 'in_progress') continue;
      const agent = task.assignedAgentId ? this.agents.get(task.assignedAgentId) : undefined;
      const runtime = this.taskRuntime.get(task.id);
      if (!agent || !runtime || agent.status === 'resting' || agent.energy <= 0) continue;

      if (task.status === 'assigned') {
        task.status = 'in_progress';
        task.updatedAtTick = this.tickCount;
        task.version += 1;
      }
      runtime.elapsedTicks += 1;
      if (runtime.elapsedTicks < runtime.durationTicks) continue;

      task.status = 'completed';
      task.updatedAtTick = this.tickCount;
      task.version += 1;
      agent.activeTaskId = null;
      agent.status = 'idle';
      agent.needs.morale = clampNeed(agent.needs.morale + 8);
      agent.version += 1;
      this.emit('task_completed', task.id, {
        taskId: task.id,
        agentId: agent.id,
        kind: task.kind,
      });
      this.createFollowUpTask(agent, task);
    }
  }

  private createFollowUpTask(agent: SimulatedAgent, completed: AgentTask): void {
    const nextByProfession: Partial<Record<AgentProfession, AgentTask['kind']>> = {
      engineer: 'design_project',
      worker: 'transport_materials',
      agent: 'investigate_event',
    };
    const nextKind = nextByProfession[agent.profession];
    if (!nextKind) return;

    const id = `task-${agent.id}-${this.tickCount}`;
    if (this.tasks.has(id)) return;
    this.enqueueTask(makeTask(id, nextKind, agent.profession, this.tickCount));
    const followUp = this.tasks.get(id);
    if (followUp) followUp.dependencies = [completed.id];
  }

  private updateSocialRelationships(): void {
    const socialAgents = [...this.agents.values()].filter((agent) => agent.status !== 'disabled');
    for (const relationship of this.relationships.values()) {
      const first = this.agents.get(relationship.fromAgentId);
      const second = this.agents.get(relationship.toAgentId);
      if (!first || !second) continue;
      const distance = Math.hypot(
        first.position.x - second.position.x,
        first.position.z - second.position.z,
      );
      if (distance <= 8 && first.status !== 'working' && second.status !== 'working') {
        relationship.interactionCount += 1;
        if (relationship.interactionCount % 5 === 0) {
          relationship.trust = clampNeed(relationship.trust + 1);
          relationship.affinity = clampNeed(relationship.affinity + 1);
        }
      }
    }
    // Social need is relieved through nearby, non-hostile presence.
    for (const agent of socialAgents) {
      const nearby = socialAgents.some((other) =>
        other.id !== agent.id
        && Math.hypot(agent.position.x - other.position.x, agent.position.z - other.position.z) <= 8,
      );
      if (nearby && agent.status !== 'working') {
        agent.needs.social = clampNeed(agent.needs.social - 0.7);
      }
    }
  }

  /** Avança exatamente um passo lógico da simulação. */
  public step(steps = 1): SocietySimulationSnapshot {
    const safeSteps = Math.max(0, Math.min(1000, Math.floor(steps)));
    for (let index = 0; index < safeSteps; index += 1) {
      this.tickCount += 1;
      for (const agent of this.agents.values()) this.updateNeeds(agent);
      this.assignQueuedTasks();
      this.progressTasks();
      this.updateSocialRelationships();
    }
    return this.snapshot();
  }

  public snapshot(): SocietySimulationSnapshot {
    return {
      tick: this.tickCount,
      agents: [...this.agents.values()].map((agent) => ({
        ...agent,
        position: { ...agent.position },
        needs: { ...agent.needs },
      })),
      tasks: [...this.tasks.values()].map((task) => ({
        ...task,
        dependencies: [...task.dependencies],
        requiredResources: { ...task.requiredResources },
      })),
      relationships: [...this.relationships.values()].map((relationship) => ({ ...relationship })),
      events: this.events.map((event) => ({ ...event, payload: { ...event.payload } })),
    };
  }
}
