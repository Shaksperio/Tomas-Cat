/** Contratos puros para viagens entre mundos. Não confundir WorldId com currentPhase. */
export type WorldId = string;

export interface WorldPoint {
  x: number;
  z: number;
}

export interface PortalUnlockRequirements {
  defeatedBosses?: readonly number[];
  completedTaskIds?: readonly string[];
  requiredFlags?: readonly string[];
}

export interface PortalDefinition {
  id: string;
  sourceWorldId: WorldId;
  destinationWorldId: WorldId;
  position: WorldPoint;
  destination: WorldPoint;
  requirements?: PortalUnlockRequirements;
}

export interface PortalProgressContext {
  defeatedBosses: ReadonlySet<number>;
  completedTaskIds: ReadonlySet<string>;
  flags: ReadonlySet<string>;
}

export interface WorldProgress {
  visited: boolean;
  playerPosition: WorldPoint;
  unlockedPortalIds: string[];
}

export interface WorldReturnAnchor {
  worldId: WorldId;
  position: WorldPoint;
  portalId: string;
}

export interface WorldTravelSaveState {
  /** Mundo ativo; independente da fase/capítulo da campanha. */
  activeWorldId: WorldId;
  /** Progresso leve por mundo. O snapshot completo de cada mundo será integrado em etapa própria. */
  worlds: Record<WorldId, WorldProgress>;
  returnAnchor?: WorldReturnAnchor;
}

export interface PortalTransition {
  sourceWorldId: WorldId;
  destinationWorldId: WorldId;
  destination: WorldPoint;
  returnAnchor: WorldReturnAnchor;
}

export const LEGACY_WORLD_ID: WorldId = 'quarantine-city';

const DEFAULT_WORLD_ID = 'quarantine-city';

function validPoint(value: unknown): value is WorldPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return Number.isFinite(point.x) && Number.isFinite(point.z);
}

function normalizeProgress(value: unknown): WorldProgress {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const position = validPoint(record.playerPosition) ? record.playerPosition : { x: 0, z: 8 };
  const unlockedPortalIds = Array.isArray(record.unlockedPortalIds)
    ? [...new Set(record.unlockedPortalIds.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100))]
    : [];
  return {
    visited: record.visited === true,
    playerPosition: { x: position.x, z: position.z },
    unlockedPortalIds,
  };
}

/** Save v4 sem worldTravel migra para o mundo original sem tocar em currentPhase. */
export function createInitialWorldTravelState(worldId: WorldId = DEFAULT_WORLD_ID): WorldTravelSaveState {
  return {
    activeWorldId: worldId,
    worlds: { [worldId]: { visited: true, playerPosition: { x: 0, z: 8 }, unlockedPortalIds: [] } },
  };
}

/** Atualiza somente a posição do mundo ativo, preservando os demais mundos e âncora. */
export function updateActiveWorldPosition(
  state: WorldTravelSaveState,
  position: WorldPoint,
): WorldTravelSaveState {
  if (!validPoint(position) || !state.activeWorldId || !state.worlds[state.activeWorldId]) return state;
  return {
    ...state,
    worlds: {
      ...state.worlds,
      [state.activeWorldId]: {
        ...state.worlds[state.activeWorldId],
        visited: true,
        playerPosition: { x: position.x, z: position.z },
      },
    },
  };
}

/** Remove IDs desconhecidos e dados malformados sem descartar progresso de mundos conhecidos. */
export function normalizeWorldTravelState(
  value: unknown,
  knownWorldIds: readonly WorldId[],
  fallbackWorldId: WorldId = DEFAULT_WORLD_ID,
): WorldTravelSaveState {
  const known = new Set(knownWorldIds);
  known.add(fallbackWorldId);
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawWorlds = record.worlds && typeof record.worlds === 'object'
    ? record.worlds as Record<string, unknown>
    : {};
  const worlds: Record<WorldId, WorldProgress> = {};
  for (const worldId of known) {
    if (Object.prototype.hasOwnProperty.call(rawWorlds, worldId)) worlds[worldId] = normalizeProgress(rawWorlds[worldId]);
  }
  if (!worlds[fallbackWorldId]) worlds[fallbackWorldId] = createInitialWorldTravelState(fallbackWorldId).worlds[fallbackWorldId];
  const activeWorldId = typeof record.activeWorldId === 'string' && known.has(record.activeWorldId) && worlds[record.activeWorldId]
    ? record.activeWorldId
    : fallbackWorldId;
  const rawAnchor = record.returnAnchor && typeof record.returnAnchor === 'object'
    ? record.returnAnchor as Record<string, unknown>
    : null;
  const returnAnchor = rawAnchor
    && typeof rawAnchor.worldId === 'string'
    && known.has(rawAnchor.worldId)
    && typeof rawAnchor.portalId === 'string'
    && rawAnchor.portalId.length > 0
    && validPoint(rawAnchor.position)
    ? {
        worldId: rawAnchor.worldId,
        portalId: rawAnchor.portalId,
        position: { x: rawAnchor.position.x, z: rawAnchor.position.z },
      }
    : undefined;
  return { activeWorldId, worlds, ...(returnAnchor ? { returnAnchor } : {}) };
}

export function isPortalUnlocked(
  portal: PortalDefinition,
  context: PortalProgressContext,
): boolean {
  const requirements = portal.requirements;
  if (!requirements) return true;
  return (requirements.defeatedBosses ?? []).every((id) => context.defeatedBosses.has(id))
    && (requirements.completedTaskIds ?? []).every((id) => context.completedTaskIds.has(id))
    && (requirements.requiredFlags ?? []).every((id) => context.flags.has(id));
}

/** Só resolve viagem para portal de origem correta, desbloqueado e destino registrado. */
export function resolvePortalTransition(
  portal: PortalDefinition,
  activeWorldId: WorldId,
  knownWorldIds: readonly WorldId[],
  context: PortalProgressContext,
): PortalTransition | null {
  if (portal.sourceWorldId !== activeWorldId) return null;
  if (!portal.id || !Number.isFinite(portal.position.x) || !Number.isFinite(portal.position.z)
    || !Number.isFinite(portal.destination.x) || !Number.isFinite(portal.destination.z)) return null;
  if (!knownWorldIds.includes(portal.destinationWorldId) || portal.destinationWorldId === activeWorldId) return null;
  if (!isPortalUnlocked(portal, context)) return null;
  return {
    sourceWorldId: activeWorldId,
    destinationWorldId: portal.destinationWorldId,
    destination: { ...portal.destination },
    returnAnchor: {
      worldId: activeWorldId,
      position: { ...portal.position },
      portalId: portal.id,
    },
  };
}

/** Constrói o portal de retorno lógico no ponto de origem salvo pela transição. */
export function resolveReturnTransition(
  activeWorldId: WorldId,
  anchor: WorldReturnAnchor | undefined,
  knownWorldIds: readonly WorldId[],
): PortalTransition | null {
  if (!anchor || anchor.worldId === activeWorldId || !knownWorldIds.includes(anchor.worldId)) return null;
  if (!Number.isFinite(anchor.position.x) || !Number.isFinite(anchor.position.z)) return null;
  return {
    sourceWorldId: activeWorldId,
    destinationWorldId: anchor.worldId,
    destination: { ...anchor.position },
    returnAnchor: { worldId: activeWorldId, position: { x: 0, z: 8 }, portalId: `return:${anchor.portalId}` },
  };
}
