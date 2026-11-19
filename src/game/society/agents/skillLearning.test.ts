import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WorldEvent } from '../contracts.ts';
import {
  emptySkillLearning,
  ingestEventsIntoSkillLearning,
  listSkillLearningStats,
  recordSkillFailure,
  recordSkillSuccess,
  skillPriorityBias,
  skillSuccessRate,
} from './skillLearning.ts';

test('sucesso e falha atualizam taxa e viés de prioridade', () => {
  let book = emptySkillLearning();
  book = recordSkillSuccess(book, 'farmer.food-security', 10);
  book = recordSkillSuccess(book, 'farmer.food-security', 11);
  book = recordSkillFailure(book, 'farmer.food-security', 12, 'sem sementes');
  assert.equal(skillSuccessRate(book, 'farmer.food-security'), 2 / 3);
  assert.equal(skillPriorityBias(book, 'farmer.food-security'), 5);
  assert.equal(skillSuccessRate(book, 'unknown'), 0.5);
  assert.equal(skillPriorityBias(book, 'unknown'), 0);
});

test('skills com muitas falhas recebem viés negativo', () => {
  let book = emptySkillLearning();
  for (let i = 0; i < 5; i++) {
    book = recordSkillFailure(book, 'worker.construction-execution', i, 'falta madeira');
  }
  assert.ok(skillSuccessRate(book, 'worker.construction-execution') <= 0.2);
  assert.equal(skillPriorityBias(book, 'worker.construction-execution'), -10);
});

test('ingestão de eventos é idempotente e determinística', () => {
  const events: WorldEvent[] = [
    {
      id: 'evt-b',
      kind: 'task_completed',
      tick: 5,
      sourceId: 'sim',
      idempotencyKey: 'k1',
      payload: { agentId: 'a1', kind: 'chop_wood', skillId: 'lumberjack.sustainable-forestry' },
    },
    {
      id: 'evt-a',
      kind: 'task_completed',
      tick: 4,
      sourceId: 'sim',
      idempotencyKey: 'k0',
      payload: { agentId: 'a1', kind: 'chop_wood' },
    },
  ];
  let book = emptySkillLearning();
  let seen = new Set<string>();
  const first = ingestEventsIntoSkillLearning(book, events, 5, seen);
  const second = ingestEventsIntoSkillLearning(first.book, events, 5, first.seenEventIds);
  assert.deepEqual(first.book, second.book);
  assert.equal(skillSuccessRate(first.book, 'lumberjack.sustainable-forestry'), 1);
  assert.equal(skillSuccessRate(first.book, 'task:chop_wood'), 1);
  assert.ok(listSkillLearningStats(first.book).length >= 2);
});
