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

test('host registra sucesso sob o ID canônico da skill do agente', () => {
  const sim = new SocietySimulation();
  const host = new SkillLearningHost();
  const snapshot = sim.step(40);
  host.observe(snapshot);

  const completed = snapshot.events.find((event) =>
    event.kind === 'task_completed'
    && typeof event.payload.agentId === 'string',
  );
  assert.ok(completed);
  const agentId = String(completed.payload.agentId);
  const agent = snapshot.agents.find((candidate) => candidate.id === agentId);
  assert.ok(agent);
  const expectedSkillId = {
    engineer: 'engineer.survey-and-design',
    worker: 'worker.construction-execution',
    agent: 'agent.security-and-mediation',
    farmer: 'farmer.food-security',
    lumberjack: 'lumberjack.sustainable-forestry',
    miner: 'miner.resource-extraction',
    carpenter: 'carpenter.material-processing',
    merchant: 'merchant.community-economy',
  }[agent.profession];
  assert.ok(expectedSkillId);
  assert.ok((host.getBook().bySkill[expectedSkillId]?.successCount ?? 0) > 0);
});

test('host + orquestrador não quebram ciclo sem histórico', () => {
  const snap = new SocietySimulation().snapshot();
  const host = new SkillLearningHost();
  const learning = host.observe(snap);
  const report = runSpecialistCycle(snap, learning);
  assert.equal(report.mode, 'deterministic-fallback');
  assert.ok(Array.isArray(report.proposals));
});
