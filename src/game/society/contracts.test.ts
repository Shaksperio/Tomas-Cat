import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAgentAcceptTask,
  canStartTask,
  isNewWorldEvent,
  validateConstructionProject,
  validateResourceMap,
  type AgentTask,
  type ConstructionProject,
  type SocietyAgent,
  type WorldEvent,
} from './contracts';

const agent: SocietyAgent = {
  id: 'worker-01',
  displayName: 'Operário 01',
  profession: 'worker',
  status: 'idle',
  position: { x: 4, z: 8, sectorId: 'suburb-01' },
  level: 1,
  energy: 80,
  health: 100,
  factionId: 'town',
  homeSectorId: 'suburb-01',
  activeTaskId: null,
  version: 1,
};

const task: AgentTask = {
  id: 'task-01',
  kind: 'gather_materials',
  status: 'queued',
  requiredProfession: 'worker',
  assignedAgentId: null,
  sectorId: 'suburb-01',
  target: null,
  dependencies: [],
  requiredResources: { scrap: 5 },
  createdAtTick: 10,
  updatedAtTick: 10,
  version: 1,
};

test('accepts a compatible idle agent for a queued task', () => {
  assert.deepEqual(canAgentAcceptTask(agent, task), { valid: true });
});

test('rejects assigning a task to the wrong profession', () => {
  assert.equal(canAgentAcceptTask({ ...agent, profession: 'engineer' }, task).valid, false);
});

test('rejects an agent that already has an active task', () => {
  assert.equal(canAgentAcceptTask({ ...agent, activeTaskId: 'other-task' }, task).valid, false);
});

test('does not start a task while dependencies remain incomplete', () => {
  const assigned = { ...task, status: 'assigned' as const };
  assert.equal(canStartTask({ ...assigned, dependencies: ['survey-01'] }, new Set()).valid, false);
  assert.deepEqual(canStartTask(assigned, new Set()), { valid: true });
});

test('rejects negative, infinite or malformed resource amounts', () => {
  assert.equal(validateResourceMap({ scrap: -1 }).valid, false);
  assert.equal(validateResourceMap({ scrap: Number.POSITIVE_INFINITY }).valid, false);
  assert.equal(validateResourceMap({ 'bad resource': 2 }).valid, false);
});

test('accepts a project made from valid, same-sector modules', () => {
  const project: ConstructionProject = {
    id: 'project-01',
    name: 'Abrigo comunitário',
    status: 'proposed',
    sectorId: 'suburb-01',
    modules: [{
      assetId: 'shelter_wall_a',
      position: { x: 2, z: 3, sectorId: 'suburb-01' },
      rotationY: 0,
    }],
    requiredResources: { scrap: 12 },
    taskIds: [],
    createdByAgentId: 'engineer-01',
    createdAtTick: 12,
    version: 1,
  };
  assert.deepEqual(validateConstructionProject(project), { valid: true });
});

test('rejects project modules placed in another sector', () => {
  const project: ConstructionProject = {
    id: 'project-02',
    name: 'Projeto inválido',
    status: 'proposed',
    sectorId: 'suburb-01',
    modules: [{
      assetId: 'shelter_wall_a',
      position: { x: 2, z: 3, sectorId: 'different-sector' },
      rotationY: 0,
    }],
    requiredResources: {},
    taskIds: [],
    createdByAgentId: 'engineer-01',
    createdAtTick: 12,
    version: 1,
  };
  assert.equal(validateConstructionProject(project).valid, false);
});

test('uses event ids and idempotency keys to reject duplicate world events', () => {
  const event: WorldEvent = {
    id: 'event-01',
    kind: 'task_created',
    regionId: 'region-01',
    tick: 42,
    idempotencyKey: 'task-created:task-01',
    payload: { taskId: 'task-01' },
    schemaVersion: 1,
  };
  assert.equal(isNewWorldEvent(event, new Set(), new Set()), true);
  assert.equal(isNewWorldEvent(event, new Set(['event-01']), new Set()), false);
  assert.equal(isNewWorldEvent(event, new Set(), new Set(['task-created:task-01'])), false);
});
