import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWorldDefinition,
  isWorldPlayable,
  PLAYABLE_WORLD_IDS,
  WORLD_CATALOG,
  WORLD_IDS,
} from './worldCatalog';

test('catálogo mantém IDs únicos e inclui o mundo legado', () => {
  assert.equal(new Set(WORLD_IDS).size, WORLD_IDS.length);
  assert.ok(WORLD_IDS.includes('quarantine-city'));
  assert.deepEqual(PLAYABLE_WORLD_IDS, ['quarantine-city']);
});

test('Arquipélago de Cristal está registrado sem ser anunciado como jogável', () => {
  const world = getWorldDefinition('crystal-archipelago');
  assert.equal(world?.name, 'Arquipélago de Cristal');
  assert.equal(world?.availability, 'planned');
  assert.equal(isWorldPlayable('crystal-archipelago'), false);
  assert.equal(isWorldPlayable('quarantine-city'), true);
});

test('fases de campanha não fazem parte dos IDs de mundo', () => {
  assert.equal(WORLD_CATALOG.some((world) => world.id === 'phase-1'), false);
});
