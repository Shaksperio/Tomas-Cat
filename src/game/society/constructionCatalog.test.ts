import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVED_CONSTRUCTION_ASSET_IDS,
  CONSTRUCTION_MODULE_CATALOG,
  getModuleDef,
  isApprovedConstructionAsset,
} from './constructionCatalog.ts';

test('catálogo tem ids únicos e nomes em português', () => {
  const ids = CONSTRUCTION_MODULE_CATALOG.map((m) => m.assetId);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of CONSTRUCTION_MODULE_CATALOG) {
    assert.ok(m.displayName.trim().length > 2);
    assert.ok(m.footprintX > 0 && m.footprintZ > 0);
  }
});

test('isApprovedConstructionAsset rejeita ids inventados', () => {
  assert.equal(isApprovedConstructionAsset('module_shelter_basic'), true);
  assert.equal(isApprovedConstructionAsset('module_alien_spaceship'), false);
  assert.ok(APPROVED_CONSTRUCTION_ASSET_IDS.has('module_watchtower'));
});

test('cada estrutura precisa ser selecionada por assetId aprovado do projeto', () => {
  for (const module of CONSTRUCTION_MODULE_CATALOG) {
    assert.ok(isApprovedConstructionAsset(module.assetId));
    assert.equal(getModuleDef(module.assetId)?.assetId, module.assetId);
  }
  assert.equal(getModuleDef('task-worker-42'), undefined);
});

test('getModuleDef retorna def ou undefined', () => {
  assert.equal(getModuleDef('module_warehouse')?.displayName, 'Armazém');
  assert.equal(getModuleDef('nope'), undefined);
});
