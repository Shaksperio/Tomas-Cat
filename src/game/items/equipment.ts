import { ITEM_CATALOG, type EquipmentItemId, type EquipmentSlot } from './itemCatalog';

export interface EquipmentState {
  collar: EquipmentItemId | null;
  harness: EquipmentItemId | null;
}
export interface EquipmentBonuses { maxHealth: number; maxStamina: number; }

export function createEquipmentState(): EquipmentState {
  return { collar: null, harness: null };
}

export function normalizeEquipment(value: unknown): EquipmentState {
  if (!value || typeof value !== 'object') return createEquipmentState();
  const candidate = value as Record<string, unknown>;
  return {
    collar: candidate.collar === 'reinforced_collar' ? 'reinforced_collar' : null,
    harness: candidate.harness === 'scavenger_harness' ? 'scavenger_harness' : null,
  };
}

export function equipmentSlot(itemId: EquipmentItemId): EquipmentSlot {
  const definition = ITEM_CATALOG[itemId];
  return definition.category === 'equipment' ? definition.slot : 'collar';
}

export function getEquipmentBonuses(equipment: EquipmentState): EquipmentBonuses {
  const bonuses: EquipmentBonuses = { maxHealth: 0, maxStamina: 0 };
  for (const itemId of [equipment.collar, equipment.harness]) {
    if (!itemId) continue;
    const definition = ITEM_CATALOG[itemId];
    if (definition.category !== 'equipment') continue;
    bonuses.maxHealth += definition.bonuses.maxHealth ?? 0;
    bonuses.maxStamina += definition.bonuses.maxStamina ?? 0;
  }
  return bonuses;
}
