import { describe, expect, it } from 'vitest';
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

describe('WorldConstructionRuntime', () => {
  it('releases approved placements only after every project task completes', () => {
    const runtime = new WorldConstructionRuntime(new Set(['community-hall']));
    expect(runtime.registerProject(project())).toEqual({ valid: true });
    expect(runtime.completeTask('site-prepare-01')).toBe(true);
    expect(runtime.getReadyPlacements()).toEqual([]);
    expect(runtime.completeTask('module-build-01')).toBe(true);
    expect(runtime.getReadyPlacements()).toEqual([{
      projectId: 'district-hall-01',
      placementIndex: 0,
      assetId: 'community-hall',
      sectorId: 'suburb-01',
      x: 12,
      z: -4,
      rotationY: 0.5,
    }]);
    expect(runtime.getReadyPlacements()).toEqual([]);
  });

  it('rejects unapproved assets and projects that have not been validated', () => {
    const runtime = new WorldConstructionRuntime(new Set(['community-hall']));
    expect(runtime.registerProject(project({ modules: [{
      assetId: 'unlisted-asset',
      position: { x: 0, z: 0, sectorId: 'suburb-01' },
      rotationY: 0,
    }] })).valid).toBe(false);
    expect(runtime.registerProject(project({ status: 'proposed' })).valid).toBe(false);
  });

  it('rejects duplicate project registration and duplicate task completion', () => {
    const runtime = new WorldConstructionRuntime(new Set(['community-hall']));
    expect(runtime.registerProject(project()).valid).toBe(true);
    expect(runtime.registerProject(project()).valid).toBe(false);
    expect(runtime.completeTask('site-prepare-01')).toBe(true);
    expect(runtime.completeTask('site-prepare-01')).toBe(false);
    expect(runtime.getProjectProgress('district-hall-01')).toEqual({
      completedTasks: 1,
      totalTasks: 2,
    });
  });

  it('rejects projects with ambiguous task identities', () => {
    const runtime = new WorldConstructionRuntime(new Set(['community-hall']));
    expect(runtime.registerProject(project({ taskIds: ['same-task', 'same-task'] })).valid).toBe(false);
  });
});
