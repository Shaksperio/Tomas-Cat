export type EquipmentSlot = 'collar' | 'harness' | 'weapon' | 'armor' | 'clothing' | 'gadget';
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['collar', 'harness', 'weapon', 'armor', 'clothing', 'gadget'];
export const EQUIPMENT_SLOT_LABELS: Readonly<Record<EquipmentSlot, string>> = {
  collar: 'Coleira', harness: 'Arreio', weapon: 'Arma', armor: 'Armadura', clothing: 'Roupa', gadget: 'Aparato',
};
export type EquipmentItemId =
  | 'reinforced_collar' | 'scavenger_harness'
  | 'iron_claw_caps' | 'tempered_claws'
  | 'plated_vest' | 'wool_scarf' | 'sonar_whisker';
export type ConsumableItemId = 'medicinal_herb' | 'clean_water' | 'energy_berry' | 'mana_potion' | 'vitality_potion';
export type InventoryItemId = ConsumableItemId | EquipmentItemId;

export type InventoryItemEffect =
  | { kind: 'health'; amount: number }
  | { kind: 'hunger'; amount: number }
  | { kind: 'thirst'; amount: number }
  | { kind: 'stamina'; amount: number }
  | { kind: 'mana'; amount: number };

export interface EquipmentBonusValues {
  maxHealth?: number;
  maxStamina?: number;
  /** Aumento percentual do dano de Tomas (ex.: 8 = +8%). */
  attackPercent?: number;
  /** Alcance extra do sonar, em metros. */
  sonarRadius?: number;
}

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
  bonuses: EquipmentBonusValues;
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
  mana_potion: {
    id: 'mana_potion', name: 'Poção de mana', description: 'Recupera 40 pontos de mana para as técnicas de batalha.',
    category: 'consumable', effect: { kind: 'mana', amount: 40 }, stackLimit: 20,
  },
  vitality_potion: {
    id: 'vitality_potion', name: 'Poção de vitalidade', description: 'Recupera 60 pontos de saúde.',
    category: 'consumable', effect: { kind: 'health', amount: 60 }, stackLimit: 20,
  },
  reinforced_collar: {
    id: 'reinforced_collar', name: 'Coleira reforçada', description: 'Equipamento: aumenta a saúde máxima em 15 pontos.',
    category: 'equipment', slot: 'collar', bonuses: { maxHealth: 15 }, stackLimit: 1,
  },
  scavenger_harness: {
    id: 'scavenger_harness', name: 'Arreio de explorador', description: 'Equipamento: aumenta a resistência máxima em 20 pontos.',
    category: 'equipment', slot: 'harness', bonuses: { maxStamina: 20 }, stackLimit: 1,
  },
  iron_claw_caps: {
    id: 'iron_claw_caps', name: 'Ponteiras de garra', description: 'Arma: +8% de dano.',
    category: 'equipment', slot: 'weapon', bonuses: { attackPercent: 8 }, stackLimit: 1,
  },
  tempered_claws: {
    id: 'tempered_claws', name: 'Garras temperadas', description: 'Arma: +18% de dano.',
    category: 'equipment', slot: 'weapon', bonuses: { attackPercent: 18 }, stackLimit: 1,
  },
  plated_vest: {
    id: 'plated_vest', name: 'Colete de placas', description: 'Armadura: +30 de saúde máxima.',
    category: 'equipment', slot: 'armor', bonuses: { maxHealth: 30 }, stackLimit: 1,
  },
  wool_scarf: {
    id: 'wool_scarf', name: 'Cachecol de lã', description: 'Roupa: +8 de saúde máxima e +10 de resistência máxima.',
    category: 'equipment', slot: 'clothing', bonuses: { maxHealth: 8, maxStamina: 10 }, stackLimit: 1,
  },
  sonar_whisker: {
    id: 'sonar_whisker', name: 'Bigode sonar', description: 'Aparato: +8 m de alcance do sonar.',
    category: 'equipment', slot: 'gadget', bonuses: { sonarRadius: 8 }, stackLimit: 1,
  },
};

export function isInventoryItemId(value: unknown): value is InventoryItemId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ITEM_CATALOG, value);
}

export function isEquipmentItemId(value: unknown): value is EquipmentItemId {
  return isInventoryItemId(value) && ITEM_CATALOG[value].category === 'equipment';
}
