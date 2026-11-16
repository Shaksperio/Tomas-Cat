/**
 * Catálogo de corpos d'água por fase (lagos e rios) — dados puros.
 * Complementa as 8 bacias já existentes; não altera sampleWater.
 *
 * Coordenação: não toca dialogue/ nem sky/. Pode ser ligado depois no worldBuilder.
 */

import { createWaterBody, type WaterBody, type WaterSample } from './water';

/** Trecho de rio: amostragem por distância a um segmento (não só círculo). */
export interface RiverSegment {
  id: string;
  name: string;
  phase: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfWidth: number;
  surfaceY: number;
  floorY: number;
  /** Velocidade da corrente ao longo do segmento (m/s), A→B. */
  currentSpeed?: number;
  /** False para canais elevados apenas visuais, sem natação/empurrão no solo. */
  swimmable?: boolean;
}

export interface LakeDef {
  id: string;
  name: string;
  phase: number;
  x: number;
  z: number;
  radius: number;
}

export const PHASE_LAKES: readonly LakeDef[] = [
  { id: 'lake_suburb_1', name: 'Lago da Quarentena', phase: 1, x: 35, z: -115, radius: 8 },
  { id: 'lake_roofs_1', name: 'Cisterna dos Telhados', phase: 2, x: 112, z: 45, radius: 6 },
  { id: 'lake_hospital_1', name: 'Espelho do Aqueduto', phase: 3, x: -190, z: 0, radius: 8 },
  { id: 'lake_stadium_1', name: 'Lago do Bio-Domo', phase: 4, x: 78, z: 172, radius: 10 },
];

export const PHASE_RIVERS: readonly RiverSegment[] = [
  {
    id: 'river_suburb',
    name: 'Rio da Quarentena',
    phase: 1,
    ax: -70, az: -94,
    bx: 45, bz: -94,
    halfWidth: 2.8,
    surfaceY: -0.35,
    floorY: -2.4,
    currentSpeed: 1.1,
  },
  {
    id: 'canal_roofs',
    name: 'Canal Elevado dos Telhados',
    phase: 2,
    ax: 58, az: 40,
    bx: 172, bz: 40,
    halfWidth: 1.8,
    surfaceY: 6.8,
    floorY: 5.9,
    currentSpeed: 0.35,
    swimmable: false,
  },
  {
    id: 'river_hospital',
    name: 'Rio do Complexo Hospitalar',
    phase: 3,
    ax: -205, az: 42,
    bx: -55, bz: 42,
    halfWidth: 2.8,
    surfaceY: -0.4,
    floorY: -2.8,
    currentSpeed: 1.5,
  },
  {
    id: 'river_stadium',
    name: 'Canal da Arena',
    phase: 4,
    ax: -80, az: 198,
    bx: 80, bz: 198,
    halfWidth: 3.2,
    surfaceY: -0.35,
    floorY: -2.6,
    currentSpeed: 1.2,
  },
];

export function lakesAsWaterBodies(phase?: number): WaterBody[] {
  return PHASE_LAKES
    .filter((l) => phase === undefined || l.phase === phase)
    .map((l) => createWaterBody(l.id, l.name, l.x, l.z, l.radius));
}

/** Cantos do retângulo que representa o leito do rio, em coordenadas X/Z. */
export function riverCorners(r: RiverSegment): { x: number; z: number }[] {
  const dx = r.bx - r.ax;
  const dz = r.bz - r.az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-8) return [];
  const nx = (-dz / len) * r.halfWidth;
  const nz = (dx / len) * r.halfWidth;
  return [
    { x: r.ax + nx, z: r.az + nz },
    { x: r.ax - nx, z: r.az - nz },
    { x: r.bx - nx, z: r.bz - nz },
    { x: r.bx + nx, z: r.bz + nz },
  ];
}

export function distanceToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  if (len2 < 1e-8) {
    const dx = px - ax;
    const dz = pz - az;
    return Math.sqrt(dx * dx + dz * dz);
  }
  let t = ((px - ax) * abx + (pz - az) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * abx;
  const qz = az + t * abz;
  const dx = px - qx;
  const dz = pz - qz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function findRiverAt(
  rivers: readonly RiverSegment[],
  x: number,
  z: number,
): RiverSegment | null {
  for (const r of rivers) {
    if (distanceToSegment(x, z, r.ax, r.az, r.bx, r.bz) <= r.halfWidth) return r;
  }
  return null;
}

export function riversForPhase(phase?: number): RiverSegment[] {
  return PHASE_RIVERS.filter((r) => phase === undefined || r.phase === phase);
}

/** Vetor unitário da corrente A→B (0 se segmento degenerado). */
export function riverCurrentDirection(r: RiverSegment): { x: number; z: number } {
  const dx = r.bx - r.ax;
  const dz = r.bz - r.az;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1e-8) return { x: 0, z: 0 };
  return { x: dx / len, z: dz / len };
}

/** Deslocamento horizontal (m) a aplicar neste frame pela corrente. */
export function riverCurrentDelta(
  r: RiverSegment,
  dt: number,
): { dx: number; dz: number } {
  const speed = r.currentSpeed ?? 1.2;
  const dir = riverCurrentDirection(r);
  return { dx: dir.x * speed * dt, dz: dir.z * speed * dt };
}

export interface RiverWaterSample extends WaterSample {
  river: RiverSegment | null;
  /** Deslocamento horizontal da corrente neste frame (m), já multiplicado por dt. */
  currentDx: number;
  currentDz: number;
}

/**
 * Amostra lago (círculo via WaterBody) ou rio (segmento).
 * Preferência: se estiver em ambos, o mais profundo manda.
 */
export function sampleExpandedWater(
  lakeBodies: readonly WaterBody[],
  rivers: readonly RiverSegment[],
  x: number,
  y: number,
  z: number,
  headHeight: number,
  dt = 0,
): RiverWaterSample {
  let best: RiverWaterSample = {
    body: null,
    river: null,
    inWater: false,
    footDepth: 0,
    submerged: false,
    floorY: 0,
    currentDx: 0,
    currentDz: 0,
  };

  for (const body of lakeBodies) {
    const dx = x - body.x;
    const dz = z - body.z;
    if (dx * dx + dz * dz >= body.radius * body.radius) continue;
    const footDepth = Math.max(0, body.surfaceY - y);
    if (footDepth < best.footDepth && best.inWater) continue;
    const inWater = footDepth > 0.12;
    const submerged = inWater && y + headHeight < body.surfaceY;
    if (inWater || !best.inWater) {
      best = {
        body,
        river: null,
        inWater,
        footDepth,
        submerged,
        floorY: body.floorY,
        currentDx: 0,
        currentDz: 0,
      };
    }
  }

  const river = findRiverAt(rivers, x, z);
  if (river && river.swimmable !== false) {
    const footDepth = Math.max(0, river.surfaceY - y);
    const inWater = footDepth > 0.12;
    const submerged = inWater && y + headHeight < river.surfaceY;
    const deeper = footDepth > best.footDepth;
    if (inWater && (deeper || !best.inWater)) {
      const flow = riverCurrentDelta(river, dt);
      best = {
        body: {
          id: river.id,
          name: river.name,
          x: (river.ax + river.bx) / 2,
          z: (river.az + river.bz) / 2,
          radius: river.halfWidth,
          surfaceY: river.surfaceY,
          floorY: river.floorY,
        },
        river,
        inWater,
        footDepth,
        submerged,
        floorY: river.floorY,
        currentDx: flow.dx,
        currentDz: flow.dz,
      };
    }
  }

  return best;
}

/** Junta lagos da fase + bacias legadas num único array para sampleWater clássico. */
export function mergeLakeBodies(
  legacyBasins: readonly WaterBody[],
  phase?: number,
): WaterBody[] {
  return [...legacyBasins, ...lakesAsWaterBodies(phase)];
}
