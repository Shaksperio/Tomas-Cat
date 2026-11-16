import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_PORTALS,
  INITIAL_PORTAL_STATE,
  addFlag,
  findPortalAt,
  markPortalActivated,
  portalIsActive,
  resolveTravel,
  applyWorldTravel,
} from './portalSystem.ts';
import {
  isWorldUnlocked,
  listUnlockedWorlds,
  nextLockedWorld,
  WORLD_CATALOG,
} from '../worlds/worldRegistry.ts';

test('hub começa desbloqueado; mundos futuros dependem de flags', () => {
  assert.equal(isWorldUnlocked('world_hub', []), true);
  assert.equal(isWorldUnlocked('world_flood', []), false);
  assert.equal(isWorldUnlocked('world_flood', ['tasks_world_hub_complete']), true);
});

test('catálogo da galáxia lista apenas mundos liberados', () => {
  const onlyHub = listUnlockedWorlds([]);
  assert.equal(onlyHub.length, 1);
  assert.equal(onlyHub[0].id, 'world_hub');
  assert.equal(nextLockedWorld([])?.id, 'world_flood');
  assert.equal(nextLockedWorld(['tasks_world_hub_complete', 'tasks_world_flood_complete']), null);
  assert.ok(WORLD_CATALOG.length >= 3);
});

test('os dois portais locais são sempre ativos e bidirecionais', () => {
  assert.equal(HUB_PORTALS.length, 2);
  for (const portal of HUB_PORTALS) {
    assert.equal(portal.worldTo, null);
    assert.equal(portalIsActive(portal, []), true);
  }
  const outbound = HUB_PORTALS.find((p) => p.id === 'portal_suburb_outbound')!;
  const inbound = HUB_PORTALS.find((p) => p.id === 'portal_suburb_return')!;
  assert.deepEqual(outbound.arrival, inbound.position);
  assert.deepEqual(inbound.arrival, outbound.position);
});

test('findPortalAt identifica apenas a área de ativação', () => {
  const outbound = HUB_PORTALS.find((p) => p.id === 'portal_suburb_outbound')!;
  const [x, , z] = outbound.position;
  assert.equal(findPortalAt(HUB_PORTALS, x, z, [])?.id, outbound.id);
  assert.equal(findPortalAt(HUB_PORTALS, x + 50, z + 50, []), null);
});

test('resolveTravel retorna destino local sem trocar worldId', () => {
  const outbound = HUB_PORTALS.find((p) => p.id === 'portal_suburb_outbound')!;
  const travel = resolveTravel(outbound, []);
  assert.equal(travel.ok, true);
  if (travel.ok) {
    assert.equal(travel.kind, 'local');
    assert.deepEqual(travel.arrival, [0, 0.2, -110]);
  }
});

test('estado de portal é imutável e registra ativação uma única vez', () => {
  let state = INITIAL_PORTAL_STATE;
  state = addFlag(state, 'tasks_world_hub_complete');
  assert.ok(state.flags.includes('tasks_world_hub_complete'));
  const activated = markPortalActivated(state, 'portal_suburb_outbound');
  assert.equal(markPortalActivated(activated, 'portal_suburb_outbound'), activated);
  const traveled = applyWorldTravel(activated, 'world_flood');
  assert.equal(traveled.currentWorldId, 'world_flood');
  assert.ok(state.activatedIds.length === 0);
});
