import assert from 'node:assert/strict';
import test from 'node:test';
import { createEquipmentState } from '../items/equipment';
import { createInventoryState, inventoryCount } from '../items/inventory';
import { ITEM_WORLD_SPAWNS } from '../items/worldSpawns';
import { isInventoryItemId } from '../items/itemCatalog';
import { SHOPS, isShopOpen, shopItemIds } from './catalog';
import { purchaseItem } from './purchase';

const base = { coins: 100, level: 1, timeOfDay: 0.5, inventory: createInventoryState(), equipment: createEquipmentState() };

test('todo item vendido também existe de graça no cenário', () => {
  const free = new Set(ITEM_WORLD_SPAWNS.map((spawn) => spawn.itemId));
  for (const itemId of shopItemIds()) assert.ok(free.has(itemId), `${itemId} não tem fonte gratuita`);
});

test('lojas e estoques usam apenas IDs do catálogo único, sem duplicar loja', () => {
  assert.equal(new Set(SHOPS.map((s) => s.id)).size, SHOPS.length);
  for (const shop of SHOPS) for (const entry of shop.stock) { assert.ok(isInventoryItemId(entry.itemId)); assert.ok(entry.price > 0); }
});

test('horário de funcionamento, inclusive atravessando a meia-noite', () => {
  const night = SHOPS.find((s) => s.id === 'meia-noite')!;
  assert.equal(isShopOpen(night, 22 / 24), true);
  assert.equal(isShopOpen(night, 3 / 24), true);
  assert.equal(isShopOpen(night, 12 / 24), false);
});

test('compra válida desconta moedas e guarda o item', () => {
  const r = purchaseItem({ ...base, shopId: 'emporio', itemId: 'vitality_potion' });
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.coins, 76); assert.equal(inventoryCount(r.inventory, 'vitality_potion'), 1); }
});

test('recusa loja fechada, nível baixo, sem moedas e item que a loja não vende', () => {
  const reason = (o: Partial<typeof base> & { shopId: string; itemId: any }) => { const r = purchaseItem({ ...base, ...o }); return r.ok ? 'ok' : r.reason; };
  assert.equal(reason({ shopId: 'meia-noite', itemId: 'mana_potion' }), 'closed');
  assert.equal(reason({ shopId: 'forja', itemId: 'tempered_claws', coins: 999 }), 'level_too_low');
  assert.equal(reason({ shopId: 'emporio', itemId: 'mana_potion', coins: 5 }), 'no_coins');
  assert.equal(reason({ shopId: 'emporio', itemId: 'tempered_claws' }), 'not_sold');
  assert.equal(reason({ shopId: 'x', itemId: 'mana_potion' }), 'unknown_shop');
});

test('equipamento não pode ser comprado duas vezes', () => {
  const equipped = { ...createEquipmentState(), weapon: 'iron_claw_caps' as const };
  const r = purchaseItem({ ...base, shopId: 'forja', itemId: 'iron_claw_caps', equipment: equipped });
  assert.ok(!r.ok && r.reason === 'already_owned');
});

test('consumível no limite da pilha não cobra moedas', () => {
  let inventory = createInventoryState();
  inventory = [{ itemId: 'mana_potion', quantity: 20 }];
  const r = purchaseItem({ ...base, inventory, shopId: 'emporio', itemId: 'mana_potion' });
  assert.ok(!r.ok && r.reason === 'inventory_full');
});
