import type { InventoryItemId } from './itemCatalog';

export interface ItemWorldSpawn { itemId: InventoryItemId; x: number; z: number; }

/**
 * Fonte única dos itens espalhados GRATUITAMENTE pelo cenário. Toda mercadoria
 * das lojas precisa aparecer aqui (regra do autor: o que se compra também pode
 * ser encontrado explorando). O `worldBuilder` afasta pontos que caiam dentro
 * de colisores.
 */
export const ITEM_WORLD_SPAWNS: readonly ItemWorldSpawn[] = [
  { itemId: 'medicinal_herb', x: -28, z: -10 },
  { itemId: 'medicinal_herb', x: 82, z: -70 },
  { itemId: 'medicinal_herb', x: -132, z: 70 },
  { itemId: 'clean_water', x: 42, z: -102 },
  { itemId: 'clean_water', x: 148, z: 62 },
  { itemId: 'clean_water', x: 24, z: 150 },
  { itemId: 'energy_berry', x: 36, z: -96 },
  { itemId: 'energy_berry', x: -88, z: 132 },
  { itemId: 'energy_berry', x: 176, z: 82 },
  { itemId: 'reinforced_collar', x: 112, z: -38 },
  { itemId: 'scavenger_harness', x: -168, z: 102 },
  { itemId: 'mana_potion', x: -60, z: -120 },
  { itemId: 'mana_potion', x: 130, z: 110 },
  { itemId: 'mana_potion', x: -150, z: -60 },
  { itemId: 'vitality_potion', x: 60, z: 120 },
  { itemId: 'vitality_potion', x: -110, z: -30 },
  { itemId: 'vitality_potion', x: 190, z: -20 },
  { itemId: 'iron_claw_caps', x: -40, z: 90 },
  { itemId: 'tempered_claws', x: 150, z: -130 },
  { itemId: 'plated_vest', x: -190, z: -30 },
  { itemId: 'wool_scarf', x: 30, z: -60 },
  { itemId: 'sonar_whisker', x: 100, z: 150 },
];
