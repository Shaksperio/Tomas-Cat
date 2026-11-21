import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMemory, loadMemory, mergeObservation, saveMemory, validateMemory } from './memory.mjs';

const sampleReport = {
  schemaVersion: 1,
  generatedAt: '2026-11-21T12:00:00.000Z',
  status: 'passed',
  mission: { id: 'visit-emporio' },
  navigation: { reached: true, target: { id: 'shop-emporio', name: 'Empório da Esquina' }, distanceToTarget: 0.4 },
  interaction: { openShopId: 'emporio' },
  observations: { settled: { catX: 8, catZ: 10, sectorName: 'Rua da Quarentena' }, screenshots: [] },
  screenshots: ['world-initial.png', 'world-after-movement.png'],
  worldMap: 'world-map.svg',
  worldSnapshot: {
    interactables: [{ id: 'shop-emporio', name: 'Empório da Esquina', kind: 'shop', x: 8, z: 10, active: true }],
    predators: [{ id: 'sentinel-1', name: 'Sentinela', kind: 'sentinel', x: 20, z: 30, alive: true, isBoss: true, isTerritoryRival: false }],
    society: {
      tick: 3,
      agents: [{ id: 'agent-iris', displayName: 'Íris', profession: 'engenheira', status: 'working', position: { x: 1, z: 2 }, activeTaskId: 'task-build' }],
      tasks: [{ id: 'task-build', kind: 'construction', status: 'in_progress', assignedAgentId: 'agent-iris', target: { x: 5, z: 6 } }],
    },
  },
};

test('creates a versioned empty memory', () => {
  const memory = createMemory('2026-11-21T00:00:00.000Z');
  assert.equal(memory.schemaVersion, 1);
  assert.equal(memory.gameId, 'tomas-vagabundo');
  assert.deepEqual(memory.missions, []);
});

test('rejects corrupt or incompatible memory without replacing it', () => {
  assert.throws(() => validateMemory({ schemaVersion: 9 }), /não será sobrescrito/);
});

test('merges a completed visit and records discovered entities', () => {
  const memory = mergeObservation(createMemory(), sampleReport);
  assert.equal(memory.poiVisits['shop-emporio'].visitCount, 1);
  assert.equal(memory.poiVisits['shop-emporio'].lastInteraction, 'emporio');
  assert.equal(memory.knownEntities['agent:agent-iris'].profession, 'engenheira');
  assert.equal(memory.knownEntities['predator:sentinel-1'].isBoss, true);
  assert.equal(memory.knownEntities['task:task-build'].assignedAgentId, 'agent-iris');
  assert.equal(memory.observations.length, 1);
});

test('increments visit and entity history on a later observation', () => {
  const first = mergeObservation(createMemory(), sampleReport);
  const secondReport = { ...sampleReport, generatedAt: '2026-11-21T12:05:00.000Z' };
  const second = mergeObservation(first, secondReport);
  assert.equal(second.poiVisits['shop-emporio'].visitCount, 2);
  assert.equal(second.knownEntities['agent:agent-iris'].seenCount, 2);
  assert.equal(second.knownEntities['agent:agent-iris'].firstSeenAt, sampleReport.generatedAt);
  assert.equal(second.missions.length, 2);
});

test('loads, saves and reloads portable memory JSON', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-memory-'));
  const file = path.join(directory, 'memory.json');
  try {
    const fresh = await loadMemory(file);
    const merged = mergeObservation(fresh, sampleReport);
    await saveMemory(file, merged);
    const reloaded = await loadMemory(file);
    assert.equal(reloaded.poiVisits['shop-emporio'].visitCount, 1);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).schemaVersion, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
