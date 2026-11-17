import { EQUIPMENT_SLOTS, ITEM_CATALOG, isEquipmentItemId, type EquipmentItemId, type EquipmentSlot } from './itemCatalog';

export type EquipmentState = Record<EquipmentSlot, EquipmentItemId | null>;
export interface EquipmentBonuses { maxHealth: number; maxStamina: number; attackPercent: number; sonarRadius: number; }

export function createEquipmentState(): EquipmentState {
  return { collar: null, harness: null, weapon: null, armor: null, clothing: null, gadget: null };
}

/** Aceita saves antigos (só coleira/arreio) e descarta IDs inválidos ou no slot errado. */
export function normalizeEquipment(value: unknown): EquipmentState {
  const state = createEquipmentState();
  if (!value || typeof value !== 'object') return state;
  const candidate = value as Record<string, unknown>;
  for (const slot of EQUIPMENT_SLOTS) {
    const id = candidate[slot];
    if (isEquipmentItemId(id) && equipmentSlot(id) === slot) state[slot] = id;
  }
  return state;
}

export function equipmentSlot(itemId: EquipmentItemId): EquipmentSlot {
  const definition = ITEM_CATALOG[itemId];
  return definition.category === 'equipment' ? definition.slot : 'collar';
}

export function getEquipmentBonuses(equipment: EquipmentState): EquipmentBonuses {
  const bonuses: EquipmentBonuses = { maxHealth: 0, maxStamina: 0, attackPercent: 0, sonarRadius: 0 };
  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = equipment[slot];
    if (!itemId) continue;
    const definition = ITEM_CATALOG[itemId];
    if (definition.category !== 'equipment') continue;
    bonuses.maxHealth += definition.bonuses.maxHealth ?? 0;
    bonuses.maxStamina += definition.bonuses.maxStamina ?? 0;
    bonuses.attackPercent += definition.bonuses.attackPercent ?? 0;
    bonuses.sonarRadius += definition.bonuses.sonarRadius ?? 0;
  }
  return bonuses;
}
