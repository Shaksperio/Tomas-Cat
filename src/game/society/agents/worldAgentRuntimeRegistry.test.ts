import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SocietySimulation } from '../simulation.ts';
import { WorldAgentRuntimeRegistry } from './worldAgentRuntimeRegistry.ts';

test('cria runtime isolado por mundo', () => {
  const reg = new WorldAgentRuntimeRegistry(['world_hub', 'world_flood'], { cowilaEveryTicks: 5 });
  assert.deepEqual(reg.registeredWorldIds, ['world_hub', 'world_flood']);
  const a = reg.runtimeFor('world_hub');
  const b = reg.runtimeFor('world_flood');
  assert.notEqual(a, b);
});

test('reset recria runtime sem afetar o outro mundo', () => {
  const reg = new WorldAgentRuntimeRegistry(['world_hub', 'world_flood'], { cowilaEveryTicks: 5 });
  const hub = reg.runtimeFor('world_hub');
  hub.step(new SocietySimulation(), 3);
  const floodBefore = reg.runtimeFor('world_flood');
  const hub2 = reg.reset('world_hub');
  assert.notEqual(hub, hub2);
  assert.equal(reg.runtimeFor('world_flood'), floodBefore);
});

test('mundo desconhecido lança', () => {
  const reg = new WorldAgentRuntimeRegistry(['world_hub']);
  assert.throws(() => reg.runtimeFor('nope'));
});
