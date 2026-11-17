import assert from 'node:assert/strict';
import test from 'node:test';
import { SocietyFamilySystem, SIMULATED_YEAR_TICKS } from './family';

function activeUnion(system: SocietyFamilySystem): string {
  const proposal = system.proposeUnion('agent-a', 'agent-b', 0);
  assert.equal(proposal.accepted, true);
  if (!proposal.accepted) throw new Error(proposal.reason);
  assert.equal(system.respondToUnion(proposal.value.id, 'agent-a', true).accepted, true);
  const accepted = system.respondToUnion(proposal.value.id, 'agent-b', true);
  assert.equal(accepted.accepted, true);
  if (!accepted.accepted) throw new Error(accepted.reason);
  assert.equal(accepted.value.status, 'active');
  return proposal.value.id;
}

test('union requires explicit acceptance from both agents', () => {
  const system = new SocietyFamilySystem(['agent-a', 'agent-b']);
  const proposal = system.proposeUnion('agent-a', 'agent-b', 0);
  assert.equal(proposal.accepted, true);
  if (!proposal.accepted) return;
  assert.equal(proposal.value.status, 'pending');
  assert.equal(system.snapshot().unions[0].status, 'pending');
  assert.equal(system.respondToUnion(proposal.value.id, 'agent-b', true).accepted, true);
  assert.equal(system.snapshot().unions[0].status, 'active');
});

test('rejects self-unions, unknown identities, duplicate proposals and third-party responses', () => {
  const system = new SocietyFamilySystem(['agent-a', 'agent-b', 'agent-c']);
  assert.equal(system.proposeUnion('agent-a', 'agent-a', 0).accepted, false);
  assert.equal(system.proposeUnion('agent-a', 'missing', 0).accepted, false);
  const proposal = system.proposeUnion('agent-a', 'agent-b', 0);
  assert.equal(proposal.accepted, true);
  if (!proposal.accepted) return;
  assert.equal(system.proposeUnion('agent-b', 'agent-a', 1).accepted, false);
  assert.equal(system.respondToUnion(proposal.value.id, 'agent-c', true).accepted, false);
  assert.equal(system.respondToUnion(proposal.value.id, 'agent-b', false).accepted, true);
  assert.equal(system.snapshot().unions[0].status, 'declined');
});

test('a descendant is created only after both union members consent in the same simulated year', () => {
  const system = new SocietyFamilySystem(['agent-a', 'agent-b']);
  const unionId = activeUnion(system);
  assert.deepEqual(system.consentToOffspring(unionId, 'agent-a', true, 25), { accepted: true, value: null });
  assert.equal(system.snapshot().offspring.length, 0);
  const result = system.consentToOffspring(unionId, 'agent-b', true, 26);
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.value?.birthYear, 0);
  assert.equal(result.value?.lifeStage, 'infant');
  assert.equal(system.snapshot().offspring.length, 1);
});

test('annual entitlement is idempotent and cannot create two descendants in one year', () => {
  const system = new SocietyFamilySystem(['agent-a', 'agent-b']);
  const unionId = activeUnion(system);
  system.consentToOffspring(unionId, 'agent-a', true, 100);
  const first = system.consentToOffspring(unionId, 'agent-b', true, 101);
  assert.equal(first.accepted, true);
  const repeated = system.consentToOffspring(unionId, 'agent-a', true, 102);
  assert.equal(repeated.accepted, false);
  assert.equal(system.snapshot().offspring.length, 1);
});

test('consent can be withdrawn before the other member agrees', () => {
  const system = new SocietyFamilySystem(['agent-a', 'agent-b']);
  const unionId = activeUnion(system);
  system.consentToOffspring(unionId, 'agent-a', true, 10);
  system.consentToOffspring(unionId, 'agent-a', false, 11);
  const result = system.consentToOffspring(unionId, 'agent-b', true, 12);
  assert.equal(result.accepted, true);
  assert.equal(result.value, null);
  assert.equal(system.snapshot().offspring.length, 0);
});

test('annual entitlement renews on the next simulated year', () => {
  const system = new SocietyFamilySystem(['agent-a', 'agent-b']);
  const unionId = activeUnion(system);
  system.consentToOffspring(unionId, 'agent-a', true, 10);
  system.consentToOffspring(unionId, 'agent-b', true, 11);
  const nextYear = SIMULATED_YEAR_TICKS + 10;
  system.consentToOffspring(unionId, 'agent-a', true, nextYear);
  const result = system.consentToOffspring(unionId, 'agent-b', true, nextYear + 1);
  assert.equal(result.accepted, true);
  assert.equal(system.snapshot().offspring.length, 2);
  assert.equal(system.snapshot().offspring[1].birthYear, 1);
});

test('descendant age and developmental stage advance deterministically', () => {
  const system = new SocietyFamilySystem(['agent-a', 'agent-b']);
  const unionId = activeUnion(system);
  system.consentToOffspring(unionId, 'agent-a', true, 0);
  system.consentToOffspring(unionId, 'agent-b', true, 0);
  system.advanceToTick(3 * SIMULATED_YEAR_TICKS);
  const child = system.snapshot().offspring[0];
  assert.equal(child.ageYears, 3);
  assert.equal(child.lifeStage, 'child');
  system.advanceToTick(18 * SIMULATED_YEAR_TICKS);
  assert.equal(system.snapshot().offspring[0].lifeStage, 'adult');
});

test('world family state is isolated by independent system instances', () => {
  const first = new SocietyFamilySystem(['agent-a', 'agent-b']);
  const second = new SocietyFamilySystem(['agent-a', 'agent-b']);
  const unionId = activeUnion(first);
  first.consentToOffspring(unionId, 'agent-a', true, 0);
  first.consentToOffspring(unionId, 'agent-b', true, 0);
  assert.equal(first.snapshot().offspring.length, 1);
  assert.equal(second.snapshot().offspring.length, 0);
});


test('player identities are not members of the simulated-agent registry and cannot form families', () => {
  const system = new SocietyFamilySystem(['agent-a', 'agent-b']);
  assert.equal(system.proposeUnion('player-001', 'agent-a', 0).accepted, false);
  assert.equal(system.proposeUnion('agent-a', 'player-001', 0).accepted, false);
  assert.equal(system.snapshot().unions.length, 0);
});
