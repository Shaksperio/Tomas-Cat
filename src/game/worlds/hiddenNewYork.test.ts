import assert from 'node:assert/strict';
import testCase from 'node:test';
import * as THREE from 'three';
import {
  buildHiddenNewYorkDistrict,
  getMetropolisDistrictName,
  HIDDEN_NEW_YORK_SANCTUARY,
  METROPOLIS_POPULATION,
} from './hiddenNewYork';

testCase('metrópole oculta constrói infraestrutura urbana, população e santuário', () => {
  const root = new THREE.Group();
  const colliders = buildHiddenNewYorkDistrict(root);
  assert.ok(root.getObjectByName('metropolis-ground'));
  assert.ok(root.getObjectByName('metropolis-road-network'));
  assert.ok(root.getObjectByName('metropolis-river'));
  assert.ok(root.getObjectByName('central-park'));
  assert.ok(root.getObjectByName('metropolis-building-instances'));
  assert.ok(root.getObjectByName('metropolis-resident-crowd'));
  assert.ok(root.getObjectByName('metropolis-traffic'));
  assert.ok(root.getObjectByName('metropolis-suspension-bridge'));
  assert.ok(root.getObjectByName('hidden-oracle-sanctuary'));
  assert.ok(colliders.length > 30);
  assert.equal(METROPOLIS_POPULATION, 850_000);
  assert.deepEqual(HIDDEN_NEW_YORK_SANCTUARY, { x: -45, y: 0, z: -190 });
});

testCase('distritos da metrópole são identificados sem expor o destino secreto', () => {
  assert.equal(getMetropolisDistrictName(220, 0), 'Distrito Portuário');
  assert.equal(getMetropolisDistrictName(-190, 0), 'Bairro das Artes');
  assert.equal(getMetropolisDistrictName(0, 400), null);
});
