import assert from 'node:assert/strict';
import test from 'node:test';
import { addInventoryItem, consumeInventoryItem, createInventoryState, inventoryCount, normalizeInventory } from './inventory';

test('adiciona e acumula itens sem ultrapassar o limite da pilha', () => {
  const inventory = addInventoryItem(addInventoryItem(createInventoryState(), 'medicinal_herb', 3), 'medicinal_herb', 30);
  assert.equal(inventoryCount(inventory, 'medicinal_herb'), 20);
});

test('consome somente um item e remove pilha vazia', () => {
  const inventory = addInventoryItem(createInventoryState(), 'clean_water', 1);
  assert.deepEqual(consumeInventoryItem(inventory, 'clean_water'), []);
  assert.equal(consumeInventoryItem(createInventoryState(), 'clean_water'), null);
});

test('normaliza save legado ou corrompido sem aceitar IDs desconhecidos', () => {
  const inventory = normalizeInventory([
    { itemId: 'energy_berry', quantity: 2.8 },
    { itemId: 'energy_berry', quantity: 4 },
    { itemId: 'not-an-item', quantity: 99 },
    { itemId: 'clean_water', quantity: -1 },
  ]);
  assert.deepEqual(inventory, [
    { itemId: 'energy_berry', quantity: 6 },
  ]);
});
