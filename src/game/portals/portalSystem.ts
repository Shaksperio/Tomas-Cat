/**
 * Portais de transporte — regras determinísticas.
 */

import type { WorldId } from '../worlds/worldRegistry';
import { isWorldUnlocked } from '../worlds/worldRegistry';

export interface PortalDef {
  id: string;
  name: string;
  worldFrom: WorldId;
  worldTo: WorldId | null;
  position: readonly [number, number, number];
  arrival: readonly [number, number, number];
  requiredFlags: readonly string[];
  unlockMessage: string;
  radius: number;
}

export interface PortalRuntimeState {
  activatedIds: string[];
  currentWorldId: WorldId;
  flags: string[];
}

export const INITIAL_PORTAL_STATE: PortalRuntimeState = {
  activatedIds: [],
  currentWorldId: 'world_hub',
  flags: [],
};

export const HUB_PORTALS: readonly PortalDef[] = [
  {
    id: 'portal_suburb_outbound',
    name: 'Portal da Quarentena',
    worldFrom: 'world_hub',
    worldTo: null,
    position: [0, 0.2, 0],
    arrival: [0, 0.2, -110],
    requiredFlags: [],
    unlockMessage: 'Travessia local concluída. Você chegou ao antigo canal da Quarentena.',
    radius: 3.8,
  },
  {
    id: 'portal_suburb_return',
    name: 'Portal de Retorno',
    worldFrom: 'world_hub',
    worldTo: null,
    position: [0, 0.2, -110],
    arrival: [0, 0.2, 0],
    requiredFlags: [],
    unlockMessage: 'Você retornou ao ponto inicial da Quarentena.',
    radius: 3.8,
  },
];

export function portalIsActive(
  portal: PortalDef,
  flags: ReadonlySet<string> | readonly string[],
): boolean {
  const set = flags instanceof Set ? flags : new Set(flags);
  if (!portal.requiredFlags.every((f) => set.has(f))) return false;
  if (portal.worldTo && !isWorldUnlocked(portal.worldTo, set)) return false;
  return true;
}

export function findPortalAt(
  portals: readonly PortalDef[],
  x: number,
  z: number,
  flags: ReadonlySet<string> | readonly string[],
): PortalDef | null {
  for (const p of portals) {
    const dx = x - p.position[0];
    const dz = z - p.position[2];
    if (dx * dx + dz * dz <= p.radius * p.radius) {
      if (portalIsActive(p, flags)) return p;
    }
  }
  return null;
}

export type TravelResult =
  | { ok: true; kind: 'local'; arrival: readonly [number, number, number]; portalId: string }
  | {
      ok: true;
      kind: 'world';
      worldTo: WorldId;
      arrival: readonly [number, number, number];
      portalId: string;
    }
  | { ok: false; reason: 'inactive' | 'unknown' };

export function resolveTravel(
  portal: PortalDef,
  flags: ReadonlySet<string> | readonly string[],
): TravelResult {
  if (!portalIsActive(portal, flags)) return { ok: false, reason: 'inactive' };
  if (portal.worldTo === null) {
    return { ok: true, kind: 'local', arrival: portal.arrival, portalId: portal.id };
  }
  return {
    ok: true,
    kind: 'world',
    worldTo: portal.worldTo,
    arrival: portal.arrival,
    portalId: portal.id,
  };
}

export function markPortalActivated(
  state: PortalRuntimeState,
  portalId: string,
): PortalRuntimeState {
  if (state.activatedIds.includes(portalId)) return state;
  return { ...state, activatedIds: [...state.activatedIds, portalId] };
}

export function applyWorldTravel(
  state: PortalRuntimeState,
  worldTo: WorldId,
): PortalRuntimeState {
  return { ...state, currentWorldId: worldTo };
}

export function addFlag(
  state: PortalRuntimeState,
  flag: string,
): PortalRuntimeState {
  if (state.flags.includes(flag)) return state;
  return { ...state, flags: [...state.flags, flag] };
}
