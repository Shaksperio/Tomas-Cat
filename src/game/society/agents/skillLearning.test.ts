import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WorldEvent } from '../contracts.ts';
import { SocietySimulation } from '../simulation.ts';
import { runSpecialistCycle } from './orchestrator.ts';
import {
  applySkillLearningBias,
  emptySkillLearning,
  ingestEventsIntoSkillLearning,
  recordSkillFailure,
  recordSkillSuccess,
  skillPriorityBias,
  skillSuccessRate,
} from './skillLearning.ts';

test('sucesso e falha atualizam taxa e viés', () => {
  let book = emptySkillLearning();
  book = recordSkillSuccess(book, 'farmer.food-security', 10);
  book = recordSkillSuccess(book, 'farmer.food-security', 11);
  book = recordSkillFailure(book, 'farmer.food-security', 12, 'sem sementes');
  assert.equal(skillSuccessRate(book, 'farmer.food-security'), 2 / 3);
  assert.equal(skillPriorityBias(book, 'farmer.food-security'), 5);
  assert.equal(applySkillLearningBias(90, book, 'farmer.food-security'), 95);
});

test('orquestrador sem learning mantém determinismo da #62', () => {
  const snap = new SocietySimulation().snapshot();
  const a = runSpecialistCycle(snap);
  const b = runSpecialistCycle(snap);
  assert.deepEqual(a, b);
  assert.equal(a.mode, 'deterministic-fallback');
});

test('learning com muitas falhas reduz prioridade da proposta', () => {
  const snap = { ...new SocietySimulation().snapshot(), tasks: [] };
  let book = emptySkillLearning();
  for (let i = 0; i < 8; i++) {
    book = recordSkillFailure(book, 'engineer.survey-and-design', i, 'sem recurso');
  }
  const withLearning = runSpecialistCycle(snap, book);
  const baseline = runSpecialistCycle(snap);
  const engBase = baseline.proposals.find((p) => p.skillId === 'engineer.survey-and-design');
  const engLearn = withLearning.proposals.find((p) => p.skillId === 'engineer.survey-and-design');
  if (engBase && engLearn) {
    assert.ok(engLearn.priority < engBase.priority);
  }
});

test('ingestão de eventos idempotente', () => {
  const events: WorldEvent[] = [
    {
      id: 'evt-1',
      kind: 'task_completed',
      regionId: 'local-suburb',
      tick: 3,
      idempotencyKey: 'k1',
      payload: { agentId: 'a1', kind: 'chop_wood', skillId: 'lumberjack.sustainable-forestry' },
      schemaVersion: 1,
    },
  ];
  let book = emptySkillLearning();
  const first = ingestEventsIntoSkillLearning(book, events, 3);
  const second = ingestEventsIntoSkillLearning(first.book, events, 3, first.seenEventIds);
  assert.deepEqual(first.book, second.book);
  assert.equal(skillSuccessRate(first.book, 'lumberjack.sustainable-forestry'), 1);
});
