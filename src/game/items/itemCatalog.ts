export type InventoryItemId = 'medicinal_herb' | 'clean_water' | 'energy_berry';

export type InventoryItemEffect =
  | { kind: 'health'; amount: number }
  | { kind: 'hunger'; amount: number }
  | { kind: 'thirst'; amount: number }
  | { kind: 'stamina'; amount: number };

export interface InventoryItemDefinition {
  id: InventoryItemId;
  name: string;
  description: string;
  category: 'consumable';
  effect: InventoryItemEffect;
  stackLimit: number;
}

export const ITEM_CATALOG: Readonly<Record<InventoryItemId, InventoryItemDefinition>> = {
  medicinal_herb: {
    id: 'medicinal_herb',
    name: 'Erva medicinal',
    description: 'Recupera 30 pontos de saúde.',
    category: 'consumable',
    effect: { kind: 'health', amount: 30 },
    stackLimit: 20,
  },
  clean_water: {
    id: 'clean_water',
    name: 'Frasco de água limpa',
    description: 'Recupera 35 pontos de sede.',
    category: 'consumable',
    effect: { kind: 'thirst', amount: 35 },
    stackLimit: 20,
  },
  energy_berry: {
    id: 'energy_berry',
    name: 'Fruta energética',
    description: 'Recupera 40 pontos de resistência.',
    category: 'consumable',
    effect: { kind: 'stamina', amount: 40 },
    stackLimit: 20,
  },
};

export function isInventoryItemId(value: unknown): value is InventoryItemId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ITEM_CATALOG, value);
}
