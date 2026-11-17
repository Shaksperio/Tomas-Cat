/**
 * Catálogo de módulos de construção pré-aprovados pelo motor.
 * A IA / Cowila / engenheiros só podem referenciar estes assetIds.
 * Não gera geometria arbitrária.
 */

export type ConstructionAssetId =
  | 'module_shelter_basic'
  | 'module_warehouse'
  | 'module_workshop'
  | 'module_farm_plot'
  | 'module_watchtower'
  | 'module_market_stall'
  | 'module_bridge_segment'
  | 'module_road_segment';

export interface ConstructionModuleDef {
  assetId: ConstructionAssetId;
  displayName: string;
  /** Meia-largura aproximada no eixo X (m) para colisão futura. */
  footprintX: number;
  footprintZ: number;
  height: number;
  /** Recursos de referência (não cobrados aqui; o scheduler consome). */
  suggestedCost: Readonly<Record<string, number>>;
}

export const CONSTRUCTION_MODULE_CATALOG: readonly ConstructionModuleDef[] = [
  {
    assetId: 'module_shelter_basic',
    displayName: 'Abrigo comunitário',
    footprintX: 2.4,
    footprintZ: 2.2,
    height: 2.4,
    suggestedCost: { wood: 4, stone: 2 },
  },
  {
    assetId: 'module_warehouse',
    displayName: 'Armazém',
    footprintX: 3.2,
    footprintZ: 2.8,
    height: 2.6,
    suggestedCost: { wood: 6, stone: 4, planks: 2 },
  },
  {
    assetId: 'module_workshop',
    displayName: 'Oficina',
    footprintX: 2.8,
    footprintZ: 2.4,
    height: 2.5,
    suggestedCost: { wood: 5, stone: 2, planks: 3 },
  },
  {
    assetId: 'module_farm_plot',
    displayName: 'Canteiro agrícola',
    footprintX: 3.0,
    footprintZ: 3.0,
    height: 0.6,
    suggestedCost: { wood: 2 },
  },
  {
    assetId: 'module_watchtower',
    displayName: 'Torre de observação',
    footprintX: 1.6,
    footprintZ: 1.6,
    height: 4.2,
    suggestedCost: { wood: 8, stone: 3 },
  },
  {
    assetId: 'module_market_stall',
    displayName: 'Barraca de mercado',
    footprintX: 2.0,
    footprintZ: 1.8,
    height: 2.0,
    suggestedCost: { wood: 3, planks: 2 },
  },
  {
    assetId: 'module_bridge_segment',
    displayName: 'Segmento de ponte',
    footprintX: 4.0,
    footprintZ: 1.6,
    height: 1.2,
    suggestedCost: { wood: 6, planks: 4, stone: 2 },
  },
  {
    assetId: 'module_road_segment',
    displayName: 'Trecho de estrada',
    footprintX: 4.0,
    footprintZ: 2.0,
    height: 0.15,
    suggestedCost: { stone: 3 },
  },
];

export const APPROVED_CONSTRUCTION_ASSET_IDS: ReadonlySet<string> = new Set(
  CONSTRUCTION_MODULE_CATALOG.map((m) => m.assetId),
);

export function getModuleDef(assetId: string): ConstructionModuleDef | undefined {
  return CONSTRUCTION_MODULE_CATALOG.find((m) => m.assetId === assetId);
}

export function isApprovedConstructionAsset(assetId: string): boolean {
  return APPROVED_CONSTRUCTION_ASSET_IDS.has(assetId);
}

/** Escolha determinística de módulo a partir de um id de tarefa (quando o task não carrega assetId). */
export function pickModuleAssetIdFromTaskId(taskId: string): ConstructionAssetId {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    hash = (Math.imul(hash, 31) + taskId.charCodeAt(i)) | 0;
  }
  const list = CONSTRUCTION_MODULE_CATALOG;
  const index = Math.abs(hash) % list.length;
  return list[index].assetId;
}
