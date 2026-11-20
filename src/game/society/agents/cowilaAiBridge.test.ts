import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SocietySimulation } from '../simulation.ts';
import {
  applyCowilaAiDecision,
  bridgeCowilaAiDecisionProposals,
  bridgeCowilaAiProposal,
  resolveSkillIdForAgentTask,
} from './cowilaAiBridge.ts';
import { authorizeSpecialistProposal } from './policies.ts';

test('resolve skill canônica por profissão e tarefa', () => {
  assert.equal(resolveSkillIdForAgentTask('engineer', 'survey_site'), 'engineer.survey-and-design');
  assert.equal(resolveSkillIdForAgentTask('farmer', 'cultivate_field'), 'farmer.food-security');
  assert.equal(resolveSkillIdForAgentTask('merchant', 'patrol_area'), undefined);
});

test('bridge preenche skillId e passa na política', () => {
  const snap = { ...new SocietySimulation().snapshot(), tasks: [] };
  const engineer = snap.agents.find((a) => a.profession === 'engineer');
  assert.ok(engineer);
  const bridged = bridgeCowilaAiProposal(
    {
      agentId: engineer!.id,
      taskKind: 'survey_site',
      reason: 'Inspecionar setor para expansão comunitária.',
      priority: 88,
    },
    snap,
    `cowila-ai:${snap.tick}:${engineer!.id}:survey_site`,
  );
  assert.ok(bridged);
  assert.equal(bridged!.skillId, 'engineer.survey-and-design');
  const decision = authorizeSpecialistProposal(bridged!, snap);
  assert.equal(decision.accepted, true, decision.reason);
});

test('rejeita taskKind fora da profissão', () => {
  const snap = new SocietySimulation().snapshot();
  const farmer = snap.agents.find((a) => a.profession === 'farmer');
  assert.ok(farmer);
  const bridged = bridgeCowilaAiProposal(
    {
      agentId: farmer!.id,
      taskKind: 'build_module',
      reason: 'Obra inválida para agricultor.',
      priority: 50,
    },
    snap,
    `cowila-ai:${snap.tick}:x:build_module`,
  );
  assert.equal(bridged, null);
});

test('applyCowilaAiDecision agenda na simulação', () => {
  const sim = new SocietySimulation();
  const snap = sim.snapshot();
  const lumberjack = snap.agents.find((a) => a.profession === 'lumberjack');
  assert.ok(lumberjack);
  const result = applyCowilaAiDecision(sim, {
    tick: snap.tick,
    brief: 'Produção de madeira prioritária.',
    proposals: [{
      agentId: lumberjack!.id,
      taskKind: 'chop_wood',
      reason: 'Produzir madeira para a comunidade.',
      priority: 70,
    }],
  });
  assert.ok(result.accepted >= 1);
  assert.ok(sim.snapshot().tasks.some((t) => t.id.includes('cowila-ai')));
});

test('apply recusa tick desatualizado', () => {
  const sim = new SocietySimulation();
  const result = applyCowilaAiDecision(sim, {
    tick: sim.snapshot().tick + 99,
    brief: 'atrasado',
    proposals: [{ agentId: 'x', taskKind: 'chop_wood', reason: 'y', priority: 1 }],
  });
  assert.equal(result.accepted, 0);
});
