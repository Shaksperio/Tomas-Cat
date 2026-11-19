import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldEvent } from '../contracts';
import {
  emptyAgentMemory,
  formatAgentMemoryBrief,
  ingestEventsIntoMemory,
  memoryForAgent,
} from './agentMemory';

test('collective wage event records memory for every paid resident', () => {
  const event: WorldEvent = {
    id: 'wage-event-100',
    kind: 'wage_paid',
    regionId: 'local-suburb',
    tick: 100,
    idempotencyKey: 'local:wage_paid:treasury:100',
    schemaVersion: 1,
    payload: {
      paid: [
        { agentId: 'worker-01', amount: 4 },
        { agentId: 'farmer-01', amount: 4 },
      ],
      unpaid: ['merchant-01'],
      treasury: 12,
    },
  };

  const book = ingestEventsIntoMemory(emptyAgentMemory(), [event], 100);
  assert.match(formatAgentMemoryBrief(book, 'worker-01'), /Recebeu salário comunitário/);
  assert.match(formatAgentMemoryBrief(book, 'farmer-01'), /Recebeu salário comunitário/);
  assert.equal(memoryForAgent(book, 'merchant-01').length, 0);
  assert.deepEqual(ingestEventsIntoMemory(book, [event], 100), book);
});

test('task completion memory is idempotent and attributed to its resident', () => {
  const event: WorldEvent = {
    id: 'task-event-1',
    kind: 'task_completed',
    regionId: 'local-suburb',
    tick: 12,
    idempotencyKey: 'local:task_completed:task-1:12',
    schemaVersion: 1,
    payload: { taskId: 'task-1', agentId: 'worker-01', kind: 'gather_materials' },
  };

  const first = ingestEventsIntoMemory(emptyAgentMemory(), [event], 12);
  const second = ingestEventsIntoMemory(first, [event], 12);
  assert.deepEqual(second, first);
  assert.match(formatAgentMemoryBrief(first, 'worker-01'), /Concluiu gather_materials/);
});
