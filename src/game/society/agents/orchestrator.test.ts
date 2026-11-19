import assert from 'node:assert/strict';
import test from 'node:test';
import { SocietySimulation } from '../simulation';
import { runSpecialistCycle } from './orchestrator';

test('orchestrator derives proposals from versioned skills, not fixed DEFAULT_TASK', () => {
  const base = new SocietySimulation().snapshot();
  const snapshot = { ...base, tasks: [] };
  const report = runSpecialistCycle(snapshot);
  assert.ok(report.proposals.length > 0);
  assert.ok(report.proposals.every((proposal) => typeof proposal.skillId === 'string' && proposal.skillId.length > 0));
  assert.ok(report.proposals.some((proposal) => proposal.skillId === 'engineer.survey-and-design'));
  assert.equal(report.mode, 'deterministic-fallback');
});
