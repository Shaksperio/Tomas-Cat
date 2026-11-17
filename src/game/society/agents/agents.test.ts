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

test('specialist proposals enter the authoritative task queue exactly once', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.step(20);
  const specialistTasks = snapshot.tasks.filter((task) => task.id.startsWith('specialist-'));
  assert.ok(specialistTasks.length > 0, 'idle specialists should create approved tasks');
  assert.equal(new Set(specialistTasks.map((task) => task.id)).size, specialistTasks.length);
  for (const task of specialistTasks) {
    assert.equal(task.status === 'queued' || task.status === 'assigned'
      || task.status === 'in_progress' || task.status === 'completed', true);
    assert.equal(task.assignedAgentId === null || snapshot.agents.some((agent) => agent.id === task.assignedAgentId), true);
  }
});

