import assert from 'node:assert/strict';
import test from 'node:test';
import { validateUrbanProposal, type BuildingProposal, type UrbanLot, type UrbanRegulation } from './urbanPlanning';

const lot: UrbanLot = {
  id: 'lot-01', sectorId: 'sector-a', minX: 0, minZ: 0, maxX: 30, maxZ: 20,
  zone: 'residential', available: true, protectedArea: false, roadAccess: true,
  slopePercent: 4, soilBearingKpa: 180,
  infrastructure: ['water', 'power', 'sewage', 'drainage'],
};
const rules: UrbanRegulation = {
  allowedUses: ['residential', 'mixed'], frontSetback: 3, sideSetback: 2, rearSetback: 3,
  maxHeight: 12, maxFloors: 3, maxLotCoverage: 0.6, maxFloorAreaRatio: 1.5,
  maxSlopePercent: 12, minSoilBearingKpa: 100,
  requiredInfrastructure: ['water', 'power', 'sewage', 'drainage'],
};
const proposal: BuildingProposal = {
  id: 'building-01', lotId: 'lot-01', use: 'residential',
  frontOffset: 3, leftOffset: 2, rightOffset: 2, rearOffset: 3,
  width: 20, depth: 14, height: 9, floors: 3, floorArea: 720,
};

test('accepts a compliant residential proposal', () => {
  const result = validateUrbanProposal(lot, proposal, rules);
  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.lotArea, 600);
});

test('rejects construction on protected land', () => {
  const result = validateUrbanProposal({ ...lot, protectedArea: true }, proposal, rules);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'PROTECTED_LAND'));
});

test('rejects incompatible zoning and missing road access', () => {
  const result = validateUrbanProposal(
    { ...lot, roadAccess: false },
    { ...proposal, use: 'industrial' },
    rules,
  );
  assert.ok(result.issues.some((issue) => issue.code === 'ZONE_USE_MISMATCH'));
  assert.ok(result.issues.some((issue) => issue.code === 'NO_ROAD_ACCESS'));
});

test('rejects setbacks, excessive height and density', () => {
  const result = validateUrbanProposal(
    lot,
    { ...proposal, frontOffset: 0, height: 18, floorArea: 1200 },
    rules,
  );
  assert.ok(result.issues.some((issue) => issue.code === 'SETBACK_VIOLATION'));
  assert.ok(result.issues.some((issue) => issue.code === 'HEIGHT_LIMIT'));
  assert.ok(result.issues.some((issue) => issue.code === 'FLOOR_AREA_RATIO_LIMIT'));
});

test('rejects terrain, soil and infrastructure constraints', () => {
  const result = validateUrbanProposal(
    { ...lot, slopePercent: 25, soilBearingKpa: 50, infrastructure: ['power'] },
    proposal,
    rules,
  );
  assert.ok(result.issues.some((issue) => issue.code === 'SLOPE_LIMIT'));
  assert.ok(result.issues.some((issue) => issue.code === 'SOIL_CAPACITY'));
  assert.ok(result.issues.some((issue) => issue.code === 'MISSING_INFRASTRUCTURE'));
});

test('rejects invalid lot geometry and unavailable lots', () => {
  const result = validateUrbanProposal(
    { ...lot, minX: 10, maxX: 10, available: false },
    proposal,
    rules,
  );
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_LOT_GEOMETRY'));
  assert.ok(result.issues.some((issue) => issue.code === 'LOT_UNAVAILABLE'));
});
