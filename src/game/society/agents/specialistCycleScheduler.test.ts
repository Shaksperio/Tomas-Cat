import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SocietySimulation } from '../simulation.ts';
import { SkillLearningHost } from './skillLearningHost.ts';
import {
  scheduleSpecialistCycle,
  scheduleSpecialistCycleWithHost,
} from './specialistCycleScheduler.ts';

test('agenda propostas ociosas na fila da simulação', () => {
  const sim = new SocietySimulation();
  const before = sim.snapshot().tasks.length;
  const result = scheduleSpecialistCycle(sim);
  assert.equal(result.report.mode, 'deterministic-fallback');
  const after = sim.snapshot();
  assert.ok(result.scheduledIds.length >= 1 || result.report.proposals.length === 0);
  if (result.scheduledIds.length > 0) {
    assert.ok(after.tasks.length >= before + result.scheduledIds.length
      || after.tasks.some((t) => result.scheduledIds.includes(t.id)));
  }
});

test('segunda chamada no mesmo tick não duplica proposalId', () => {
  const sim = new SocietySimulation();
  const first = scheduleSpecialistCycle(sim);
  const second = scheduleSpecialistCycle(sim);
  assert.equal(second.scheduledIds.length, 0);
  assert.ok(second.skippedIds.length >= first.scheduledIds.length || first.scheduledIds.length === 0);
});

test('host de learning não quebra o agendamento', () => {
  const sim = new SocietySimulation();
  const host = new SkillLearningHost();
  const result = scheduleSpecialistCycleWithHost(sim, host);
  assert.ok(result.report);
  sim.step(5);
  host.observe(sim.snapshot());
  assert.ok(host.getBook());
});
