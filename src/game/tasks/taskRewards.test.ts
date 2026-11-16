import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTaskRewardDrops } from './taskRewards';

test('normaliza recompensas físicas persistidas e limita quantidades', () => {
  const drops = normalizeTaskRewardDrops([
    { id: 'reward:a', taskId: 'a', title: 'Missão A', x: 2, y: -1, z: 4, amount: 150.7 },
    { id: 'reward:a', taskId: 'a', title: 'Duplicada', x: 0, y: 0, z: 0, amount: 2 },
    { id: 'bad', taskId: 'b', title: 'Inválida', x: Number.NaN, y: 0, z: 0, amount: 1 },
  ]);
  assert.deepEqual(drops, [{ id: 'reward:a', taskId: 'a', title: 'Missão A', x: 2, y: 0, z: 4, amount: 99 }]);
});

test('saves antigos sem drops continuam válidos', () => {
  assert.deepEqual(normalizeTaskRewardDrops(undefined), []);
  assert.deepEqual(normalizeTaskRewardDrops(null), []);
});
