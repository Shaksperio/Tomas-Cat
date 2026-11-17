import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConstructionProject } from './contracts';
import { WorldConstructionRuntime } from './worldConstructionRuntime';

function project(overrides: Partial<ConstructionProject> = {}): ConstructionProject {
  return {
    id: 'district-hall-01',
    name: 'Salão comunitário',
    status: 'validated',
    sectorId: 'suburb-01',
    modules: [{
      assetId: 'community-hall',
      position: { x: 12, z: -4, sectorId: 'suburb-01' },
      rotationY: 0.5,
    }],
    requiredResources: { wood: 4, stone: 2 },
    taskIds: ['site-prepare-01', 'module-build-01'],
    createdByAgentId: 'engineer-01',
    createdAtTick: 12,
    version: 1,
    ...overrides,
  };
}

test('WorldConstructionRuntime', async (t) => {
  await t.test('releases approved placements only after every project task completes', () => {
    const runtime = new WorldConstructionRuntime(new Set(['community-hall']));
    assert.deepEqual(runtime.registerProject(project()), { valid: true });
    assert.equal(runtime.completeTask('district-hall-01', 'site-prepare-01'), true);
    assert.deepEqual(runtime.getReadyPlacements(), []);
    assert.equal(runtime.completeTask('district-hall-01', 'module-build-01'), true);
    assert.deepEqual(runtime.getReadyPlacements(), [{
      projectId: 'district-hall-01',
      placementIndex: 0,
      assetId: 'community-hall',
      sectorId: 'suburb-01',
      x: 12,
      z: -4,
      rotationY: 0.5,
    }]);
    assert.deepEqual(runtime.getReadyPlacements(), [{
      projectId: 'district-hall-01',
      placementIndex: 0,
      assetId: 'community-hall',
      sectorId: 'suburb-01',
      x: 12,
      z: -4,
      rotationY: 0.5,
    }]);
    assert.equal(runtime.markProjectPublished('district-hall-01'), true);
    assert.equal(runtime.markProjectPublished('district-hall-01'), false);
    assert.deepEqual(runtime.getReadyPlacements(), []);
  });

  await t.test('rejects unapproved assets and projects that have not been validated', () => {
    const runtime = new WorldConstructionRuntime(new Set(['community-hall']));
    assert.equal(runtime.registerProject(project({ modules: [{
      assetId: 'unlisted-asset',
      position: { x: 0, z: 0, sectorId: 'suburb-01' },
      rotationY: 0,
    }] })).valid, false);
    assert.equal(runtime.registerProject(project({ status: 'proposed' })).valid, false);
  });

  await t.test('rejects duplicate project registration and duplicate task completion', () => {
    const runtime = new WorldConstructionRuntime(new Set(['community-hall']));
    assert.equal(runtime.registerProject(project()).valid, true);
    assert.equal(runtime.registerProject(project()).valid, false);
    assert.equal(runtime.completeTask('district-hall-01', 'site-prepare-01'), true);
    assert.equal(runtime.completeTask('district-hall-01', 'site-prepare-01'), false);
    assert.deepEqual(runtime.getProjectProgress('district-hall-01'), {
      completedTasks: 1,
      totalTasks: 2,
    });
  });

  await t.test('rejects projects with ambiguous task identities', () => {
    const runtime = new WorldConstructionRuntime(new Set(['community-hall']));
    assert.equal(runtime.registerProject(project({ taskIds: ['same-task', 'same-task'] })).valid, false);
  });
});