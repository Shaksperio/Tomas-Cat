import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeProbation,
  createDisciplineRecord,
  evaluateViolation,
  isIdentityGloballyBlocked,
  requestReintegration,
} from './governance';

function violation(id: string, tick: number, kind: 'policy_bypass' | 'verified_incitement' = 'policy_bypass') {
  return { id, agentId: 'agent:rogue-01', kind, tick, evidenceId: `evidence:${id}`, verified: true };
}

test('unverified allegations and duplicate events do not punish an agent', () => {
  const initial = createDisciplineRecord('agent:rogue-01');
  const allegation = { ...violation('event:1', 1), verified: false };
  assert.equal(evaluateViolation(initial, allegation).action, 'no_action');
  const first = evaluateViolation(initial, violation('event:1', 1));
  assert.equal(evaluateViolation(first.record, violation('event:1', 2)).action, 'no_action');
});

test('suspends a verified rule bypass and requires acceptance plus review to return', () => {
  const initial = createDisciplineRecord('agent:rogue-01');
  const suspended = evaluateViolation(initial, violation('event:1', 10));
  assert.equal(suspended.record.status, 'suspended');
  assert.equal(requestReintegration(suspended.record, 39, true, true).action, 'no_action');
  const returned = requestReintegration(suspended.record, 40, true, true);
  assert.equal(returned.record.status, 'probation');
  assert.equal(completeProbation(returned.record, 100).status, 'active');
});

test('repeated verified incitement permanently blocks the global identity', () => {
  const first = evaluateViolation(createDisciplineRecord('agent:rogue-01'), violation('event:1', 1, 'verified_incitement'));
  const second = evaluateViolation(first.record, violation('event:2', 2, 'verified_incitement'));
  assert.equal(second.action, 'permanent_block');
  assert.equal(isIdentityGloballyBlocked('agent:rogue-01', new Set(), second.record), true);
  assert.equal(requestReintegration(second.record, 999, true, true).action, 'no_action');
});

test('permanent global block remains effective across worlds without a local record', () => {
  assert.equal(isIdentityGloballyBlocked('agent:rogue-01', new Set(['agent:rogue-01'])), true);
});
