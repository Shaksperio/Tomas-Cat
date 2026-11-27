import type {
  ExistingBuilding, Frontage, Lot, PlanningDecision, ProjectProposal, Rect, RoadSegment,
  SoilKind, UrbanContext, UtilityKind, Violation, ZoneKind, BuildingUse,
} from './types';

export interface ZoningRule {
  allowedUses: readonly BuildingUse[];
  maxHeight: number;
  maxCoverage: number;
  front: number;
  side: number;
  rear: number;
  minSpacing: number;
  maxUnitsPerSector: number;
}

/** Regras simplificadas e verificáveis; não substituem normas técnicas reais. */
export const ZONING_RULES: Readonly<Record<ZoneKind, ZoningRule>> = {
  residential: { allowedUses: ['residential'], maxHeight: 16, maxCoverage: 0.6, front: 3, side: 1.5, rear: 2, minSpacing: 3, maxUnitsPerSector: 120 },
  commercial: { allowedUses: ['commercial', 'residential'], maxHeight: 22, maxCoverage: 0.75, front: 2, side: 1, rear: 2, minSpacing: 2.5, maxUnitsPerSector: 160 },
  industrial: { allowedUses: ['industrial'], maxHeight: 12, maxCoverage: 0.7, front: 5, side: 3, rear: 4, minSpacing: 6, maxUnitsPerSector: 40 },
  institutional: { allowedUses: ['institutional'], maxHeight: 18, maxCoverage: 0.5, front: 5, side: 3, rear: 3, minSpacing: 5, maxUnitsPerSector: 20 },
  green: { allowedUses: [], maxHeight: 0, maxCoverage: 0, front: 0, side: 0, rear: 0, minSpacing: 0, maxUnitsPerSector: 0 },
};

export const MAX_SLOPE = 0.25;
/** Solo mole ou encharcado limita a altura (fundação simples). */
export const SOIL_MAX_HEIGHT: Readonly<Record<SoilKind, number>> = { rock: Infinity, firm: 24, soft: 8, wet: 4 };
/** Calçada mínima entre a via e a edificação. */
export const SIDEWALK = 1.5;
export const MAX_ROAD_DISTANCE = 30;
export const MAX_UTILITY_DISTANCE = 40;
export const REQUIRED_UTILITIES: readonly UtilityKind[] = ['water', 'power', 'sewage'];
/** Comprimento da sombra projetada para o norte = altura × razão (sol baixo de inverno). */
export const SHADOW_RATIO = 1.2;

const EPS = 1e-9;

export function footprintOf(proposal: ProjectProposal, lot: Lot): Rect {
  return {
    x: lot.x + (proposal.offset?.x ?? 0),
    z: lot.z + (proposal.offset?.z ?? 0),
    width: proposal.footprint.width,
    depth: proposal.footprint.depth,
  };
}

/** Área onde a edificação pode ficar, descontados os recuos conforme a testada do lote. */
export function buildableEnvelope(lot: Lot, rule: ZoningRule = ZONING_RULES[lot.zone]): Rect | null {
  let minX = lot.x - lot.width / 2 + rule.side;
  let maxX = lot.x + lot.width / 2 - rule.side;
  let minZ = lot.z - lot.depth / 2 + rule.side;
  let maxZ = lot.z + lot.depth / 2 - rule.side;
  const apply = (front: Frontage): void => {
    if (front === 'south') { maxZ = lot.z + lot.depth / 2 - rule.front; minZ = lot.z - lot.depth / 2 + rule.rear; }
    else if (front === 'north') { minZ = lot.z - lot.depth / 2 + rule.front; maxZ = lot.z + lot.depth / 2 - rule.rear; }
    else if (front === 'east') { maxX = lot.x + lot.width / 2 - rule.front; minX = lot.x - lot.width / 2 + rule.rear; }
    else { minX = lot.x - lot.width / 2 + rule.front; maxX = lot.x + lot.width / 2 - rule.rear; }
  };
  apply(lot.frontage);
  const width = maxX - minX;
  const depth = maxZ - minZ;
  if (!(width > 0) || !(depth > 0)) return null;
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, width, depth };
}

const bounds = (r: Rect) => ({ minX: r.x - r.width / 2, maxX: r.x + r.width / 2, minZ: r.z - r.depth / 2, maxZ: r.z + r.depth / 2 });

export function rectContains(outer: Rect, inner: Rect): boolean {
  const o = bounds(outer); const i = bounds(inner);
  return i.minX >= o.minX - EPS && i.maxX <= o.maxX + EPS && i.minZ >= o.minZ - EPS && i.maxZ <= o.maxZ + EPS;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  const p = bounds(a); const q = bounds(b);
  return p.minX < q.maxX - EPS && p.maxX > q.minX + EPS && p.minZ < q.maxZ - EPS && p.maxZ > q.minZ + EPS;
}

/** Menor distância entre dois retângulos (0 se tocam ou se sobrepõem). */
export function rectGap(a: Rect, b: Rect): number {
  const p = bounds(a); const q = bounds(b);
  const dx = Math.max(0, p.minX - q.maxX, q.minX - p.maxX);
  const dz = Math.max(0, p.minZ - q.maxZ, q.minZ - p.maxZ);
  return Math.hypot(dx, dz);
}

function pointToSegment(px: number, pz: number, s: RoadSegment): number {
  const dx = s.bx - s.ax; const dz = s.bz - s.az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / len2));
  return Math.hypot(px - (s.ax + t * dx), pz - (s.az + t * dz));
}

function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const o = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const d1 = o(ax, az, bx, bz, cx, cz); const d2 = o(ax, az, bx, bz, dx, dz);
  const d3 = o(cx, cz, dx, dz, ax, az); const d4 = o(cx, cz, dx, dz, bx, bz);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Distância entre uma via (eixo) e um retângulo: 0 se o eixo atravessa ou entra no retângulo. */
export function roadDistanceToRect(road: RoadSegment, rect: Rect): number {
  const b = bounds(rect);
  const inside = (x: number, z: number) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  if (inside(road.ax, road.az) || inside(road.bx, road.bz)) return 0;
  const corners: [number, number][] = [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]];
  for (let i = 0; i < 4; i += 1) {
    const [cx, cz] = corners[i]; const [dx, dz] = corners[(i + 1) % 4];
    if (segmentsCross(road.ax, road.az, road.bx, road.bz, cx, cz, dx, dz)) return 0;
  }
  const fromCorners = corners.map(([x, z]) => pointToSegment(x, z, road));
  const rectNearPoint = (x: number, z: number) => Math.hypot(Math.max(0, b.minX - x, x - b.maxX), Math.max(0, b.minZ - z, z - b.maxZ));
  return Math.min(...fromCorners, rectNearPoint(road.ax, road.az), rectNearPoint(road.bx, road.bz));
}

function sunBlockedBuildings(footprint: Rect, height: number, buildings: readonly ExistingBuilding[]): ExistingBuilding[] {
  const length = height * SHADOW_RATIO;
  const shadow: Rect = { x: footprint.x, z: footprint.z - footprint.depth / 2 - length / 2, width: footprint.width, depth: length };
  return buildings.filter((b) => b.needsSun && b.height < height && rectsOverlap(b, shadow));
}

/**
 * Aprova ou rejeita um projeto ANTES de qualquer obra. Devolve todas as violações
 * (ordem estável), para auditoria e para a Cowila poder ajustar a proposta.
 */
export function evaluateProject(proposal: ProjectProposal, ctx: UrbanContext): PlanningDecision {
  const violations: Violation[] = [];
  const add = (code: Violation['code'], message: string) => violations.push({ code, message });

  const numbersOk = [proposal.footprint.width, proposal.footprint.depth, proposal.height, proposal.floors, proposal.units]
    .every((n) => Number.isFinite(n) && n > 0)
    && Number.isInteger(proposal.floors) && Number.isInteger(proposal.units)
    && Number.isFinite(proposal.offset?.x ?? 0) && Number.isFinite(proposal.offset?.z ?? 0);
  if (!proposal.id.trim() || !proposal.developerId.trim() || !numbersOk) {
    add('INVALID_PROPOSAL', 'Projeto sem identidade ou com dimensões inválidas.');
    return { approved: false, violations };
  }
  const lot = ctx.lots.get(proposal.lotId);
  if (!lot) {
    add('LOT_UNKNOWN', 'O lote do projeto não existe no registro de terrenos.');
    return { approved: false, violations };
  }
  const rule = ZONING_RULES[lot.zone];

  if (lot.protectedArea) add('PROTECTED_AREA', 'Lote em área protegida.');
  if (lot.status !== 'free') add('LOT_UNAVAILABLE', 'O lote já está em obra ou construído.');
  if (lot.ownerId !== proposal.developerId) add('NOT_OWNER', 'O incorporador não é o proprietário registrado do lote.');
  if (!rule.allowedUses.includes(proposal.use)) add('ZONE_USE', `Uso "${proposal.use}" não é permitido na zona ${lot.zone}.`);
  if (lot.slope > MAX_SLOPE) add('SLOPE', 'Terreno íngreme demais para construir.');
  if (proposal.height > rule.maxHeight) add('HEIGHT', `Altura acima do limite da zona (${rule.maxHeight}).`);
  if (proposal.height > SOIL_MAX_HEIGHT[lot.soil]) add('SOIL', `Solo ${lot.soil} não suporta essa altura.`);

  const footprint = footprintOf(proposal, lot);
  const envelope = buildableEnvelope(lot, rule);
  if (!envelope || !rectContains(envelope, footprint)) add('OUTSIDE_ENVELOPE', 'A edificação invade os recuos ou sai do lote.');
  if (footprint.width * footprint.depth > lot.width * lot.depth * rule.maxCoverage + EPS) add('COVERAGE', 'Taxa de ocupação do lote excedida.');

  for (const other of ctx.buildings) {
    if (other.lotId === lot.id) continue;
    if (rectGap(footprint, other) < rule.minSpacing - EPS) add('SPACING', `Distância mínima de ${rule.minSpacing} entre edificações não respeitada (${other.id}).`);
  }

  let nearestRoad = Infinity;
  for (const road of ctx.roads) {
    const d = roadDistanceToRect(road, footprint);
    nearestRoad = Math.min(nearestRoad, d);
    if (d < road.width / 2 + SIDEWALK - EPS) add('ROAD_OVERLAP', `Edificação sobre a via ou sem calçada (${road.id}).`);
  }
  if (!(nearestRoad <= MAX_ROAD_DISTANCE)) add('ROAD_ACCESS', 'Sem acesso viário próximo para pedestres e veículos.');

  const shaded = sunBlockedBuildings(footprint, proposal.height, ctx.buildings);
  if (shaded.length > 0) add('SUNLIGHT', `A sombra bloquearia a insolação de ${shaded.map((b) => b.id).join(', ')}.`);

  for (const other of ctx.buildings) {
    const view = other.protectedView;
    if (view && proposal.height > view.maxHeight && rectsOverlap(footprint, view)) add('VIEW', `Obstrui o corredor de vista protegido de ${other.id}.`);
  }

  const missing = REQUIRED_UTILITIES.filter((kind) =>
    !ctx.utilities.some((u) => u.kind === kind && Math.hypot(u.x - footprint.x, u.z - footprint.z) <= MAX_UTILITY_DISTANCE));
  if (missing.length > 0) add('UTILITIES', `Sem ligação de ${missing.join(', ')} ao alcance.`);

  const used = ctx.sectorUnits.get(lot.sectorId) ?? 0;
  if (used + proposal.units > rule.maxUnitsPerSector) add('DENSITY', 'A densidade máxima do setor seria excedida.');

  return { approved: violations.length === 0, violations };
}
