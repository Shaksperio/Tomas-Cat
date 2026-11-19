import assert from 'node:assert/strict';
import test from 'node:test';
import { SocietySimulation } from '../simulation';
import { listSpecialistRoles, runSpecialistCycle } from './orchestrator';
import { authorizeSpecialistProposal, type SpecialistTaskProposal } from './policies';

function proposalFor(snapshot: ReturnType<SocietySimulation['snapshot']>): SpecialistTaskProposal {
  const agent = snapshot.agents.find((candidate) => candidate.id === 'engineer-01');
  assert.ok(agent);
  return {
    proposalId: 'proposal:engineer:001',
    agentId: agent.id,
    taskKind: 'survey_site',
    sectorId: agent.position.sectorId,
    target: null,
    requiredResources: {},
    reason: 'Avaliar um terreno para expansão segura.',
    priority: 90,
    createdAtTick: snapshot.tick,
  };
}

test('registers the eight existing society professions as specialist roles', () => {
  assert.equal(listSpecialistRoles().length, 8);
  assert.deepEqual(listSpecialistRoles(), [
    'community-engineer', 'construction-worker', 'community-warden', 'farmer',
    'forester', 'miner', 'carpenter', 'merchant',
  ]);
});

test('specialist cycle is deterministic and does not mutate the society snapshot', () => {
  const snapshot = new SocietySimulation().snapshot();
  const before = structuredClone(snapshot);
  const first = runSpecialistCycle(snapshot);
  const second = runSpecialistCycle(snapshot);
  assert.deepEqual(first, second);
  assert.deepEqual(snapshot, before);
  assert.equal(first.mode, 'deterministic-fallback');
});

test('rejects a proposal outside the specialist profession allowlist', () => {
  const snapshot = new SocietySimulation().snapshot();
  const invalid = { ...proposalFor(snapshot), taskKind: 'trade_goods' as const };
  const result = authorizeSpecialistProposal(invalid, snapshot);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /profissão/);
});

test('rejects proposals that request unavailable community resources', () => {
  const snapshot = new SocietySimulation().snapshot();
  const invalid = { ...proposalFor(snapshot), requiredResources: { wood: 999 } };
  const result = authorizeSpecialistProposal(invalid, snapshot);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /insuficiente/);
});

test('accepts a valid specialist proposal without executing or mutating it', () => {
  const original = new SocietySimulation().snapshot();
  const snapshot = { ...original, tasks: [] };
  const proposal = proposalFor(snapshot);
  const before = structuredClone(snapshot);
  const result = authorizeSpecialistProposal(proposal, snapshot);
  assert.equal(result.accepted, true);
  assert.match(result.reason, /controlador autoritativo/);
  assert.deepEqual(snapshot, before);
});

test('rejects stale, malformed and over-prioritized proposals', () => {
  const snapshot = new SocietySimulation().snapshot();
  const base = proposalFor(snapshot);
  assert.equal(authorizeSpecialistProposal({ ...base, createdAtTick: -1 }, snapshot).accepted, false);
  assert.equal(authorizeSpecialistProposal({ ...base, proposalId: 'x' }, snapshot).accepted, false);
  assert.equal(authorizeSpecialistProposal({ ...base, priority: 101 }, snapshot).accepted, false);
});

test('validates that a declared skill matches both profession and task', () => {
  const original = new SocietySimulation().snapshot();
  const snapshot = { ...original, tasks: [] };
  const base = proposalFor(snapshot);
  const valid = authorizeSpecialistProposal({ ...base, skillId: 'engineer.survey-and-design' }, snapshot);
  assert.equal(valid.accepted, true);
  const wrongProfession = authorizeSpecialistProposal({ ...base, skillId: 'farmer.food-security' }, snapshot);
  assert.equal(wrongProfession.accepted, false);
  const unknown = authorizeSpecialistProposal({ ...base, skillId: 'unknown.skill' }, snapshot);
  assert.equal(unknown.accepted, false);
});
