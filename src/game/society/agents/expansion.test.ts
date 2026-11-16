import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canWorkersExecuteExpansion,
  validateWorldExpansion,
  type WorldExpansionProposal,
} from './expansion';

const catalog = {
  playableWorldIds: new Set(['quarantine-city']),
  approvedScenarioTemplateIds: new Set(['suburb-template']),
  approvedModuleAssetIds: new Set(['house-small', 'road-straight']),
};

const proposal: WorldExpansionProposal = {
  id: 'expansion:suburb-01',
  kind: 'city_district',
  title: 'Novo bairro',
  worldId: 'quarantine-city',
  sectorId: 'suburb-02',
  proposedByAgentId: 'agent:engineer-01',
  engineerAgentId: 'agent:engineer-01',
  workerAgentIds: ['agent:worker-01', 'agent:worker-02'],
  scenarioTemplateId: 'suburb-template',
  modules: [
    { assetId: 'house-small', position: { x: 10, z: 12, sectorId: 'suburb-02' }, rotationY: 0 },
    { assetId: 'road-straight', position: { x: 14, z: 12, sectorId: 'suburb-02' }, rotationY: 0 },
  ],
  requiredResources: { wood: 10, stone: 4 },
  createdAtTick: 12,
};

test('accepts an expansion only when world, template and modules are approved', () => {
  assert.deepEqual(validateWorldExpansion(proposal, catalog), { valid: true });
});

test('rejects unknown world templates and unapproved 3D modules', () => {
  assert.equal(validateWorldExpansion({ ...proposal, scenarioTemplateId: 'untrusted-template' }, catalog).valid, false);
  const untrusted = { ...proposal, modules: [{ ...proposal.modules[0], assetId: 'runtime-injected-mesh' }] };
  assert.equal(validateWorldExpansion(untrusted, catalog).valid, false);
});

test('workers cannot execute an expansion before engine approval', () => {
  assert.equal(canWorkersExecuteExpansion(proposal, new Set(), new Set(proposal.workerAgentIds)), false);
  assert.equal(canWorkersExecuteExpansion(proposal, new Set([proposal.id]), new Set(proposal.workerAgentIds)), true);
  assert.equal(canWorkersExecuteExpansion(proposal, new Set([proposal.id]), new Set(['agent:worker-01'])), false);
});
