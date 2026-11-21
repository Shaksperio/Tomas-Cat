import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SocietySimulation } from '../simulation.ts';
import {
  applyCowilaAiDecision,
  bridgeCowilaAiProposal,
  resolveSkillIdForAgentTask,
} from './cowilaAiBridge.ts';

test('resolve skill canônica por profissão e tarefa', () => {
  assert.equal(resolveSkillIdForAgentTask('engineer', 'survey_site'), 'engineer.survey-and-design');
  assert.equal(resolveSkillIdForAgentTask('farmer', 'cultivate_field'), 'farmer.food-security');
  assert.equal(resolveSkillIdForAgentTask('merchant', 'patrol_area'), undefined);
});

test('bridge preenche skillId para uma tarefa autorizada', () => {
  const snapshot = new SocietySimulation().snapshot();
  const engineer = snapshot.agents.find((agent) => agent.profession === 'engineer');
  assert.ok(engineer);
  const bridged = bridgeCowilaAiProposal({
    agentId: engineer.id,
    taskKind: 'survey_site',
    reason: 'Inspecionar setor para expansão comunitária.',
    priority: 88,
  }, snapshot, `cowila-ai:${snapshot.tick}:${engineer.id}:survey_site`);
  assert.ok(bridged);
  assert.equal(bridged.skillId, 'engineer.survey-and-design');
});

test('rejeita tarefa incompatível com a profissão', () => {
  const snapshot = new SocietySimulation().snapshot();
  const farmer = snapshot.agents.find((agent) => agent.profession === 'farmer');
  assert.ok(farmer);
  assert.equal(bridgeCowilaAiProposal({
    agentId: farmer.id,
    taskKind: 'build_module',
    reason: 'Obra inválida para agricultor.',
    priority: 50,
  }, snapshot, `cowila-ai:${snapshot.tick}:farmer:build_module`), null);
});

test('aplica decisão atual e agenda tarefa na simulação', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.snapshot();
  const lumberjack = snapshot.agents.find((agent) => agent.profession === 'lumberjack');
  assert.ok(lumberjack);
  const result = applyCowilaAiDecision(simulation, {
    tick: snapshot.tick,
    brief: 'Produção de madeira prioritária.',
    proposals: [{
      agentId: lumberjack.id,
      taskKind: 'chop_wood',
      reason: 'Produzir madeira para a comunidade.',
      priority: 70,
    }],
  });
  assert.equal(result.accepted, 1);
  assert.ok(simulation.snapshot().tasks.some((task) => task.id.includes('cowila-ai')));
});

test('descarta decisão de tick antigo', () => {
  const simulation = new SocietySimulation();
  const result = applyCowilaAiDecision(simulation, {
    tick: simulation.snapshot().tick + 99,
    brief: 'atrasado',
    proposals: [{ agentId: 'x', taskKind: 'chop_wood', reason: 'y', priority: 1 }],
  });
  assert.equal(result.accepted, 0);
  assert.equal(result.skipped, 1);
});
