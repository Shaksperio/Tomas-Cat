import type { WorldId, WorldPoint } from './portalWorlds';

export type WorldAvailability = 'playable' | 'planned';

export interface WorldDefinition {
  id: WorldId;
  name: string;
  description: string;
  availability: WorldAvailability;
  spawn: WorldPoint;
  /** Chave de cena separada de currentPhase. */
  sceneKey: string;
}

export const WORLD_CATALOG: readonly WorldDefinition[] = [
  {
    id: 'quarantine-city',
    name: 'Cidade da Quarentena',
    description: 'O mundo original de Tomas, com as quatro fases atuais da campanha.',
    availability: 'playable',
    spawn: { x: 0, z: 8 },
    sceneKey: 'quarantine-city',
  },
  {
    id: 'crystal-archipelago',
    name: 'Arquipélago de Cristal',
    description: 'Um mundo insular de águas translúcidas, formações minerais e santuários antigos.',
    availability: 'planned',
    spawn: { x: 0, z: 18 },
    sceneKey: 'crystal-archipelago',
  },
] as const;

export const WORLD_IDS: readonly WorldId[] = WORLD_CATALOG.map((world) => world.id);

export const PLAYABLE_WORLD_IDS: readonly WorldId[] = WORLD_CATALOG
  .filter((world) => world.availability === 'playable')
  .map((world) => world.id);

export function getWorldDefinition(worldId: WorldId): WorldDefinition | undefined {
  return WORLD_CATALOG.find((world) => world.id === worldId);
}

export function isWorldPlayable(worldId: WorldId): boolean {
  return getWorldDefinition(worldId)?.availability === 'playable';
}
