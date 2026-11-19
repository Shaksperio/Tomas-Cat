import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_RUNTIME_VERSION,
  AGENT_SKILLS,
  authorizeDelegation,
  buildAgentRuntimeContext,
  getSkillForProfession,
} from './agentRuntime';

const agents = [
  { id: 'agent-001', profession: 'engineer', allowedTasks: ['survey_site', 'design_project'], status: 'idle', activeTaskId: null },
  { id: 'agent-002', profession: 'farmer', allowedTasks: ['cultivate_field'], status: 'idle', activeTaskId: null },
];

test('runtime exposes canonical versioned skill IDs and bounded tool capabilities', () => {
  const context = buildAgentRuntimeContext(agents);
  assert.equal(context.version, AGENT_RUNTIME_VERSION);
  assert.equal(context.maxDelegationDepth, 1);
  assert.equal(context.maxProposalsPerCycle, 3);
  assert.equal(context.skills[0].skillId, 'engineer.survey-and-design');
  assert.equal(context.skills[1].skillId, 'farmer.food-security');
  assert.ok(context.skills[0].toolCapabilities.includes('construction.propose_blueprint'));
  assert.equal(AGENT_SKILLS.length, 8);
  assert.equal(getSkillForProfession('unknown'), undefined);
});

test('delegation accepts only tasks authorized by both skill and agent', () => {
  assert.equal(authorizeDelegation({ agentId: 'agent-001', taskKind: 'survey_site', reason: 'Mapear terreno', priority: 70 }, agents).accepted, true);
  assert.equal(authorizeDelegation({ agentId: 'agent-002', taskKind: 'design_project', reason: 'Projetar', priority: 70 }, agents).accepted, false);
});

test('delegation is single-hop and rejects busy agents', () => {
  assert.equal(authorizeDelegation({ agentId: 'agent-001', taskKind: 'survey_site', reason: 'Mapear', priority: 50, depth: 2 }, agents).accepted, false);
  assert.equal(authorizeDelegation({ agentId: 'agent-001', taskKind: 'survey_site', reason: 'Mapear', priority: 50, depth: 1.5 }, agents).accepted, false);
  const busy = [{ ...agents[0], status: 'working', activeTaskId: 'task-1' }];
  assert.equal(authorizeDelegation({ agentId: 'agent-001', taskKind: 'survey_site', reason: 'Mapear', priority: 50 }, busy).accepted, false);
});

test('invalid proposals are rejected and auditable', () => {
  const result = authorizeDelegation({ agentId: 'agent-001', taskKind: 'survey_site', reason: '', priority: 50 }, agents);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /Justificativa/);
  assert.equal(result.skillId, 'engineer.survey-and-design');
  assert.equal(authorizeDelegation({ agentId: 'agent-001', taskKind: 'survey_site', reason: 'ok', priority: 101 }, agents).accepted, false);
});
