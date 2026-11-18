import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SocietyActors } from './SocietyActors.ts';
import type { ReadyConstructionPlacement } from './worldConstructionRuntime';

test('SocietyActors publica o módulo aprovado e impede duplicação', () => {
  const scene = new THREE.Scene();
  const actors = new SocietyActors(scene);
  const placement: ReadyConstructionPlacement = {
    projectId: 'project-workshop',
    placementIndex: 0,
    assetId: 'module_workshop',
    sectorId: 'suburb-01',
    x: 14,
    z: -8,
    rotationY: Math.PI / 2,
  };

  assert.equal(actors.applyReadyPlacements([placement]), 1);
  assert.equal(actors.applyReadyPlacements([placement]), 0);
  const structure = scene.children.find((child) => child.userData.assetId === 'module_workshop');
  assert.ok(structure);
  assert.equal(structure.position.x, 14);
  assert.equal(structure.position.z, -8);
  assert.equal(structure.rotation.y, Math.PI / 2);
  actors.dispose();
});

test('SocietyActors rejeita assetId não aprovado', () => {
  const scene = new THREE.Scene();
  const actors = new SocietyActors(scene);
  const placement: ReadyConstructionPlacement = {
    projectId: 'project-invalid',
    placementIndex: 0,
    assetId: 'module_unknown',
    sectorId: 'suburb-01',
    x: 0,
    z: 0,
    rotationY: 0,
  };

  assert.equal(actors.applyReadyPlacements([placement]), 0);
  assert.equal(scene.children.length, 0);
  actors.dispose();
});
