import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceTaskCycleEvent, createTaskCycleState, CYCLE_TASK_CATALOG, TASK_CYCLE_SECONDS, tickTaskCycle } from './taskCycles';

function elapse(state: ReturnType<typeof createTaskCycleState>, seconds: number) {
  let current = state;
  const created = [];
  for (let i = 0; i < seconds; i++) { const result = tickTaskCycle(current, 1); current = result.state; created.push(...result.created); }
  return { state: current, created };
}

test('cria a primeira tarefa somente após 600 segundos de jogo ativo', () => {
  let state = createTaskCycleState();
  let result = elapse(state, TASK_CYCLE_SECONDS - 1);
  assert.equal(result.created.length, 0);
  result = elapse(result.state, 1);
  assert.equal(result.created.length, 1);
  assert.equal(result.state.cycleNumber, 1);
  assert.equal(result.created[0].status, 'active');
});

test('ignora delta inválido e limita avanço por chamada a um segundo', () => {
  const state = createTaskCycleState();
  assert.equal(tickTaskCycle(state, Number.NaN).state.activeSeconds, 0);
  assert.equal(tickTaskCycle(state, 100).state.activeSeconds, 1);
});

test('executa etapas em sequência e entrega conclusão uma única vez', () => {
  const created = elapse(createTaskCycleState(), TASK_CYCLE_SECONDS).created[0];
  let state = { ...createTaskCycleState(), cycleNumber: 1, issuedIds: [created.id.split(':')[1]], tasks: [created] };
  const first = created.stages[0];
  let result = advanceTaskCycleEvent(state, first.event, first.target);
  state = result.state;
  assert.equal(state.tasks[0].stageIndex, 1);
  assert.equal(result.completed.length, 0);
  const second = state.tasks[0].stages[1];
  result = advanceTaskCycleEvent(state, second.event, second.target);
  assert.equal(result.completed.length, 1);
  assert.equal(result.state.tasks[0].status, 'completed');
  assert.equal(advanceTaskCycleEvent(result.state, second.event, second.target).completed.length, 0);
});

test('não repete modelos de tarefas concluídas/emitidas e encerra catálogo sem duplicar', () => {
  let state = createTaskCycleState();
  const ids = new Set<string>();
  for (let i = 0; i < CYCLE_TASK_CATALOG.length + 2; i++) {
    const result = elapse(state, TASK_CYCLE_SECONDS);
    state = result.state;
    for (const task of result.created) ids.add(task.id.split(':')[1]);
  }
  assert.equal(ids.size, CYCLE_TASK_CATALOG.length);
  assert.equal(state.issuedIds.length, CYCLE_TASK_CATALOG.length);
});
