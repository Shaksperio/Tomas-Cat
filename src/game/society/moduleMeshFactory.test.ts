import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONSTRUCTION_MODULE_CATALOG, isApprovedConstructionAsset } from './constructionCatalog.ts';
import { createModuleMesh } from './moduleMeshFactory.ts';

test('fábrica cria mesh para cada assetId aprovado sem trocar o modelo', () => {
  for (const definition of CONSTRUCTION_MODULE_CATALOG) {
    const group = createModuleMesh(definition.assetId);
    assert.equal(group.userData.assetId, definition.assetId);
    assert.ok(group.children.length > 0, `${definition.assetId} deve conter geometria`);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }
});

test('ids fora do catálogo não são considerados aprovados', () => {
  assert.equal(isApprovedConstructionAsset('module_unknown'), false);
});
