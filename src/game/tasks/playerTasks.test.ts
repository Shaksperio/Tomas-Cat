import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptPlayerTask, advancePlayerTasks, PLAYER_TASKS } from './playerTasks';

test('define um pedido válido para cada um dos nove habitantes', () => {
  assert.equal(PLAYER_TASKS.length, 9);
  assert.equal(new Set(PLAYER_TASKS.map((task) => task.id)).size, 9);
});
test('aceitação é idempotente e rejeita IDs desconhecidos', () => {
  const once = acceptPlayerTask([], 'help:farmer-01');
  assert.deepEqual(acceptPlayerTask(once, 'help:farmer-01'), once);
  assert.deepEqual(acceptPlayerTask(once, 'help:unknown'), once);
});
test('progresso avança apenas no evento correspondente e conclui uma vez', () => {
  let states = acceptPlayerTask([], 'help:farmer-01');
  let result = advancePlayerTasks(states, 'water_drunk');
  assert.equal(result.states[0].progress, 0);
  result = advancePlayerTasks(result.states, 'food_collected', 2);
  assert.equal(result.states[0].progress, 2);
  result = advancePlayerTasks(result.states, 'food_collected');
  assert.equal(result.states[0].status, 'completed');
  assert.equal(result.completed.length, 1);
  result = advancePlayerTasks(result.states, 'food_collected');
  assert.equal(result.completed.length, 0);
});
test('entrada inválida não altera o progresso', () => {
  const states = acceptPlayerTask([], 'help:worker-01');
  assert.deepEqual(advancePlayerTasks(states, 'scrap_collected', 0).states, states);
});
