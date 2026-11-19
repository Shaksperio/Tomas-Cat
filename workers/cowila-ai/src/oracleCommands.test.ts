import test from 'node:test';
import assert from 'node:assert/strict';
import { inferExplicitOracleActions } from './oracleCommands';
const world = { position: { x: 10, z: 20 } };

test('interprets explicit weather and time orders deterministically', () => {
  assert.deepEqual(inferExplicitOracleActions('Cowila, faça chover agora.', world), [{ type: 'set_weather', weather: 'rain' }]);
  assert.deepEqual(inferExplicitOracleActions('Mude o horário para meia-noite.', world), [{ type: 'set_time', timeOfDay: 0 }]);
  assert.deepEqual(inferExplicitOracleActions('Transforme o dia em amanhecer.', world), [{ type: 'set_time', timeOfDay: 0.25 }]);
});

test('creates approved structures near the current player position', () => {
  assert.deepEqual(inferExplicitOracleActions('Construa uma torre de vigia perto de mim.', world), [{ type: 'create_structure', assetId: 'module_watchtower', x: 19, z: 29 }]);
  assert.deepEqual(inferExplicitOracleActions('Crie um abrigo.', world), [{ type: 'create_structure', assetId: 'module_shelter_basic', x: 19, z: 29 }]);
});

test('creates named residents with the requested profession', () => {
  assert.deepEqual(inferExplicitOracleActions('Crie uma nova habitante chamada Luna, profissão trabalhadora, perto da praça.', world), [{ type: 'spawn_agent', displayName: 'Luna', profession: 'worker', x: 15, z: 25 }]);
  assert.deepEqual(inferExplicitOracleActions('Crie um habitante chamado Nilo, profissão engenheiro.', world), [{ type: 'spawn_agent', displayName: 'Nilo', profession: 'engineer', x: 15, z: 25 }]);
});

test('does not turn ordinary questions or forbidden Oracle identities into world commands', () => {
  assert.deepEqual(inferExplicitOracleActions('Como está o clima hoje?', world), []);
  assert.deepEqual(inferExplicitOracleActions('Crie uma habitante chamada Cowila.', world), []);
  assert.deepEqual(inferExplicitOracleActions('Crie uma habitante chamada Oráculo.', world), []);
  assert.deepEqual(inferExplicitOracleActions('Crie uma habitante.', world), []);
});