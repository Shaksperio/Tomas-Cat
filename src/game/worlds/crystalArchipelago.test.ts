import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildCrystalArchipelago } from './crystalArchipelago';

test('Arquipélago constrói cenário 3D original com cinco ilhas e santuário', () => {
  const root = new THREE.Group();
  const world = buildCrystalArchipelago(root);
  assert.equal(root.children.filter((child) => child.name.startsWith('island-base:')).length, 5);
  assert.equal(root.children.filter((child) => child.name === 'ancient-stone-bridge').length, 4);
  assert.ok(root.getObjectByName('tide-observatory'));
  assert.ok(root.getObjectByName('crystal-ocean'));
  assert.ok(world.skyDome.parent === root);
  assert.ok(world.waterMeshes.length > 0);
  assert.ok(world.neonMaterials.length >= 2);
});

test('colisões do arquipélago têm limites válidos e setores são determinísticos', () => {
  const root = new THREE.Group();
  const world = buildCrystalArchipelago(root);
  assert.ok(world.colliders.length >= 8);
  for (const collider of world.colliders) {
    assert.ok(collider.minX < collider.maxX);
    assert.ok(collider.minZ < collider.maxZ);
    assert.ok(collider.topY >= (collider.minY ?? 0));
  }
  assert.equal(world.getSectorName(0, 18), 'Santuário das Correntes');
  assert.equal(world.getSectorName(-70, -20), 'Jardins de Ametista');
  assert.equal(world.getSectorName(0, 90), 'Ilha do Observatório');
});
