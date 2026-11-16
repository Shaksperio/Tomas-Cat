export type EquipmentSlot = 'collar' | 'harness';
export type EquipmentItemId = 'reinforced_collar' | 'scavenger_harness';
export type ConsumableItemId = 'medicinal_herb' | 'clean_water' | 'energy_berry';
export type InventoryItemId = ConsumableItemId | EquipmentItemId;

export type InventoryItemEffect =
  | { kind: 'health'; amount: number }
  | { kind: 'hunger'; amount: number }
  | { kind: 'thirst'; amount: number }
  | { kind: 'stamina'; amount: number };

export interface ConsumableItemDefinition {
  id: ConsumableItemId;
  name: string;
  description: string;
  category: 'consumable';
  effect: InventoryItemEffect;
  stackLimit: number;
}
export interface EquipmentItemDefinition {
  id: EquipmentItemId;
  name: string;
  description: string;
  category: 'equipment';
  slot: EquipmentSlot;
  bonuses: { maxHealth?: number; maxStamina?: number };
  stackLimit: number;
}
export type InventoryItemDefinition = ConsumableItemDefinition | EquipmentItemDefinition;

export const ITEM_CATALOG: Readonly<Record<InventoryItemId, InventoryItemDefinition>> = {
  medicinal_herb: {
    id: 'medicinal_herb', name: 'Erva medicinal', description: 'Recupera 30 pontos de saúde.',
    category: 'consumable', effect: { kind: 'health', amount: 30 }, stackLimit: 20,
  },
  clean_water: {
    id: 'clean_water', name: 'Frasco de água limpa', description: 'Recupera 35 pontos de sede.',
    category: 'consumable', effect: { kind: 'thirst', amount: 35 }, stackLimit: 20,
  },
  energy_berry: {
    id: 'energy_berry', name: 'Fruta energética', description: 'Recupera 40 pontos de resistência.',
    category: 'consumable', effect: { kind: 'stamina', amount: 40 }, stackLimit: 20,
  },
  reinforced_collar: {
    id: 'reinforced_collar', name: 'Coleira reforçada', description: 'Equipamento: aumenta a saúde máxima em 15 pontos.',
    category: 'equipment', slot: 'collar', bonuses: { maxHealth: 15 }, stackLimit: 1,
  },
  scavenger_harness: {
    id: 'scavenger_harness', name: 'Arreio de explorador', description: 'Equipamento: aumenta a resistência máxima em 20 pontos.',
    category: 'equipment', slot: 'harness', bonuses: { maxStamina: 20 }, stackLimit: 1,
  },
};

export function isInventoryItemId(value: unknown): value is InventoryItemId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ITEM_CATALOG, value);
}
