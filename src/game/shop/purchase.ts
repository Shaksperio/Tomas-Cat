import { addInventoryItem, inventoryCount, type InventoryState } from '../items/inventory';
import { ITEM_CATALOG, type InventoryItemId } from '../items/itemCatalog';
import type { EquipmentState } from '../items/equipment';
import { EQUIPMENT_SLOTS } from '../items/itemCatalog';
import { getShop, isShopOpen } from './catalog';

export type PurchaseFailure = 'unknown_shop' | 'not_sold' | 'closed' | 'level_too_low' | 'no_coins' | 'already_owned' | 'inventory_full';

export interface PurchaseInput {
  shopId: string;
  itemId: InventoryItemId;
  coins: number;
  level: number;
  timeOfDay: number;
  inventory: InventoryState;
  equipment: EquipmentState;
}
export type PurchaseResult =
  | { ok: true; coins: number; inventory: InventoryState; price: number }
  | { ok: false; reason: PurchaseFailure; message: string };

const MESSAGES: Record<PurchaseFailure, string> = {
  unknown_shop: 'Loja desconhecida.',
  not_sold: 'Esta loja não vende esse item.',
  closed: 'A loja está fechada neste horário.',
  level_too_low: 'Seu nível ainda é baixo para este item.',
  no_coins: 'Moedas insuficientes.',
  already_owned: 'Você já possui este equipamento.',
  inventory_full: 'Mochila cheia para este item.',
};

function fail(reason: PurchaseFailure): PurchaseResult {
  return { ok: false, reason, message: MESSAGES[reason] };
}

/** Compra determinística: valida loja, horário, nível, moedas e espaço antes de alterar qualquer estado. */
export function purchaseItem(input: PurchaseInput): PurchaseResult {
  const shop = getShop(input.shopId);
  if (!shop) return fail('unknown_shop');
  const entry = shop.stock.find((candidate) => candidate.itemId === input.itemId);
  if (!entry) return fail('not_sold');
  if (!isShopOpen(shop, input.timeOfDay)) return fail('closed');
  if (input.level < (entry.levelRequired ?? 0)) return fail('level_too_low');
  const definition = ITEM_CATALOG[input.itemId];
  if (definition.category === 'equipment') {
    const owned = inventoryCount(input.inventory, input.itemId) > 0 || EQUIPMENT_SLOTS.some((slot) => input.equipment[slot] === input.itemId);
    if (owned) return fail('already_owned');
  }
  if (!Number.isFinite(input.coins) || input.coins < entry.price) return fail('no_coins');
  const next = addInventoryItem(input.inventory, input.itemId, 1);
  if (inventoryCount(next, input.itemId) <= inventoryCount(input.inventory, input.itemId)) return fail('inventory_full');
  return { ok: true, coins: input.coins - entry.price, inventory: next, price: entry.price };
}
