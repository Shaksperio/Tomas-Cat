import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { WorldSceneManager, type WorldSceneDefinition } from './worldSceneManager';
import type { BuiltWorld } from '../worldBuilder';

function emptyWorld(): BuiltWorld {
  return {
    colliders: [],
    indoorZones: [],
    phaseGates: [],
    interactables: [],
    predators: [],
    neonMaterials: [],
    waterMeshes: [],
    waterBodies: [],
    rivers: [],
    skyDome: new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial()),
    getSectorName: () => 'Test',
  };
}

function definition(id: string, builds: string[]): WorldSceneDefinition {
  return {
    id,
    spawn: { x: 0, z: 10 },
    build: (root) => {
      builds.push(id);
      root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
      return emptyWorld();
    },
  };
}

test('constrói cenas sob demanda e mantém somente uma raiz visível', () => {
  const scene = new THREE.Scene();
  const builds: string[] = [];
  const manager = new WorldSceneManager(scene, [definition('city', builds), definition('island', builds)], 'city');
  assert.deepEqual(builds, ['city']);
  assert.equal(manager.activeWorldId, 'city');
  const city = manager.active.root;

  const island = manager.activate('island');
  assert.deepEqual(builds, ['city', 'island']);
  assert.equal(city.visible, false);
  assert.equal(island.root.visible, true);
  assert.deepEqual(island.spawn, { x: 0, z: 10 });

  manager.activate('city');
  assert.equal(manager.active.root, city);
  assert.deepEqual(builds, ['city', 'island']);
  assert.equal(island.root.visible, false);
  manager.dispose();
});

test('rejeita destinos não registrados sem alterar mundo ativo', () => {
  const scene = new THREE.Scene();
  const manager = new WorldSceneManager(scene, [definition('city', [])], 'city');
  assert.throws(() => manager.activate('unknown'), /not registered/);
  assert.equal(manager.activeWorldId, 'city');
  manager.dispose();
});

test('não descarrega a cena ativa e permite reconstruir uma cena descarregada', () => {
  const scene = new THREE.Scene();
  const builds: string[] = [];
  const manager = new WorldSceneManager(scene, [definition('city', builds), definition('island', builds)], 'city');
  const island = manager.activate('island');
  assert.equal(manager.unload('island'), false);
  manager.activate('city');
  assert.equal(manager.unload('island'), true);
  assert.equal(island.root.parent, null);
  manager.activate('island');
  assert.deepEqual(builds, ['city', 'island', 'island']);
  manager.dispose();
});

test('recusa IDs de cena duplicados', () => {
  const scene = new THREE.Scene();
  assert.throws(
    () => new WorldSceneManager(scene, [definition('city', []), definition('city', [])], 'city'),
    /Duplicate world scene/,
  );
});
