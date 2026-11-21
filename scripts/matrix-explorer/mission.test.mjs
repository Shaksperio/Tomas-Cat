import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMission, validateMission } from './mission.mjs';

const valid = {
  version: 1,
  id: 'visit-emporio',
  goal: { type: 'visit_shop', targetKind: 'shop', targetId: 'shop-emporio' },
  constraints: { maxDurationSeconds: 60, maxWaypoints: 40, sprint: false, interact: true },
};

test('accepts a bounded visit-shop mission', () => {
  assert.deepEqual(validateMission(valid), valid);
});

test('fills safe defaults when constraints are omitted', () => {
  const mission = validateMission({ version: 1, id: 'nearest-shop', goal: { type: 'visit_shop', targetKind: 'shop' } });
  assert.deepEqual(mission.constraints, { maxDurationSeconds: 60, maxWaypoints: 40, sprint: false, interact: true });
});

test('rejects unknown root and goal properties', () => {
  assert.throws(() => validateMission({ ...valid, script: 'alert(1)' }), /propriedades não permitidas/);
  assert.throws(() => validateMission({ ...valid, goal: { ...valid.goal, callback: 'arbitrary' } }), /goal visit_shop/);
});

test('rejects unsupported goals and target kinds', () => {
  assert.throws(() => validateMission({ ...valid, goal: { ...valid.goal, type: 'execute_js' } }), /goal visit_shop/);
  assert.throws(() => validateMission({ ...valid, goal: { ...valid.goal, targetKind: 'terminal' } }), /goal visit_shop/);
});

test('rejects unsafe duration and waypoint limits', () => {
  assert.throws(() => validateMission({ ...valid, constraints: { ...valid.constraints, maxDurationSeconds: 999 } }), /limites fora/);
  assert.throws(() => validateMission({ ...valid, constraints: { ...valid.constraints, maxWaypoints: 0 } }), /limites fora/);
});

test('loads and validates the checked-in example mission', async () => {
  const mission = await loadMission(['--mission', 'mission.example.json']);
  assert.equal(mission.id, 'visit-emporio');
  assert.equal(mission.goal.targetId, 'shop-emporio');
});
