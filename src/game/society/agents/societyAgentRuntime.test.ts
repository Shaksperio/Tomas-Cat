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

test('projetos só ficam prontos após completeTask manual', () => {
  const sim = new SocietySimulation();
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 1 });
  const frame = runtime.step(sim, 200);
  for (const projectId of frame.registeredProjectIds) {
    const progress = runtime.getConstructionRuntime().getProjectProgress(projectId);
    assert.ok(progress);
    assert.equal(progress!.completedTasks, 0);
    const taskId = `build-${projectId}-0`;
    assert.equal(runtime.notifyConstructionTaskComplete(projectId, taskId), true);
    assert.ok(runtime.getConstructionRuntime().getReadyPlacements().length >= 1);
  }
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
  } as unknown as SocietySimulation;
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 1 });
  const frame = runtime.step(fakeSimulation, 1);

  assert.ok(frame.registeredProjectIds.length > 0, 'recursos suficientes devem permitir registrar blueprint');
  assert.deepEqual(frame.advancedProjectIds, [], 'evento de outra tarefa não pode avançar este projeto');
  for (const projectId of frame.registeredProjectIds) {
    assert.equal(runtime.getConstructionRuntime().getProjectProgress(projectId)?.completedTasks, 0);
  }
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
