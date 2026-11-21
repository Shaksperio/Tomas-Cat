/**
 * Núcleo determinístico de planejamento urbano.
 *
 * Regras simplificadas do universo do jogo; não substituem normas técnicas reais.
 * Este módulo é puro: não cria obras, não altera o mundo e não depende de IA.
 */

export type LandUse =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'institutional'
  | 'mixed'
  | 'green'
  | 'protected';

export interface UrbanLot {
  id: string;
  sectorId: string;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  zone: LandUse;
  available: boolean;
  protectedArea: boolean;
  roadAccess: boolean;
  slopePercent: number;
  soilBearingKpa: number;
  infrastructure: ReadonlyArray<'water' | 'power' | 'sewage' | 'drainage'>;
}

export interface UrbanRegulation {
  allowedUses: ReadonlyArray<LandUse>;
  frontSetback: number;
  sideSetback: number;
  rearSetback: number;
  maxHeight: number;
  maxFloors: number;
  maxLotCoverage: number;
  maxFloorAreaRatio: number;
  maxSlopePercent: number;
  minSoilBearingKpa: number;
  requiredInfrastructure: ReadonlyArray<'water' | 'power' | 'sewage' | 'drainage'>;
}

export interface BuildingProposal {
  id: string;
  lotId: string;
  use: LandUse;
  /** Distância da implantação às bordas do lote, em metros simulados. */
  frontOffset: number;
  leftOffset: number;
  rightOffset: number;
  rearOffset: number;
  width: number;
  depth: number;
  height: number;
  floors: number;
  floorArea: number;
}

export type UrbanValidationCode =
  | 'LOT_UNAVAILABLE'
  | 'PROTECTED_LAND'
  | 'ZONE_USE_MISMATCH'
  | 'NO_ROAD_ACCESS'
  | 'INVALID_LOT_GEOMETRY'
  | 'INVALID_PROPOSAL_GEOMETRY'
  | 'SETBACK_VIOLATION'
  | 'HEIGHT_LIMIT'
  | 'FLOOR_LIMIT'
  | 'LOT_COVERAGE_LIMIT'
  | 'FLOOR_AREA_RATIO_LIMIT'
  | 'SLOPE_LIMIT'
  | 'SOIL_CAPACITY'
  | 'MISSING_INFRASTRUCTURE'
  | 'INVALID_REGULATION';

export interface UrbanValidationIssue {
  code: UrbanValidationCode;
  message: string;
}

export interface UrbanValidationResult {
  valid: boolean;
  lotArea: number;
  buildableWidth: number;
  buildableDepth: number;
  lotCoverage: number;
  floorAreaRatio: number;
  issues: UrbanValidationIssue[];
}

const finiteNonNegative = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

export function validateUrbanProposal(
  lot: UrbanLot,
  proposal: BuildingProposal,
  regulation: UrbanRegulation,
): UrbanValidationResult {
  const issues: UrbanValidationIssue[] = [];
  const add = (code: UrbanValidationCode, message: string) => issues.push({ code, message });

  const lotWidth = lot.maxX - lot.minX;
  const lotDepth = lot.maxZ - lot.minZ;
  const lotArea = lotWidth * lotDepth;
  const buildableWidth = lotWidth - regulation.sideSetback * 2;
  const buildableDepth = lotDepth - regulation.frontSetback - regulation.rearSetback;

  const regulationNumbers = [
    regulation.frontSetback, regulation.sideSetback, regulation.rearSetback,
    regulation.maxHeight, regulation.maxFloors, regulation.maxLotCoverage,
    regulation.maxFloorAreaRatio, regulation.maxSlopePercent, regulation.minSoilBearingKpa,
  ];
  if (regulationNumbers.some((n) => !finiteNonNegative(n))
    || regulation.maxLotCoverage > 1
    || !Number.isInteger(regulation.maxFloors)
    || regulation.maxFloors < 1) {
    add('INVALID_REGULATION', 'Urban regulation contains invalid limits.');
  }

  if (![lot.minX, lot.minZ, lot.maxX, lot.maxZ].every(Number.isFinite)
    || lotWidth <= 0 || lotDepth <= 0) {
    add('INVALID_LOT_GEOMETRY', 'Lot boundaries must define a positive finite area.');
  }
  if (!lot.available) add('LOT_UNAVAILABLE', 'Lot is not available for development.');
  if (lot.protectedArea || lot.zone === 'protected' || lot.zone === 'green') {
    add('PROTECTED_LAND', 'Protected or green land cannot receive this building proposal.');
  }
  if (!regulation.allowedUses.includes(proposal.use)) {
    add('ZONE_USE_MISMATCH', 'The proposed use is not permitted by this zone regulation.');
  }
  if (!lot.roadAccess) add('NO_ROAD_ACCESS', 'The lot has no validated road access.');

  const proposalNumbers = [
    proposal.frontOffset, proposal.leftOffset, proposal.rightOffset, proposal.rearOffset,
    proposal.width, proposal.depth, proposal.height, proposal.floors, proposal.floorArea,
  ];
  if (proposalNumbers.some((n) => !finiteNonNegative(n))
    || proposal.width <= 0 || proposal.depth <= 0 || proposal.height <= 0
    || !Number.isInteger(proposal.floors) || proposal.floors < 1
    || proposal.floorArea <= 0) {
    add('INVALID_PROPOSAL_GEOMETRY', 'Building dimensions, floors and floor area must be positive and finite.');
  } else {
    if (proposal.frontOffset < regulation.frontSetback
      || proposal.rearOffset < regulation.rearSetback
      || proposal.leftOffset < regulation.sideSetback
      || proposal.rightOffset < regulation.sideSetback
      || proposal.frontOffset + proposal.rearOffset + proposal.depth > lotDepth
      || proposal.leftOffset + proposal.rightOffset + proposal.width > lotWidth) {
      add('SETBACK_VIOLATION', 'Building footprint violates lot boundaries or required setbacks.');
    }
  }

  const footprint = proposal.width * proposal.depth;
  const lotCoverage = lotArea > 0 ? footprint / lotArea : 0;
  const floorAreaRatio = lotArea > 0 ? proposal.floorArea / lotArea : 0;
  if (proposal.height > regulation.maxHeight) add('HEIGHT_LIMIT', 'Building exceeds the permitted height.');
  if (proposal.floors > regulation.maxFloors) add('FLOOR_LIMIT', 'Building exceeds the permitted floor count.');
  if (lotCoverage > regulation.maxLotCoverage) add('LOT_COVERAGE_LIMIT', 'Building footprint exceeds permitted lot coverage.');
  if (floorAreaRatio > regulation.maxFloorAreaRatio) add('FLOOR_AREA_RATIO_LIMIT', 'Total floor area exceeds the permitted floor-area ratio.');

  if (!Number.isFinite(lot.slopePercent) || lot.slopePercent < 0
    || lot.slopePercent > regulation.maxSlopePercent) {
    add('SLOPE_LIMIT', 'Terrain slope exceeds the permitted limit or is invalid.');
  }
  if (!Number.isFinite(lot.soilBearingKpa) || lot.soilBearingKpa < regulation.minSoilBearingKpa) {
    add('SOIL_CAPACITY', 'Soil bearing capacity is insufficient or unavailable.');
  }
  const missing = regulation.requiredInfrastructure.filter((item) => !lot.infrastructure.includes(item));
  if (missing.length) add('MISSING_INFRASTRUCTURE', `Missing required infrastructure: ${missing.join(', ')}.`);

  return { valid: issues.length === 0, lotArea, buildableWidth, buildableDepth, lotCoverage, floorAreaRatio, issues };
}
