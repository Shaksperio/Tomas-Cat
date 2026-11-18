export interface SocietyResources {
  food: number;
  wood: number;
  stone: number;
  planks: number;
  coins: number;
}

type TradeableResource = 'food' | 'wood' | 'stone' | 'planks';

/** Capacidade do armazém comunitário por recurso (moedas ficam no cofre, sem limite prático). */
const STORAGE_CAPACITY: Record<keyof SocietyResources, number> = {
  food: 60,
  wood: 60,
  stone: 60,
  planks: 60,
  coins: 999,
};

/** Estoque que a comunidade mantém antes de vender excedente. */
const TARGET_STOCK: Record<TradeableResource, number> = { food: 20, wood: 12, stone: 8, planks: 6 };
/** Preço de venda por unidade, em moedas. */
const SELL_PRICE: Record<TradeableResource, number> = { food: 2, wood: 1, stone: 2, planks: 3 };
const FOOD_BUY_PRICE = 3;
const FOOD_SHORTAGE_THRESHOLD = 8;
const MAX_UNITS_PER_TRADE = 4;
/** Madeira reservada para a construção: o carpinteiro nunca a consome. */
const CONSTRUCTION_WOOD_RESERVE = 4;
const TRADE_ORDER: TradeableResource[] = ['food', 'wood', 'stone', 'planks'];
/** Dia de pagamento: a cada este número de ticks o cofre paga quem trabalhou no período. */
const PAYDAY_INTERVAL = 100;
const WAGES: Record<AgentProfession, number> = {
  engineer: 6,
  worker: 4,
  agent: 5,
  farmer: 4,
  lumberjack: 4,
  miner: 4,
  carpenter: 5,
  merchant: 5,
};
const MAX_WALLET = 999;
/** Economias iniciais de cada habitante (permite apostas em duelos desde o começo). */
export const INITIAL_WALLET = 40;
/** Tarefas concluídas são mantidas por este número de ticks; depois são arquivadas. */
const FINISHED_TASK_RETENTION_TICKS = 200;

/**
 * Local de trabalho de cada profissão. Os alvos das tarefas são sorteados ao
 * redor deste ponto (e não da posição atual), para que profissões que repetem
 * tarefas não se afastem do bairro. A plantação visível fica em (10, 4).
 */
const WORKPLACES: Record<AgentProfession, { x: number; z: number }> = {
  engineer: { x: -4, z: 2 },
  worker: { x: 3, z: 0 },
  agent: { x: -2, z: -4 },
  farmer: { x: 10, z: 4 },
  lumberjack: { x: -8, z: 4 },
  miner: { x: 9, z: -5 },
  carpenter: { x: -6, z: -2 },
  merchant: { x: 3, z: 6 },
};

import {
  type AgentProfession,
  type AgentTask,
  type ConstructionProject,
  type SocietyAgent,
  type WorldEvent,
  canAgentAcceptTask,
} from './contracts';
import {
  completeProbation,
  createDisciplineRecord,
  evaluateViolation,
  requestReintegration,
  type AgentDisciplineRecord,
  type AgentViolation,
} from './agents/governance';

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
  /** Moedas pessoais recebidas como salário. */
  wallet: number;
}

export interface SocietySimulationState {
  schemaVersion: 1;
  tick: number;
  agents: SimulatedAgent[];
  tasks: AgentTask[];
  taskRuntime: Array<{ taskId: string; elapsedTicks: number; durationTicks: number }>;
  relationships: AgentRelationship[];
  events: WorldEvent[];
  eventSequence: number;
  completedSincePayday: Array<{ agentId: string; count: number }>;
  discipline: AgentDisciplineRecord[];
  scheduledConstructionProjects: string[];
  resources: SocietyResources;
}

export interface SocietySimulationSnapshot {
  tick: number;
  agents: SimulatedAgent[];
  tasks: AgentTask[];
  relationships: AgentRelationship[];
  events: WorldEvent[];
  resources: SocietyResources;
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
  cultivate_field: 5,
  harvest_food: 4,
  chop_wood: 5,
  mine_stone: 6,
  craft_planks: 5,
  trade_goods: 5,
};

const clampNeed = (value: number): number => Math.max(0, Math.min(100, value));

function cloneWorldEvent(event: WorldEvent): WorldEvent {
  return {
    ...event,
    payload: JSON.parse(JSON.stringify(event.payload)) as Record<string, unknown>,
  };
}

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
    wallet: INITIAL_WALLET,
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
  /** Tarefas concluídas por agente desde o último pagamento. */
  private readonly completedSincePayday = new Map<string, number>();
  /** Estado disciplinar autoritativo local; persistência entre sessões ainda depende do backend. */
  private readonly discipline = new Map<string, AgentDisciplineRecord>();
  private readonly scheduledConstructionProjects = new Set<string>();
  private readonly resources: SocietyResources = { food: 12, wood: 0, stone: 0, planks: 0, coins: 0 };

  constructor() {
    this.addAgent(makeAgent('engineer-01', 'Íris', 'engineer', -4, 2));
    this.addAgent(makeAgent('worker-01', 'Tico', 'worker', 2, 1));
    this.addAgent(makeAgent('worker-02', 'Nina', 'worker', 4, -2));
    this.addAgent(makeAgent('agent-01', 'Bento', 'agent', -2, -4));
    this.addAgent(makeAgent('farmer-01', 'Amora', 'farmer', 6, 3));
    this.addAgent(makeAgent('lumberjack-01', 'Cedro', 'lumberjack', -7, 4));
    this.addAgent(makeAgent('miner-01', 'Brita', 'miner', 8, -5));
    this.addAgent(makeAgent('carpenter-01', 'Serafim', 'carpenter', -6, -2));
    this.addAgent(makeAgent('merchant-01', 'Mercê', 'merchant', 3, 6));

    this.addRelationship('engineer-01', 'worker-01', 62, 48);
    this.addRelationship('engineer-01', 'worker-02', 58, 54);
    this.addRelationship('worker-01', 'worker-02', 72, 78);
    this.addRelationship('lumberjack-01', 'carpenter-01', 66, 60);
    this.addRelationship('miner-01', 'worker-01', 55, 50);
    this.addRelationship('merchant-01', 'farmer-01', 60, 64);

    this.enqueueTask(makeTask('task-survey-01', 'survey_site', 'engineer', 0));
    this.enqueueTask(makeTask('task-gather-01', 'gather_materials', 'worker', 0));
    this.enqueueTask(makeTask('task-patrol-01', 'patrol_area', 'agent', 0));
    this.enqueueTask(makeTask('task-farm-01', 'cultivate_field', 'farmer', 0));
    this.enqueueTask(makeTask('task-lumber-01', 'chop_wood', 'lumberjack', 0));
    this.enqueueTask(makeTask('task-quarry-01', 'mine_stone', 'miner', 0));
    const firstCrafting = makeTask('task-craft-01', 'craft_planks', 'carpenter', 0);
    firstCrafting.requiredResources = { wood: 3 };
    this.enqueueTask(firstCrafting);
    this.enqueueTask(makeTask('task-trade-01', 'trade_goods', 'merchant', 0));
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

  /**
   * Enfileira uma cadeia real de trabalho para um projeto já validado.
   * A sequência é determinística e cada etapa permanece vinculada ao projeto.
   */
  public scheduleConstructionProject(project: ConstructionProject): string[] | null {
    if (this.scheduledConstructionProjects.has(project.id)) return null;
    const engineer = this.agents.get(project.createdByAgentId);
    if (!engineer || engineer.profession !== 'engineer' || engineer.status === 'disabled') return null;
    if (project.status !== 'validated' && project.status !== 'active') return null;
    if (project.modules.length === 0) return null;

    const craftCount = Math.ceil((project.requiredResources.planks ?? 0) / 2);
    const expectedIds = [
      `construction:${project.id}:gather`,
      ...Array.from({ length: craftCount }, (_, index) => `construction:${project.id}:craft:${index}`),
      `construction:${project.id}:transport`,
      `construction:${project.id}:prepare`,
      ...project.modules.map((_, index) => `construction:${project.id}:build:${index}`),
    ];
    if (project.taskIds.length !== expectedIds.length
      || expectedIds.some((id, index) => project.taskIds[index] !== id)
      || new Set(expectedIds).size !== expectedIds.length
      || expectedIds.some((id) => this.tasks.has(id))) return null;
    if (Object.keys(project.requiredResources).some((key) => !['wood', 'stone', 'planks'].includes(key))) return null;

    const primaryModule = project.modules[0]!;
    const gatherYield: Record<string, number> = {
      wood: (project.requiredResources.wood ?? 0) + craftCount * 3,
      stone: project.requiredResources.stone ?? 0,
    };
    const specs: Array<{
      id: string;
      kind: AgentTask['kind'];
      profession: AgentTask['requiredProfession'];
      stage: NonNullable<AgentTask['constructionStage']>;
      target: AgentTask['target'];
      requiredResources: Record<string, number>;
      materialYield?: Record<string, number>;
      assetId?: string;
      final?: boolean;
    }> = [{
      id: expectedIds[0]!,
      kind: 'gather_materials',
      profession: 'worker',
      stage: 'gather',
      target: null,
      requiredResources: {},
      materialYield: gatherYield,
      assetId: primaryModule.assetId,
    }];

    for (let index = 0; index < craftCount; index += 1) {
      specs.push({
        id: `construction:${project.id}:craft:${index}`,
        kind: 'craft_planks',
        profession: 'carpenter',
        stage: 'craft',
        target: null,
        requiredResources: { wood: 3 },
        assetId: primaryModule.assetId,
      });
    }
    specs.push({
      id: `construction:${project.id}:transport`,
      kind: 'transport_materials',
      profession: 'worker',
      stage: 'transport',
      target: { ...primaryModule.position },
      requiredResources: {},
      assetId: primaryModule.assetId,
    });
    specs.push({
      id: `construction:${project.id}:prepare`,
      kind: 'prepare_site',
      profession: 'worker',
      stage: 'prepare',
      target: { ...primaryModule.position },
      requiredResources: {},
      assetId: primaryModule.assetId,
    });
    project.modules.forEach((module, index) => {
      specs.push({
        id: `construction:${project.id}:build:${index}`,
        kind: 'build_module',
        profession: 'worker',
        stage: 'build',
        target: { ...module.position },
        requiredResources: index === project.modules.length - 1 ? { ...project.requiredResources } : {},
        assetId: module.assetId,
        final: index === project.modules.length - 1,
      });
    });

    let previousTaskId: string | null = null;
    for (const spec of specs) {
      const task = makeTask(spec.id, spec.kind, spec.profession, this.tickCount);
      task.sectorId = project.sectorId;
      task.target = spec.target ? { ...spec.target } : null;
      task.requiredResources = { ...spec.requiredResources };
      task.dependencies = previousTaskId ? [previousTaskId] : [];
      task.constructionProjectId = project.id;
      if (spec.assetId) task.constructionAssetId = spec.assetId;
      task.constructionStage = spec.stage;
      if (spec.materialYield) task.constructionMaterialYield = { ...spec.materialYield };
      task.constructionFinalTask = spec.final ?? false;
      this.enqueueTask(task);
      previousTaskId = task.id;
    }
    this.scheduledConstructionProjects.add(project.id);
    return [...expectedIds];
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
    if (this.events.length > 500) this.events.shift();
  }

  private assignQueuedTasks(): void {
    const queued = [...this.tasks.values()]
      .filter((task) => task.status === 'queued')
      .sort((a, b) => a.createdAtTick - b.createdAtTick || a.id.localeCompare(b.id));

    for (const task of queued) {
      // Dependência ausente = tarefa concluída que já foi arquivada por pruneFinishedTasks.
      const dependenciesComplete = task.dependencies.every((dependencyId) => {
        const dependency = this.tasks.get(dependencyId);
        return !dependency || dependency.status === 'completed';
      });
      if (!dependenciesComplete || !this.hasResources(task.requiredResources, this.reserveFor(task))) continue;

      const candidate = [...this.agents.values()]
        .filter((agent) => this.isAgentAuthorizedForTask(agent.id, task.kind))
        .filter((agent) => canAgentAcceptTask(agent, task).valid)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!candidate) continue;

      const seed = [...task.id].reduce((value, char) => value + char.charCodeAt(0), 0);
      const angle = (seed % 360) * (Math.PI / 180);
      const radius = 2.5 + (seed % 4);
      const workplace = WORKPLACES[candidate.profession];
      if (!task.target) {
        task.target = {
          x: workplace.x + Math.cos(angle) * radius,
          z: workplace.z + Math.sin(angle) * radius,
          sectorId: task.sectorId,
        };
      }
      task.status = 'assigned';
      task.assignedAgentId = candidate.id;
      task.updatedAtTick = this.tickCount;
      task.version += 1;
      candidate.activeTaskId = task.id;
      candidate.status = 'travelling';
      candidate.version += 1;
      this.emit('agent_state_changed', candidate.id, { agentId: candidate.id, status: candidate.status });
    }
  }

  private hasResources(required: Record<string, number>, reserve: Record<string, number> = {}): boolean {
    return Object.entries(required).every(([resource, amount]) =>
      (this.resources[resource as keyof SocietyResources] ?? 0) >= amount + (reserve[resource] ?? 0),
    );
  }

  /** O carpinteiro só trabalha com a madeira que sobra depois da reserva de construção. */
  private reserveFor(task: AgentTask): Record<string, number> {
    const reserve: Record<string, number> = task.kind === 'craft_planks' && !task.constructionProjectId
      ? { wood: CONSTRUCTION_WOOD_RESERVE }
      : {};
    for (const pending of this.tasks.values()) {
      if (!pending.constructionProjectId || pending.kind !== 'build_module'
        || pending.id === task.id
        || !['queued', 'assigned', 'in_progress'].includes(pending.status)) continue;
      for (const [resource, amount] of Object.entries(pending.requiredResources)) {
        reserve[resource] = (reserve[resource] ?? 0) + amount;
      }
    }
    return reserve;
  }

  private changeResource(resource: keyof SocietyResources, amount: number, reason: string, sourceId: string): void {
    const previous = this.resources[resource];
    const next = Math.max(0, Math.min(STORAGE_CAPACITY[resource], previous + amount));
    if (next === previous) return;
    this.resources[resource] = next;
    this.emit('resource_changed', sourceId, {
      resource,
      previous,
      amount: next - previous,
      current: next,
      reason,
    });
  }

  private feedResidents(): void {
    if (this.tickCount % 40 !== 0) return;
    for (const agent of this.agents.values()) {
      if (this.resources.food <= 0) break;
      this.changeResource('food', -1, 'community_meal', `meal:${agent.id}:${this.tickCount}`);
      agent.needs.hunger = clampNeed(agent.needs.hunger - 28);
      agent.needs.morale = clampNeed(agent.needs.morale + 1.5);
    }
  }

  /**
   * Salários: no dia de pagamento o cofre paga quem concluiu trabalho no período.
   * Sem moedas suficientes o salário não é pago e o moral do agente cai.
   */
  private payWages(): void {
    if (this.tickCount % PAYDAY_INTERVAL !== 0) return;
    const paid: Array<{ agentId: string; amount: number }> = [];
    const unpaid: string[] = [];
    const agents = [...this.agents.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const agent of agents) {
      if ((this.completedSincePayday.get(agent.id) ?? 0) === 0) continue;
      const wage = WAGES[agent.profession];
      if (this.resources.coins >= wage) {
        this.changeResource('coins', -wage, 'wages', `wage:${agent.id}:${this.tickCount}`);
        agent.wallet = Math.min(MAX_WALLET, agent.wallet + wage);
        agent.needs.morale = clampNeed(agent.needs.morale + 2);
        agent.version += 1;
        paid.push({ agentId: agent.id, amount: wage });
      } else {
        agent.needs.morale = clampNeed(agent.needs.morale - 4);
        unpaid.push(agent.id);
      }
    }
    this.completedSincePayday.clear();
    if (paid.length > 0 || unpaid.length > 0) {
      this.emit('wage_paid', 'payday', { paid, unpaid, treasury: this.resources.coins });
    }
  }

  /** Descarta tarefas concluídas antigas para o estado não crescer sem limite. */
  private pruneFinishedTasks(): void {
    if (this.tickCount % 100 !== 0) return;
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' && !task.constructionProjectId
        && this.tickCount - task.updatedAtTick > FINISHED_TASK_RETENTION_TICKS) {
        this.tasks.delete(id);
        this.taskRuntime.delete(id);
      }
    }
  }

  /**
   * Comércio determinístico: a mercadora vende o excedente acima do estoque-alvo
   * e, havendo escassez de comida, compra alimento com as moedas do cofre.
   */
  private executeTrade(merchant: SimulatedAgent, task: AgentTask): void {
    const sold: Partial<Record<TradeableResource, number>> = {};
    const bought: Partial<Record<TradeableResource, number>> = {};

    for (const resource of TRADE_ORDER) {
      const surplus = this.resources[resource] - TARGET_STOCK[resource];
      if (surplus <= 0) continue;
      const units = Math.min(surplus, MAX_UNITS_PER_TRADE);
      this.changeResource(resource, -units, 'trade_sale', `${task.id}:${resource}`);
      this.changeResource('coins', units * SELL_PRICE[resource], 'trade_sale', `${task.id}:coins-in`);
      sold[resource] = units;
    }

    if (this.resources.food < FOOD_SHORTAGE_THRESHOLD) {
      const affordable = Math.floor(this.resources.coins / FOOD_BUY_PRICE);
      const units = Math.min(MAX_UNITS_PER_TRADE, affordable);
      if (units > 0) {
        this.changeResource('coins', -units * FOOD_BUY_PRICE, 'trade_purchase', `${task.id}:coins-out`);
        this.changeResource('food', units, 'trade_purchase', `${task.id}:food`);
        bought.food = units;
      }
    }

    if (Object.keys(sold).length > 0 || Object.keys(bought).length > 0) {
      this.emit('trade_completed', task.id, {
        merchantId: merchant.id,
        sold,
        bought,
        coins: this.resources.coins,
      });
    }
  }

  /**
   * Necessidades materiais periódicas da comunidade: lenha para aquecimento e
   * tábuas para manutenção. Necessidade não atendida reduz o moral de todos.
   */
  private consumeCommunityNeeds(): void {
    const needs: Array<{ need: string; every: number; resource: keyof SocietyResources; reason: string }> = [
      { need: 'firewood', every: 60, resource: 'wood', reason: 'community_firewood' },
      { need: 'maintenance', every: 120, resource: 'planks', reason: 'community_maintenance' },
    ];
    for (const { need, every, resource, reason } of needs) {
      if (this.tickCount % every !== 0) continue;
      const met = this.resources[resource] >= 1;
      if (met) {
        this.changeResource(resource, -1, reason, `need:${need}:${this.tickCount}`);
      } else {
        for (const agent of this.agents.values()) {
          agent.needs.morale = clampNeed(agent.needs.morale - 3);
        }
      }
      this.emit('community_need_changed', `need:${need}`, { need, met });
    }
  }

  private updateNeeds(agent: SimulatedAgent): void {
    agent.needs.hunger = clampNeed(agent.needs.hunger + 0.45);
    agent.needs.social = clampNeed(agent.needs.social + 0.18);
    if (agent.status === 'working') {
      agent.energy = clampNeed(agent.energy - 1.1);
      agent.needs.morale = clampNeed(agent.needs.morale - 0.12);
      if (agent.energy <= 18) {
        agent.status = 'resting';
        agent.version += 1;
      }
    } else if (agent.status === 'resting') {
      agent.energy = clampNeed(agent.energy + 3.2);
      agent.needs.hunger = clampNeed(agent.needs.hunger - 0.12);
      agent.needs.morale = clampNeed(agent.needs.morale + 0.35);
      if (agent.energy >= 72) {
        agent.status = agent.activeTaskId ? 'working' : 'idle';
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
        if (!this.hasResources(task.requiredResources, this.reserveFor(task))) continue;
        const consumptionReason = task.kind === 'build_module' ? 'construction_consumption' : 'crafting_consumption';
        for (const [resource, amount] of Object.entries(task.requiredResources)) {
          this.changeResource(resource as keyof SocietyResources, -amount, consumptionReason, `${task.id}:${resource}`);
        }
        task.status = 'in_progress';
        task.updatedAtTick = this.tickCount;
        task.version += 1;
      }
      if (task.target) {
        const dx = task.target.x - agent.position.x;
        const dz = task.target.z - agent.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.45) {
          const travelStep = Math.min(0.18, distance);
          agent.position.x += (dx / distance) * travelStep;
          agent.position.z += (dz / distance) * travelStep;
          agent.status = 'travelling';
          continue;
        }
        agent.position.x = task.target.x;
        agent.position.z = task.target.z;
        agent.status = 'working';
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
      this.completedSincePayday.set(agent.id, (this.completedSincePayday.get(agent.id) ?? 0) + 1);
      if (task.kind === 'harvest_food') {
        this.changeResource('food', 10, 'crop_harvest', task.id);
      }
      if (task.kind === 'gather_materials') {
        const yieldMap = task.constructionMaterialYield ?? { wood: 8, stone: 4 };
        for (const [resource, amount] of Object.entries(yieldMap)) {
          this.changeResource(resource as keyof SocietyResources, amount, 'material_gathering', task.id);
        }
      }
      if (task.kind === 'chop_wood') {
        this.changeResource('wood', 6, 'lumber_production', task.id);
      } else if (task.kind === 'mine_stone') {
        this.changeResource('stone', 4, 'quarry_production', task.id);
      } else if (task.kind === 'craft_planks') {
        this.changeResource('planks', 2, 'carpentry_production', task.id);
      } else if (task.kind === 'trade_goods') {
        this.executeTrade(agent, task);
      }
      this.emit('task_completed', task.id, {
        taskId: task.id,
        agentId: agent.id,
        kind: task.kind,
        ...(task.constructionProjectId ? {
          constructionProjectId: task.constructionProjectId,
          constructionAssetId: task.constructionAssetId,
          constructionStage: task.constructionStage,
        } : {}),
      });
      if (task.kind === 'design_project') {
        this.emit('project_started', task.id, {
          projectId: 'neighborhood-shelter-01',
          name: 'Abrigo comunitário',
          engineerId: agent.id,
        });
      } else if (task.kind === 'build_module') {
        if (task.constructionProjectId) {
          if (task.constructionFinalTask) {
            this.emit('project_completed', task.id, {
              projectId: task.constructionProjectId,
              assetId: task.constructionAssetId,
              builderId: agent.id,
              position: task.target ? { ...task.target } : null,
            });
          }
        } else {
          this.emit('project_completed', task.id, {
            projectId: 'neighborhood-shelter-01',
            assetId: 'community-shelter',
            builderId: agent.id,
            position: task.target ? { ...task.target } : null,
          });
        }
      }
      this.createFollowUpTask(agent, task);
    }
  }

  private createFollowUpTask(agent: SimulatedAgent, completed: AgentTask): void {
    if (completed.constructionProjectId) return;
    let nextKind: AgentTask['kind'] | undefined;
    if (agent.profession === 'engineer' && completed.kind === 'survey_site') {
      nextKind = 'design_project';
    } else if (agent.profession === 'worker') {
      const workerSequence: Partial<Record<AgentTask['kind'], AgentTask['kind']>> = {
        gather_materials: 'transport_materials',
        transport_materials: 'prepare_site',
        prepare_site: 'build_module',
      };
      nextKind = workerSequence[completed.kind];
    } else if (agent.profession === 'agent') {
      nextKind = completed.kind === 'patrol_area' ? 'investigate_event' : undefined;
    } else if (agent.profession === 'farmer') {
      nextKind = completed.kind === 'cultivate_field' ? 'harvest_food'
        : completed.kind === 'harvest_food' ? 'cultivate_field' : undefined;
    } else if (agent.profession === 'lumberjack') {
      nextKind = 'chop_wood';
    } else if (agent.profession === 'miner') {
      nextKind = 'mine_stone';
    } else if (agent.profession === 'carpenter') {
      nextKind = 'craft_planks';
    } else if (agent.profession === 'merchant') {
      nextKind = 'trade_goods';
    }
    if (!nextKind) return;

    const id = `task-${agent.id}-${this.tickCount}`;
    if (this.tasks.has(id)) return;
    const nextTask = makeTask(id, nextKind, agent.profession, this.tickCount);
    if (nextKind === 'build_module') nextTask.requiredResources = { wood: 4, stone: 2 };
    if (nextKind === 'craft_planks') nextTask.requiredResources = { wood: 3 };
    this.enqueueTask(nextTask);
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
          this.emit('social_interaction', relationship.id, {
            relationshipId: relationship.id,
            fromAgentId: relationship.fromAgentId,
            toAgentId: relationship.toAgentId,
            interactionCount: relationship.interactionCount,
          });
          this.emit('relationship_changed', relationship.id, {
            relationshipId: relationship.id,
            trust: relationship.trust,
            affinity: relationship.affinity,
          });
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

  /**
   * Aplica o resultado de um duelo a um habitante (moedas e energia vital).
   * Só valores já validados por `settleDuel` chegam aqui; limites são reforçados.
   */
  public applyDuelOutcome(agentId: string, change: { coins: number; health: number }): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.wallet = Math.max(0, agent.wallet + Math.trunc(change.coins));
    agent.health = Math.min(100, Math.max(25, agent.health + Math.trunc(change.health)));
    agent.version += 1;
    return true;
  }

  /** Aplica uma ocorrência verificada pelo controlador de governança e retira o agente do scheduler. */
  public reportAgentViolation(violation: AgentViolation): AgentDisciplineRecord {
    const current = this.discipline.get(violation.agentId)
      ?? createDisciplineRecord(violation.agentId);
    const decision = evaluateViolation(current, violation);
    this.discipline.set(violation.agentId, decision.record);
    if (decision.action === 'suspend' || decision.action === 'extend_suspension'
      || decision.action === 'permanent_block') {
      const agent = this.agents.get(violation.agentId);
      if (agent) {
        for (const task of this.tasks.values()) {
          if (task.assignedAgentId !== agent.id
            || !['assigned', 'in_progress'].includes(task.status)) continue;
          task.status = 'cancelled';
          task.updatedAtTick = this.tickCount;
          task.version += 1;
          this.taskRuntime.delete(task.id);
        }
        agent.activeTaskId = null;
        agent.status = 'idle';
        agent.version += 1;
        this.emit('agent_state_changed', agent.id, {
          agentId: agent.id,
          status: 'idle',
          discipline: decision.record.status,
          reason: decision.reason,
        });
      }
    }
    return this.cloneDisciplineRecord(decision.record);
  }

  /** Reintegração exige prazo encerrado, aceite explícito e revisão aprovada. */
  public reinstateAgent(
    agentId: string,
    acceptedRules: boolean,
    reviewPassed: boolean,
  ): AgentDisciplineRecord {
    const current = this.discipline.get(agentId) ?? createDisciplineRecord(agentId);
    const decision = requestReintegration(current, this.tickCount, acceptedRules, reviewPassed);
    this.discipline.set(agentId, decision.record);
    if (decision.action === 'reinstate_probation') {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = 'idle';
        agent.activeTaskId = null;
        agent.version += 1;
      }
    }
    return this.cloneDisciplineRecord(decision.record);
  }

  public getAgentDiscipline(agentId: string): AgentDisciplineRecord {
    const record = this.discipline.get(agentId) ?? createDisciplineRecord(agentId);
    return this.cloneDisciplineRecord(record);
  }

  private cloneDisciplineRecord(record: AgentDisciplineRecord): AgentDisciplineRecord {
    return { ...record, violations: record.violations.map((violation) => ({
      ...violation,
      affectedAgentIds: violation.affectedAgentIds ? [...violation.affectedAgentIds] : undefined,
    })) };
  }

  private isAgentAuthorizedForTask(agentId: string, taskKind: AgentTask['kind']): boolean {
    const record = this.discipline.get(agentId);
    if (!record || record.status === 'active') return true;
    if (record.status === 'suspended' || record.status === 'permanently_blocked') return false;
    // Durante a probation, agentes não executam construção, reparos ou preparação territorial.
    return !['prepare_site', 'build_module', 'repair_structure'].includes(taskKind);
  }

  /** Avança exatamente um passo lógico da simulação. */
  public step(steps = 1): SocietySimulationSnapshot {
    const safeSteps = Math.max(0, Math.min(1000, Math.floor(steps)));
    for (let index = 0; index < safeSteps; index += 1) {
      this.tickCount += 1;
      for (const [agentId, record] of this.discipline) {
        const updated = completeProbation(record, this.tickCount);
        if (updated !== record) this.discipline.set(agentId, updated);
      }
      for (const agent of this.agents.values()) this.updateNeeds(agent);
      this.assignQueuedTasks();
      this.progressTasks();
      this.updateSocialRelationships();
      this.feedResidents();
      this.consumeCommunityNeeds();
      this.payWages();
      this.pruneFinishedTasks();
    }
    return this.snapshot();
  }

  /**
   * Exporta todo o estado necessário para retomar a simulação sem reiniciar
   * tarefas, pagamentos, eventos ou decisões de governança.
   */
  public exportState(): SocietySimulationState {
    return {
      schemaVersion: 1,
      tick: this.tickCount,
      agents: [...this.agents.values()].map((agent) => ({
        ...agent,
        position: { ...agent.position },
        needs: { ...agent.needs },
      })),
      tasks: [...this.tasks.values()].map((task) => ({
        ...task,
        target: task.target ? { ...task.target } : null,
        dependencies: [...task.dependencies],
        requiredResources: { ...task.requiredResources },
        constructionMaterialYield: task.constructionMaterialYield
          ? { ...task.constructionMaterialYield } : undefined,
      })),
      taskRuntime: [...this.taskRuntime.entries()].map(([taskId, runtime]) => ({
        taskId, ...runtime,
      })),
      relationships: [...this.relationships.values()].map((relationship) => ({ ...relationship })),
      events: this.events.map(cloneWorldEvent),
      eventSequence: this.eventSequence,
      completedSincePayday: [...this.completedSincePayday.entries()].map(([agentId, count]) => ({ agentId, count })),
      discipline: [...this.discipline.values()].map((record) => this.cloneDisciplineRecord(record)),
      scheduledConstructionProjects: [...this.scheduledConstructionProjects],
      resources: { ...this.resources },
    };
  }

  /**
   * Restaura estado validado em uma simulação existente. Falhas de validação
   * não alteram a instância, permitindo que saves antigos sigam o fluxo normal.
   */
  public restoreState(state: SocietySimulationState): boolean {
    if (!state || state.schemaVersion !== 1
      || !Number.isSafeInteger(state.tick) || state.tick < 0
      || !Number.isSafeInteger(state.eventSequence) || state.eventSequence < 0
      || !Array.isArray(state.agents) || !Array.isArray(state.tasks)
      || !Array.isArray(state.taskRuntime) || state.taskRuntime.length !== state.tasks.length || !Array.isArray(state.relationships)
      || !Array.isArray(state.events) || !Array.isArray(state.completedSincePayday)
      || !Array.isArray(state.discipline) || !Array.isArray(state.scheduledConstructionProjects)
      || !state.resources || !['food', 'wood', 'stone', 'planks', 'coins'].every((key) =>
        Number.isFinite(state.resources[key as keyof SocietyResources])
        && state.resources[key as keyof SocietyResources] >= 0)) return false;

    const unique = (values: string[]) => values.every((value) => typeof value === 'string' && value.length > 0)
      && new Set(values).size === values.length;
    if (state.agents.some((agent) => !agent || typeof agent !== 'object')
      || state.tasks.some((task) => !task || typeof task !== 'object')
      || state.taskRuntime.some((entry) => !entry || typeof entry !== 'object')
      || state.relationships.some((relationship) => !relationship || typeof relationship !== 'object')
      || state.completedSincePayday.some((entry) => !entry || typeof entry !== 'object')
      || state.discipline.some((record) => !record || typeof record !== 'object')
      || state.events.some((event) => !event || typeof event !== 'object')
      || !unique(state.scheduledConstructionProjects)) return false;
    if (!unique(state.agents.map((agent) => agent.id))
      || !unique(state.tasks.map((task) => task.id))
      || !unique(state.taskRuntime.map((entry) => entry.taskId))
      || !unique(state.discipline.map((record) => record.agentId))) return false;

    const agentIds = new Set(state.agents.map((agent) => agent.id));
    const taskIds = new Set(state.tasks.map((task) => task.id));
    if (state.agents.some((agent) => !agent.id || !agent.position
      || typeof agent.position.sectorId !== 'string'
      || !Number.isFinite(agent.position.x) || !Number.isFinite(agent.position.z)
      || !Number.isFinite(agent.health) || !Number.isFinite(agent.energy)
      || !agent.needs || !['hunger', 'social', 'morale'].every((key) =>
        Number.isFinite(agent.needs[key as keyof AgentNeeds])))) return false;
    if (state.tasks.some((task) => !task.id || !Array.isArray(task.dependencies)
      || task.dependencies.some((id) => typeof id !== 'string')
      || !task.requiredResources || typeof task.requiredResources !== 'object'
      || !Number.isSafeInteger(task.createdAtTick) || task.createdAtTick < 0
      || !Number.isSafeInteger(task.updatedAtTick) || task.updatedAtTick < 0
      || (task.assignedAgentId !== null && !agentIds.has(task.assignedAgentId)))) return false;
    if (state.taskRuntime.some((entry) => !taskIds.has(entry.taskId)
      || !Number.isFinite(entry.elapsedTicks) || entry.elapsedTicks < 0
      || !Number.isFinite(entry.durationTicks) || entry.durationTicks <= 0)) return false;
    if (state.relationships.some((relationship) => !relationship.id
      || !agentIds.has(relationship.fromAgentId) || !agentIds.has(relationship.toAgentId)
      || !Number.isFinite(relationship.trust) || !Number.isFinite(relationship.affinity)
      || !Number.isSafeInteger(relationship.interactionCount) || relationship.interactionCount < 0)) return false;
    if (state.completedSincePayday.some((entry) => !agentIds.has(entry.agentId)
      || !Number.isSafeInteger(entry.count) || entry.count < 0)) return false;
    if (state.discipline.some((record) => !agentIds.has(record.agentId)
      || !Array.isArray(record.violations)
      || record.violations.some((violation) => !violation || typeof violation !== 'object'))) return false;
    if (state.events.some((event) => !event.id || !Number.isSafeInteger(event.tick)
      || event.tick < 0 || !event.payload || typeof event.payload !== 'object')) return false;

    this.tickCount = state.tick;
    this.agents.clear();
    for (const agent of state.agents) this.agents.set(agent.id, {
      ...agent, position: { ...agent.position }, needs: { ...agent.needs },
    });
    this.tasks.clear();
    for (const task of state.tasks) this.tasks.set(task.id, {
      ...task,
      target: task.target ? { ...task.target } : null,
      dependencies: [...task.dependencies],
      requiredResources: { ...task.requiredResources },
      constructionMaterialYield: task.constructionMaterialYield
        ? { ...task.constructionMaterialYield } : undefined,
    });
    this.taskRuntime.clear();
    for (const entry of state.taskRuntime) {
      this.taskRuntime.set(entry.taskId, {
        elapsedTicks: entry.elapsedTicks, durationTicks: entry.durationTicks,
      });
    }
    this.relationships.clear();
    for (const relationship of state.relationships) {
      this.relationships.set(relationship.id, { ...relationship });
    }
    this.events.splice(0, this.events.length,
      ...state.events.map(cloneWorldEvent));
    this.eventSequence = state.eventSequence;
    this.completedSincePayday.clear();
    for (const entry of state.completedSincePayday) this.completedSincePayday.set(entry.agentId, entry.count);
    this.discipline.clear();
    for (const record of state.discipline) this.discipline.set(record.agentId, this.cloneDisciplineRecord(record));
    this.scheduledConstructionProjects.clear();
    for (const projectId of state.scheduledConstructionProjects) this.scheduledConstructionProjects.add(projectId);
    Object.assign(this.resources, state.resources);
    return true;
  }

  public snapshot(): SocietySimulationSnapshot {
    return {
      tick: this.tickCount,
      agents: [...this.agents.values()].map((agent) => ({
        ...agent,
        position: { ...agent.position },
        needs: { ...agent.needs },
        wallet: agent.wallet,
      })),
      tasks: [...this.tasks.values()].map((task) => ({
        ...task,
        dependencies: [...task.dependencies],
        requiredResources: { ...task.requiredResources },
      })),
      relationships: [...this.relationships.values()].map((relationship) => ({ ...relationship })),
      events: this.events.map((event) => ({ ...event, payload: { ...event.payload } })),
      resources: { ...this.resources },
    };
  }
}
