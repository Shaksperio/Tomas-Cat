import { ITEM_CATALOG, type InventoryItemId } from '../items/itemCatalog';

export interface ShopStockEntry {
  itemId: InventoryItemId;
  /** Preço em moedas. */
  price: number;
  /** Nível mínimo de Tomas para comprar. */
  levelRequired?: number;
}

export interface ShopDefinition {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Horário de funcionamento em horas (0–24); abertura > fechamento atravessa a meia-noite. */
  openHour: number;
  closeHour: number;
  accent: number;
  stock: readonly ShopStockEntry[];
}

export const SHOPS: readonly ShopDefinition[] = [
  {
    id: 'emporio', name: 'Empório da Esquina', x: 8, z: 10, openHour: 6, closeHour: 22, accent: 0xf59e0b,
    stock: [
      { itemId: 'medicinal_herb', price: 8 }, { itemId: 'clean_water', price: 5 }, { itemId: 'energy_berry', price: 7 },
      { itemId: 'vitality_potion', price: 24 }, { itemId: 'mana_potion', price: 20 },
    ],
  },
  {
    id: 'oficina', name: 'Oficina de Aparatos', x: -60, z: 30, openHour: 7, closeHour: 19, accent: 0x38bdf8,
    stock: [
      { itemId: 'reinforced_collar', price: 45 }, { itemId: 'scavenger_harness', price: 55 },
      { itemId: 'sonar_whisker', price: 70, levelRequired: 8 },
    ],
  },
  {
    id: 'forja', name: 'Forja do Sucateiro', x: 100, z: -60, openHour: 8, closeHour: 20, accent: 0xef4444,
    stock: [
      { itemId: 'iron_claw_caps', price: 60 }, { itemId: 'tempered_claws', price: 180, levelRequired: 15 },
      { itemId: 'plated_vest', price: 90, levelRequired: 5 },
    ],
  },
  {
    id: 'telhados', name: 'Mercado dos Telhados', x: 150, z: 40, openHour: 6, closeHour: 21, accent: 0xa78bfa,
    stock: [
      { itemId: 'vitality_potion', price: 26 }, { itemId: 'mana_potion', price: 22 },
      { itemId: 'wool_scarf', price: 40 }, { itemId: 'medicinal_herb', price: 9 },
    ],
  },
  {
    id: 'posto-sul', name: 'Posto do Sul', x: 20, z: 140, openHour: 6, closeHour: 20, accent: 0x22c55e,
    stock: [
      { itemId: 'clean_water', price: 5 }, { itemId: 'energy_berry', price: 7 },
      { itemId: 'plated_vest', price: 95, levelRequired: 5 }, { itemId: 'iron_claw_caps', price: 64 },
    ],
  },
  {
    id: 'meia-noite', name: 'Barraca da Meia-Noite', x: -120, z: -80, openHour: 20, closeHour: 5, accent: 0xc084fc,
    stock: [
      { itemId: 'mana_potion', price: 16 }, { itemId: 'vitality_potion', price: 20 },
      { itemId: 'wool_scarf', price: 35 }, { itemId: 'sonar_whisker', price: 62, levelRequired: 8 },
    ],
  },
];

export function getShop(shopId: string): ShopDefinition | undefined {
  return SHOPS.find((shop) => shop.id === shopId);
}

export function isShopOpen(shop: ShopDefinition, timeOfDay: number): boolean {
  const t = ((timeOfDay % 1) + 1) % 1;
  const hour = t * 24;
  return shop.openHour <= shop.closeHour
    ? hour >= shop.openHour && hour < shop.closeHour
    : hour >= shop.openHour || hour < shop.closeHour;
}

export function shopItemIds(): InventoryItemId[] {
  return Array.from(new Set(SHOPS.flatMap((shop) => shop.stock.map((entry) => entry.itemId))));
}

export function describeStock(entry: ShopStockEntry) {
  return { ...entry, name: ITEM_CATALOG[entry.itemId].name, description: ITEM_CATALOG[entry.itemId].description };
}
