import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createMemory(now = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    gameId: 'tomas-vagabundo',
    createdAt: now,
    updatedAt: now,
    lastSector: null,
    lastPlayerPosition: null,
    poiVisits: {},
    knownEntities: {},
    missions: [],
    observations: [],
  };
}

export function validateMemory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.schemaVersion !== 1 || value.gameId !== 'tomas-vagabundo'
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string'
    || !value.poiVisits || typeof value.poiVisits !== 'object' || Array.isArray(value.poiVisits)
    || !value.knownEntities || typeof value.knownEntities !== 'object' || Array.isArray(value.knownEntities)
    || !Array.isArray(value.missions) || !Array.isArray(value.observations)) {
    throw new Error('Memória Matrix inválida ou incompatível; arquivo não será sobrescrito.');
  }
  return value;
}

export async function loadMemory(filePath) {
  try {
    return validateMemory(JSON.parse(await readFile(filePath, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return createMemory();
    throw error;
  }
}

export function mergeObservation(inputMemory, report) {
  const memory = structuredClone(validateMemory(inputMemory));
  if (!report || report.schemaVersion !== 1 || !report.worldSnapshot || !report.observations) {
    throw new Error('Observação incompatível com o protocolo Matrix Explorer v1.');
  }
  const at = report.generatedAt;
  const world = report.worldSnapshot;
  const player = report.observations.settled ?? report.observations.afterStop ?? report.observations.initial;
  if (!at || !player || !Number.isFinite(player.catX) || !Number.isFinite(player.catZ)) {
    throw new Error('Observação sem timestamp ou posição final válida.');
  }

  const upsert = (key, entity) => {
    const previous = memory.knownEntities[key];
    memory.knownEntities[key] = {
      ...entity,
      firstSeenAt: previous?.firstSeenAt ?? at,
      lastSeenAt: at,
      seenCount: (previous?.seenCount ?? 0) + 1,
    };
  };

  for (const item of world.interactables ?? []) {
    upsert(`interactable:${item.id}`, {
      entityType: 'interactable', id: item.id, name: item.name, kind: item.kind,
      position: { x: item.x, z: item.z }, active: item.active,
    });
  }
  for (const actor of world.predators ?? []) {
    upsert(`predator:${actor.id}`, {
      entityType: 'predator', id: actor.id, name: actor.name, kind: actor.kind,
      position: { x: actor.x, z: actor.z }, alive: actor.alive,
      isBoss: actor.isBoss, isTerritoryRival: actor.isTerritoryRival,
    });
  }
  for (const agent of world.society?.agents ?? []) {
    upsert(`agent:${agent.id}`, {
      entityType: 'agent', id: agent.id, name: agent.displayName,
      profession: agent.profession, status: agent.status,
      position: { x: agent.position.x, z: agent.position.z },
      activeTaskId: agent.activeTaskId ?? null,
    });
  }
  for (const task of world.society?.tasks ?? []) {
    upsert(`task:${task.id}`, {
      entityType: 'task', id: task.id, kind: task.kind, status: task.status,
      assignedAgentId: task.assignedAgentId ?? null,
      target: task.target ? { ...task.target } : null,
    });
  }

  const target = report.navigation?.target;
  if (target?.id && report.navigation?.reached) {
    const previous = memory.poiVisits[target.id];
    memory.poiVisits[target.id] = {
      id: target.id,
      name: target.name,
      kind: 'shop',
      firstVisitedAt: previous?.firstVisitedAt ?? at,
      lastVisitedAt: at,
      visitCount: (previous?.visitCount ?? 0) + 1,
      lastPosition: { x: player.catX, z: player.catZ },
      lastMissionId: report.mission?.id ?? null,
      lastInteraction: report.interaction?.openShopId ?? null,
    };
  }

  memory.missions.push({
    missionId: report.mission?.id ?? 'unknown',
    status: report.status,
    targetId: target?.id ?? null,
    completedAt: at,
    distanceToTarget: report.navigation?.distanceToTarget ?? null,
    interaction: report.interaction?.openShopId ?? null,
  });
  memory.observations.push({
    observedAt: at,
    sector: player.sectorName ?? null,
    playerPosition: { x: player.catX, z: player.catZ },
    societyTick: world.society?.tick ?? null,
    entityCount: Object.keys(memory.knownEntities).length,
    screenshotFiles: [...(report.screenshots ?? [])],
    worldMap: report.worldMap ?? null,
  });
  memory.missions = memory.missions.slice(-100);
  memory.observations = memory.observations.slice(-100);
  memory.lastSector = player.sectorName ?? memory.lastSector;
  memory.lastPlayerPosition = { x: player.catX, z: player.catZ };
  memory.updatedAt = at;
  return memory;
}

export async function saveMemory(filePath, memory) {
  validateMemory(memory);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(memory, null, 2) + '\n');
}
