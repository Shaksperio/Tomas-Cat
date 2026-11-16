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

test('hub começa desbloqueado; flood exige flag', () => {
  assert.equal(isWorldUnlocked('world_hub', []), true);
  assert.equal(isWorldUnlocked('world_flood', []), false);
  assert.equal(isWorldUnlocked('world_flood', ['tasks_world_hub_complete']), true);
});

test('listUnlockedWorlds e nextLockedWorld', () => {
  const onlyHub = listUnlockedWorlds([]);
  assert.equal(onlyHub.length, 1);
  assert.equal(onlyHub[0].id, 'world_hub');
  assert.equal(nextLockedWorld([])?.id, 'world_flood');
  assert.equal(nextLockedWorld(['tasks_world_hub_complete', 'tasks_world_flood_complete']), null);
});

test('portal entre mundos inativo sem flag', () => {
  const inter = HUB_PORTALS.find((p) => p.id === 'portal_hub_to_flood')!;
  assert.equal(portalIsActive(inter, []), false);
  assert.equal(portalIsActive(inter, ['tasks_world_hub_complete']), true);
});

test('atalho local sempre ativo', () => {
  const local = HUB_PORTALS.find((p) => p.id === 'portal_hub_district_shortcut')!;
  assert.equal(portalIsActive(local, []), true);
  const travel = resolveTravel(local, []);
  assert.equal(travel.ok, true);
  if (travel.ok) assert.equal(travel.kind, 'local');
});

test('resolveTravel world após flag', () => {
  const inter = HUB_PORTALS.find((p) => p.id === 'portal_hub_to_flood')!;
  const travel = resolveTravel(inter, ['tasks_world_hub_complete']);
  assert.equal(travel.ok, true);
  if (travel.ok && travel.kind === 'world') {
    assert.equal(travel.worldTo, 'world_flood');
  }
});

test('findPortalAt por posição', () => {
  const local = HUB_PORTALS.find((p) => p.id === 'portal_hub_district_shortcut')!;
  const [x, , z] = local.position;
  assert.equal(findPortalAt(HUB_PORTALS, x, z, [])?.id, local.id);
  assert.equal(findPortalAt(HUB_PORTALS, x + 50, z + 50, []), null);
});

test('estado: flags, activated e world travel', () => {
  let s = INITIAL_PORTAL_STATE;
  s = addFlag(s, 'tasks_world_hub_complete');
  assert.ok(s.flags.includes('tasks_world_hub_complete'));
  s = markPortalActivated(s, 'portal_hub_to_flood');
  s = applyWorldTravel(s, 'world_flood');
  assert.equal(s.currentWorldId, 'world_flood');
  assert.ok(WORLD_CATALOG.length >= 2);
});
