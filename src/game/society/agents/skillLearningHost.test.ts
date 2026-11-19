import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SocietySimulation } from '../simulation.ts';
import { runSpecialistCycle } from './orchestrator.ts';
import { SkillLearningHost } from './skillLearningHost.ts';

test('host observa ticks e permanece determinístico', () => {
  const sim = new SocietySimulation();
  const host = new SkillLearningHost();
  const a = host.observe(sim.step(20));
  const b = host.observe(sim.snapshot());
  assert.deepEqual(a, b);
  const exported = host.exportBook();
  const host2 = new SkillLearningHost();
  host2.importBook(exported);
  assert.deepEqual(host2.getBook(), exported);
});

test('host + orquestrador não quebram ciclo sem histórico', () => {
  const snap = new SocietySimulation().snapshot();
  const host = new SkillLearningHost();
  const learning = host.observe(snap);
  const report = runSpecialistCycle(snap, learning);
  assert.equal(report.mode, 'deterministic-fallback');
  assert.ok(Array.isArray(report.proposals));
});
