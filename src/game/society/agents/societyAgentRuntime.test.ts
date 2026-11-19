import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SocietySimulation } from '../simulation.ts';
import { SocietyAgentRuntime } from './societyAgentRuntime.ts';

test('runtime avança simulação e preenche memória', () => {
  const sim = new SocietySimulation();
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 5 });
  const frame = runtime.step(sim, 30);
  assert.ok(frame.snapshot.tick >= 30);
  assert.ok(Object.keys(frame.memory.byAgent).length >= 0);
});

test('Cowila roda no intervalo e devolve diretiva', () => {
  const sim = new SocietySimulation();
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 10 });
  let last = runtime.step(sim, 1);
  assert.ok(last.directive, 'primeira passagem deve gerar diretiva');
  const brief = last.directive!.brief;
  assert.ok(brief.length > 5);
  last = runtime.step(sim, 5);
  assert.equal(runtime.getLastDirective()?.brief, brief, 'ainda dentro do intervalo');
  last = runtime.step(sim, 10);
  assert.ok(last.directive);
});

test('placements exigem a conclusão de todas as tarefas vinculadas ao projeto', () => {
  const base = new SocietySimulation().snapshot();
  const scheduled: string[][] = [];
  const fakeSimulation = {
    step: () => ({
      ...base,
      tick: 1,
      resources: { food: 60, wood: 60, stone: 60, planks: 60, coins: 999 },
    }),
    scheduleConstructionProject: (project: { taskIds: string[] }) => {
      scheduled.push([...project.taskIds]);
      return [...project.taskIds];
    },
  } as unknown as SocietySimulation;
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 1 });
  const frame = runtime.step(fakeSimulation, 1);

  assert.ok(frame.registeredProjectIds.length > 0);
  assert.equal(scheduled.length, frame.registeredProjectIds.length);
  for (const projectId of frame.registeredProjectIds) {
    const taskIds = scheduled[0]!;
    const progress = runtime.getConstructionRuntime().getProjectProgress(projectId);
    assert.ok(progress);
    assert.equal(progress!.completedTasks, 0);
    for (const taskId of taskIds) {
      assert.equal(runtime.notifyConstructionTaskComplete(projectId, taskId), true);
    }
    assert.equal(runtime.getConstructionRuntime().getProjectProgress(projectId)?.completedTasks, taskIds.length);
    assert.ok(runtime.getConstructionRuntime().getReadyPlacements().some((placement) => placement.projectId === projectId));
  }
});

test('simulação cria cadeia de coleta, carpintaria, transporte, preparação e construção', () => {
  const sim = new SocietySimulation();
  const projectId = 'pipeline-test';
  const taskIds = [
    `construction:${projectId}:gather`,
    `construction:${projectId}:craft:0`,
    `construction:${projectId}:transport`,
    `construction:${projectId}:prepare`,
    `construction:${projectId}:build:0`,
  ];
  const project = {
    id: projectId,
    name: 'Oficina comunitária',
    status: 'validated' as const,
    sectorId: 'suburb-01',
    modules: [{
      assetId: 'module_workshop',
      position: { x: 8, z: -3, sectorId: 'suburb-01' },
      rotationY: 0,
    }],
    requiredResources: { wood: 4, stone: 2, planks: 2 },
    taskIds,
    createdByAgentId: 'engineer-01',
    createdAtTick: 0,
    version: 1,
  };

  assert.deepEqual(sim.scheduleConstructionProject(project), taskIds);
  const tasks = sim.snapshot().tasks.filter((task) => task.constructionProjectId === projectId);
  assert.deepEqual(tasks.map((task) => task.kind), [
    'gather_materials', 'craft_planks', 'transport_materials', 'prepare_site', 'build_module',
  ]);
  assert.deepEqual(tasks.map((task) => task.dependencies), [
    [], [taskIds[0]], [taskIds[1]], [taskIds[2]], [taskIds[3]],
  ]);
  assert.equal(tasks[0]?.constructionAssetId, 'module_workshop');
  assert.deepEqual(tasks[0]?.constructionMaterialYield, { wood: 7, stone: 2 });
  assert.deepEqual(tasks[1]?.requiredResources, { wood: 3 });
  assert.deepEqual(tasks[4]?.requiredResources, { wood: 4, stone: 2, planks: 2 });
  assert.equal(sim.scheduleConstructionProject(project), null, 'não pode duplicar o mesmo projeto');
});

test('evento build_module sem vínculo explícito não conclui projeto de construção', () => {
  const base = new SocietySimulation().snapshot();
  const snapshot = {
    ...base,
    tick: 1,
    resources: { food: 60, wood: 60, stone: 60, planks: 60, coins: 999 },
    events: [{
      id: 'unrelated-build-event',
      kind: 'task_completed' as const,
      regionId: 'local-suburb',
      tick: 1,
      idempotencyKey: 'unrelated-build-event',
      schemaVersion: 1 as const,
      payload: { taskId: 'task-from-another-project', kind: 'build_module' },
    }],
  };
  const fakeSimulation = {
    step: () => snapshot,
    scheduleConstructionProject: (project: { taskIds: string[] }) => [...project.taskIds],
  } as unknown as SocietySimulation;
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 1 });
  const frame = runtime.step(fakeSimulation, 1);

  assert.ok(frame.registeredProjectIds.length > 0, 'recursos suficientes devem permitir registrar blueprint');
  assert.deepEqual(frame.advancedProjectIds, [], 'evento de outra tarefa não pode avançar este projeto');
  for (const projectId of frame.registeredProjectIds) {
    assert.equal(runtime.getConstructionRuntime().getProjectProgress(projectId)?.completedTasks, 0);
  }
});

test('evento de etapa vinculado avança somente o projeto correspondente', () => {
  const base = new SocietySimulation().snapshot();
  const projectId = 'cowila-bp-1-module_workshop';
  const snapshot = {
    ...base,
    tick: 1,
    resources: { food: 60, wood: 60, stone: 60, planks: 60, coins: 999 },
    events: [{
      id: 'linked-construction-event',
      kind: 'task_completed' as const,
      regionId: 'local-suburb',
      tick: 1,
      idempotencyKey: 'linked-construction-event',
      schemaVersion: 1 as const,
      payload: {
        taskId: `construction:${projectId}:gather`,
        constructionProjectId: projectId,
        constructionAssetId: 'module_workshop',
        constructionStage: 'gather',
        kind: 'gather_materials',
      },
    }],
  };
  const fakeSimulation = {
    step: () => snapshot,
    scheduleConstructionProject: (project: { taskIds: string[] }) => [...project.taskIds],
  } as unknown as SocietySimulation;
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 1 });
  const frame = runtime.step(fakeSimulation, 1);

  assert.deepEqual(frame.registeredProjectIds, [projectId]);
  assert.deepEqual(frame.advancedProjectIds, [projectId]);
  assert.equal(runtime.getConstructionRuntime().getProjectProgress(projectId)?.completedTasks, 1);
});

test('step é determinístico para o mesmo caminho de ticks', () => {
  const run = () => {
    const sim = new SocietySimulation();
    const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 15 });
    const frame = runtime.step(sim, 45);
    return {
      tick: frame.snapshot.tick,
      focus: frame.directive?.resourceFocus,
      brief: frame.directive?.brief,
    };
  };
  assert.deepEqual(run(), run());
});


test('runtime learns canonical skill outcomes and persists deduplication across saves', () => {
  const sim = new SocietySimulation();
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 10 });
  runtime.step(sim, 40);

  const learned = runtime.getSkillLearningBook();
  assert.ok(Object.values(learned.bySkill).some((stats) => stats.successCount > 0),
    'completed resident tasks should update skill outcomes');

  const saved = runtime.exportState();
  assert.ok(saved.skillLearning);
  const restored = new SocietyAgentRuntime({ cowilaEveryTicks: 10 });
  assert.equal(restored.restoreState(saved), true);
  assert.deepEqual(restored.exportState().skillLearning, saved.skillLearning);

  const beforeReplay = restored.getSkillLearningBook();
  restored.step(sim, 0);
  assert.deepEqual(restored.getSkillLearningBook(), beforeReplay,
    'restoring a save must not count the same completion events twice');

  // Saves created before skill learning remain valid.
  const legacyState = { ...saved };
  delete legacyState.skillLearning;
  const legacyRuntime = new SocietyAgentRuntime({ cowilaEveryTicks: 10 });
  assert.equal(legacyRuntime.restoreState(legacyState), true);
});

test('persists Cowila memory, project queue and construction publication state', () => {
  const base = new SocietySimulation().snapshot();
  const snapshot = {
    ...base,
    tick: 1,
    resources: { food: 60, wood: 60, stone: 60, planks: 60, coins: 999 },
  };
  const fakeSimulation = {
    step: () => snapshot,
    scheduleConstructionProject: (project: { taskIds: string[] }) => [...project.taskIds],
  } as unknown as SocietySimulation;
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 10 });
  const frame = runtime.step(fakeSimulation, 1);
  assert.ok(frame.registeredProjectIds.length > 0);

  const saved = runtime.exportState();
  const restored = new SocietyAgentRuntime({ cowilaEveryTicks: 10 });
  assert.equal(restored.restoreState(saved), true);
  assert.deepEqual(restored.exportState(), saved);
  assert.deepEqual(restored.getLastDirective(), runtime.getLastDirective());

  const projectId = frame.registeredProjectIds[0]!;
  const taskIds = saved.projectTaskQueue.find((entry) => entry.projectId === projectId)?.taskIds ?? [];
  assert.ok(taskIds.length > 0);
  for (const taskId of taskIds) {
    assert.equal(runtime.notifyConstructionTaskComplete(projectId, taskId), true);
    assert.equal(restored.notifyConstructionTaskComplete(projectId, taskId), true);
  }
  assert.deepEqual(restored.getConstructionRuntime().getReadyPlacements(),
    runtime.getConstructionRuntime().getReadyPlacements());
  assert.equal(runtime.markPlacementsPublished([projectId]), 1);
  assert.equal(restored.markPlacementsPublished([projectId]), 1);
  assert.deepEqual(restored.exportState(), runtime.exportState());
});
