import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOracleWorldActions } from './oracleWorldActions';

test('accepts only bounded, catalog-backed world commands', () => {
  const actions = parseOracleWorldActions([
    { type: 'set_weather', weather: 'acid_rain' },
    { type: 'set_time', timeOfDay: 0.75 },
    { type: 'create_structure', assetId: 'module_watchtower', x: 12, z: -8 },
    { type: 'create_structure', assetId: 'module_unknown', x: 0, z: 0 },
    { type: 'create_structure', assetId: 'module_bridge_segment', x: 2, z: 2 },
    { type: 'create_structure', assetId: 'module_watchtower', x: 999, z: 0 },
    { type: 'run_code', code: 'window.alert(1)' },
  ]);
  assert.equal(actions.length, 3);
  assert.deepEqual(actions[0], { type: 'set_weather', weather: 'acid_rain' });
  assert.deepEqual(actions[1], { type: 'set_time', timeOfDay: 0.75 });
});

test('rejects malformed weather, time and coordinates', () => {
  assert.deepEqual(parseOracleWorldActions([
    { type: 'set_weather', weather: 'unknown' },
    { type: 'set_time', timeOfDay: 4 },
    { type: 'create_structure', assetId: 'module_watchtower', x: Number.NaN, z: 0 },
  ]), []);
});

test('caps each model response to four actions', () => {
  const actions = parseOracleWorldActions(Array.from({ length: 8 }, () => ({ type: 'set_weather', weather: 'rain' })));
  assert.equal(actions.length, 4);
});
test('accepts only valid new residents and known professions', () => {
  const actions = parseOracleWorldActions([
    { type: 'spawn_agent', displayName: 'Luna', profession: 'worker', x: 8, z: 12 },
    { type: 'spawn_agent', displayName: 'Cowila', profession: 'agent', x: 8, z: 12 },
    { type: 'spawn_agent', displayName: 'Invalid', profession: 'oracle', x: 8, z: 12 },
    { type: 'spawn_agent', displayName: 'Outside', profession: 'worker', x: 500, z: 12 },
  ]);
  assert.deepEqual(actions, [{ type: 'spawn_agent', displayName: 'Luna', profession: 'worker', x: 8, z: 12 }]);
});