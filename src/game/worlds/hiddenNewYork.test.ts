import assert from 'node:assert/strict';
import testCase from 'node:test';
import * as THREE from 'three';
import { buildHiddenNewYorkDistrict, HIDDEN_NEW_YORK_SANCTUARY } from './hiddenNewYork';

testCase('distrito secreto de Manhattan constrói marcos e colisores sem carregar CityGML', () => {
  const root = new THREE.Group();
  const colliders = buildHiddenNewYorkDistrict(root);
  assert.equal(root.getObjectByName('hidden-nyc-ground') !== undefined, true);
  assert.equal(root.getObjectByName('empire-state-landmark') !== undefined, true);
  assert.equal(root.getObjectByName('brooklyn-bridge-landmark') !== undefined, true);
  assert.equal(root.getObjectByName('hidden-oracle-sanctuary') !== undefined, true);
  assert.ok(colliders.length >= 20);
  assert.deepEqual(HIDDEN_NEW_YORK_SANCTUARY, { x: -45, y: 0, z: -190 });
});
