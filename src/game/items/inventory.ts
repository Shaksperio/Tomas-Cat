import { ITEM_CATALOG, isInventoryItemId, type InventoryItemId } from './itemCatalog';

export interface InventoryEntry { itemId: InventoryItemId; quantity: number; }
export type InventoryState = InventoryEntry[];

export function createInventoryState(): InventoryState { return []; }

export function normalizeInventory(value: unknown): InventoryState {
  if (!Array.isArray(value)) return createInventoryState();
  const totals = new Map<InventoryItemId, number>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as { itemId?: unknown; quantity?: unknown };
    if (!isInventoryItemId(candidate.itemId) || typeof candidate.quantity !== 'number' || !Number.isFinite(candidate.quantity)) continue;
    const quantity = Math.max(0, Math.floor(candidate.quantity));
    if (quantity === 0) continue;
    const limit = ITEM_CATALOG[candidate.itemId].stackLimit;
    totals.set(candidate.itemId, Math.min(limit, (totals.get(candidate.itemId) ?? 0) + quantity));
  }
  return Array.from(totals, ([itemId, quantity]) => ({ itemId, quantity }));
}

export function inventoryCount(inventory: InventoryState, itemId: InventoryItemId): number {
  return inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
}

export function addInventoryItem(inventory: InventoryState, itemId: InventoryItemId, amount = 1): InventoryState {
  if (!Number.isFinite(amount) || amount <= 0) return inventory.map((entry) => ({ ...entry }));
  const next = inventory.map((entry) => ({ ...entry }));
  const current = next.find((entry) => entry.itemId === itemId);
  if (current) current.quantity = Math.min(ITEM_CATALOG[itemId].stackLimit, current.quantity + Math.floor(amount));
  else next.push({ itemId, quantity: Math.min(ITEM_CATALOG[itemId].stackLimit, Math.floor(amount)) });
  return next.filter((entry) => entry.quantity > 0);
}

export function consumeInventoryItem(inventory: InventoryState, itemId: InventoryItemId): InventoryState | null {
  const current = inventoryCount(inventory, itemId);
  if (current <= 0) return null;
  return inventory
    .map((entry) => entry.itemId === itemId ? { ...entry, quantity: entry.quantity - 1 } : { ...entry })
    .filter((entry) => entry.quantity > 0);
}
