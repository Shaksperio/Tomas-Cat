import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorldContentPackage,
  serializeWorldContentPackage,
} from './worldContentPackage';
import type { ConstructionProject } from './contracts';

const project: ConstructionProject = {
  id: 'project:district-01',
  name: 'Distrito comunitário',
  status: 'completed',
  sectorId: 'sector:02',
  modules: [
    { assetId: 'house-small', position: { x: 12, z: 8, sectorId: 'sector:02' }, rotationY: 0 },
    { assetId: 'road-straight', position: { x: 16, z: 8, sectorId: 'sector:02' }, rotationY: Math.PI / 2 },
  ],
  requiredResources: { wood: 10, stone: 4 },
  taskIds: ['task:b', 'task:a'],
  createdByAgentId: 'agent:engineer-01',
  createdAtTick: 42,
  version: 3,
};

const input = {
  contentId: 'district-suburb-01',
  contentVersion: 1,
  worldId: 'quarantine-city',
  scenarioTemplateId: 'suburb-template',
  minimumEngineVersion: '1.0.0',
  project,
};
const worlds = new Set(['quarantine-city']);
const templates = new Set(['suburb-template']);
const assets = new Set(['house-small', 'road-straight']);

test('exports a completed project as declarative, catalog-approved content', () => {
  const result = createWorldContentPackage(input, worlds, templates, assets);
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.package.manifest.moduleCount, 2);
  assert.deepEqual(result.package.placements.map((placement) => placement.assetId), [
    'house-small',
    'road-straight',
  ]);
  assert.deepEqual(result.package.provenance.sourceTaskIds, ['task:a', 'task:b']);
  assert.equal('script' in result.package, false);
});

test('rejects uncompleted projects and unapproved world, template or assets', () => {
  assert.equal(createWorldContentPackage({
    ...input, project: { ...project, status: 'active' },
  }, worlds, templates, assets).valid, false);
  assert.equal(createWorldContentPackage(input, new Set(), templates, assets).valid, false);
  assert.equal(createWorldContentPackage(input, worlds, new Set(), assets).valid, false);
  assert.equal(createWorldContentPackage(input, worlds, templates, new Set(['house-small'])).valid, false);
});

test('rejects malformed versions and non-finite placement coordinates', () => {
  assert.equal(createWorldContentPackage({ ...input, contentVersion: 0 }, worlds, templates, assets).valid, false);
  const malformed = {
    ...input,
    project: {
      ...project,
      modules: [{ ...project.modules[0], position: { ...project.modules[0].position, x: Number.NaN } }],
    },
  };
  assert.equal(createWorldContentPackage(malformed, worlds, templates, assets).valid, false);
});

test('serializes the same package deterministically regardless of source task order', () => {
  const first = createWorldContentPackage(input, worlds, templates, assets);
  const second = createWorldContentPackage({
    ...input,
    project: { ...project, taskIds: ['task:a', 'task:b'] },
  }, worlds, templates, assets);
  assert.equal(first.valid && second.valid, true);
  if (!first.valid || !second.valid) return;
  assert.equal(serializeWorldContentPackage(first.package), serializeWorldContentPackage(second.package));
});
