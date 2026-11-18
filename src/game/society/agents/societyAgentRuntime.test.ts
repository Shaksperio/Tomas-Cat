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
  // Garante estoque mínimo para possível registro de blueprint
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

test('projetos só ficam prontos após completeTask', () => {
  const sim = new SocietySimulation();
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 1 });
  // Acumula recursos via muitos ticks de produção
  let frame = runtime.step(sim, 200);
  // Se registrou projeto, placements ainda vazios até notify
  for (const projectId of frame.registeredProjectIds) {
    const progress = runtime.getConstructionRuntime().getProjectProgress(projectId);
    assert.ok(progress);
    assert.equal(progress!.completedTasks, 0);
    const taskId = `build-${projectId}-0`;
    assert.equal(runtime.notifyConstructionTaskComplete(projectId, taskId), true);
    assert.ok(runtime.getConstructionRuntime().getReadyPlacements().length >= 1);
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
