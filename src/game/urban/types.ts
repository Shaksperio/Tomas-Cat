/**
 * Contratos do núcleo "Matrix Real Estate & Urban Engineering".
 * Tudo aqui é dado puro e determinístico: nenhuma IA gera geometria; ela só
 * propõe projetos que o motor de urbanismo aprova ou rejeita antes da obra.
 *
 * Convenção de eixos: o norte é -z; o sol de inverno vem do sul e projeta
 * sombra para o norte (ver `SHADOW_RATIO` em `urbanPlanning.ts`).
 */

export type ZoneKind = 'residential' | 'commercial' | 'industrial' | 'institutional' | 'green';
export type BuildingUse = 'residential' | 'commercial' | 'industrial' | 'institutional';
export type SoilKind = 'rock' | 'firm' | 'soft' | 'wet';
export type LotStatus = 'free' | 'under_construction' | 'built';
export type Frontage = 'north' | 'south' | 'east' | 'west';

export interface Rect { x: number; z: number; width: number; depth: number }

/** Lote alinhado aos eixos; (x, z) é o centro. */
export interface Lot extends Rect {
  id: string;
  worldId: string;
  sectorId: string;
  zone: ZoneKind;
  /** Lado do lote voltado para a rua (recuo frontal). */
  frontage: Frontage;
  /** Inclinação do terreno, 0 (plano) a 1. */
  slope: number;
  soil: SoilKind;
  ownerId: string | null;
  status: LotStatus;
  /** Área protegida (preservação): nenhuma construção. */
  protectedArea?: boolean;
}

export interface RoadSegment { id: string; ax: number; az: number; bx: number; bz: number; width: number }

export type UtilityKind = 'water' | 'power' | 'sewage';
export interface UtilityNode { id: string; kind: UtilityKind; x: number; z: number }

export interface ExistingBuilding extends Rect {
  id: string;
  lotId: string;
  use: BuildingUse;
  height: number;
  units: number;
  /** Fachada que depende de insolação (moradias). */
  needsSun?: boolean;
  /** Corredor de vista protegido: construções mais altas que `maxHeight` não podem invadi-lo. */
  protectedView?: Rect & { maxHeight: number };
}

/** Projeto proposto por agentes (arquiteto/engenheiros). O footprint é centrado no lote + offset. */
export interface ProjectProposal {
  id: string;
  lotId: string;
  developerId: string;
  use: BuildingUse;
  footprint: { width: number; depth: number };
  offset?: { x: number; z: number };
  floors: number;
  height: number;
  units: number;
}

export type ViolationCode =
  | 'INVALID_PROPOSAL' | 'LOT_UNKNOWN' | 'LOT_UNAVAILABLE' | 'NOT_OWNER' | 'PROTECTED_AREA'
  | 'ZONE_USE' | 'SLOPE' | 'SOIL' | 'OUTSIDE_ENVELOPE' | 'COVERAGE' | 'HEIGHT' | 'SPACING'
  | 'ROAD_OVERLAP' | 'ROAD_ACCESS' | 'SUNLIGHT' | 'VIEW' | 'UTILITIES' | 'DENSITY';

export interface Violation { code: ViolationCode; message: string }

export interface PlanningDecision {
  approved: boolean;
  violations: Violation[];
}

export interface UrbanContext {
  lots: ReadonlyMap<string, Lot>;
  buildings: readonly ExistingBuilding[];
  roads: readonly RoadSegment[];
  utilities: readonly UtilityNode[];
  /** Unidades já existentes + em obra por setor (densidade). */
  sectorUnits: ReadonlyMap<string, number>;
}
