/**
 * Catálogo de corpos d'água por fase (lagos e rios) — dados puros.
 * Complementa as 8 bacias já existentes; não altera sampleWater.
 *
 * Coordenação: não toca dialogue/ nem sky/. Pode ser ligado depois no worldBuilder.
 */

import { createWaterBody, type WaterBody } from './water';

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
  { id: 'lake_suburb_1', name: 'Lago da Quarentena', phase: 1, x: -40, z: -40, radius: 9 },
  { id: 'lake_roofs_1', name: 'Cisterna dos Telhados', phase: 2, x: 90, z: 20, radius: 6 },
  { id: 'lake_hospital_1', name: 'Espelho do Aqueduto', phase: 3, x: -95, z: 30, radius: 8 },
  { id: 'lake_stadium_1', name: 'Lago do Bio-Domo', phase: 4, x: 15, z: 100, radius: 12 },
];

export const PHASE_RIVERS: readonly RiverSegment[] = [
  {
    id: 'river_suburb',
    name: 'Canal do Subúrbio',
    phase: 1,
    ax: -80, az: -70,
    bx: 20, bz: -50,
    halfWidth: 3.2,
    surfaceY: -0.35,
    floorY: -2.4,
  },
  {
    id: 'river_hospital',
    name: 'Canal do Complexo',
    phase: 3,
    ax: -130, az: -20,
    bx: -80, bz: 40,
    halfWidth: 2.8,
    surfaceY: -0.4,
    floorY: -2.8,
  },
  {
    id: 'river_stadium',
    name: 'Valeta do Estádio',
    phase: 4,
    ax: -30, az: 90,
    bx: 50, bz: 120,
    halfWidth: 3.5,
    surfaceY: -0.35,
    floorY: -2.6,
  },
];

export function lakesAsWaterBodies(phase?: number): WaterBody[] {
  return PHASE_LAKES
    .filter((l) => phase === undefined || l.phase === phase)
    .map((l) => createWaterBody(l.id, l.name, l.x, l.z, l.radius));
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
