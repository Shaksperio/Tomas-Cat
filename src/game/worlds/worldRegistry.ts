/**
 * Registro de mundos e desbloqueio — lógica pura.
 * A galáxia de mundos e os portais consomem estes dados.
 * Não depende de Three.js nem de GameEngine.
 */

export type WorldId = string;

export interface WorldDef {
  id: WorldId;
  name: string;
  order: number;
  description: string;
  unlockRequires: readonly string[];
  theme: 'metro' | 'flood' | 'scrap' | 'forest_iron' | 'void';
}

export const WORLD_CATALOG: readonly WorldDef[] = [
  {
    id: 'world_hub',
    name: 'Metrópole Devastada',
    order: 0,
    description: 'A cidade onde Tomas acordou. Quatro distritos e a sociedade local.',
    unlockRequires: [],
    theme: 'metro',
  },
  {
    id: 'world_flood',
    name: 'Distrito Alagado',
    order: 1,
    description: 'Canais profundos e ruínas submersas. Exige concluir as tarefas do hub.',
    unlockRequires: ['tasks_world_hub_complete'],
    theme: 'flood',
  },
  {
    id: 'world_scrap',
    name: 'Deserto de Sucata',
    order: 2,
    description: 'Areia de metal e tempestades de estilhaços.',
    unlockRequires: ['tasks_world_flood_complete'],
    theme: 'scrap',
  },
];

export function getWorld(id: WorldId): WorldDef | undefined {
  return WORLD_CATALOG.find((w) => w.id === id);
}

export function isWorldUnlocked(
  worldId: WorldId,
  flags: ReadonlySet<string> | readonly string[],
): boolean {
  const world = getWorld(worldId);
  if (!world) return false;
  if (world.unlockRequires.length === 0) return true;
  const set = flags instanceof Set ? flags : new Set(flags);
  return world.unlockRequires.every((f) => set.has(f));
}

export function listUnlockedWorlds(
  flags: ReadonlySet<string> | readonly string[],
): WorldDef[] {
  return WORLD_CATALOG.filter((w) => isWorldUnlocked(w.id, flags)).sort(
    (a, b) => a.order - b.order,
  );
}

export function nextLockedWorld(
  flags: ReadonlySet<string> | readonly string[],
): WorldDef | null {
  const sorted = [...WORLD_CATALOG].sort((a, b) => a.order - b.order);
  for (const w of sorted) {
    if (!isWorldUnlocked(w.id, flags)) return w;
  }
  return null;
}
