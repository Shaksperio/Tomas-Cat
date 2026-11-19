import test from 'node:test';
import assert from 'node:assert/strict';
import { SocietySimulation } from './simulation';

test('Cowila creates a resident that becomes part of the persistent society', () => {
  const society = new SocietySimulation();
  const created = society.spawnOracleAgent({ id: 'oracle-agent-luna-01', displayName: 'Luna', profession: 'worker', x: 24, z: 18 });
  assert.equal(created, true);
  const snapshot = society.snapshot();
  assert.equal(snapshot.agents.length, 10);
  assert.equal(snapshot.agents.some((agent) => agent.id === 'oracle-agent-luna-01' && agent.displayName === 'Luna'), true);
  assert.equal(snapshot.tasks.some((task) => task.id === 'oracle-agent-task-oracle-agent-luna-01'), true);
  const restored = new SocietySimulation();
  assert.equal(restored.restoreState(society.exportState()), true);
  assert.equal(restored.snapshot().agents.some((agent) => agent.displayName === 'Luna'), true);
});

test('rejects duplicate, out-of-bounds and Oraculo-identifying residents', () => {
  const society = new SocietySimulation();
  assert.equal(society.spawnOracleAgent({ id: 'oracle-agent-cowila-01', displayName: 'Cowila', profession: 'agent', x: 20, z: 20 }), false);
  assert.equal(society.spawnOracleAgent({ id: 'oracle-agent-oraculo-01', displayName: 'Oráculo', profession: 'agent', x: 20, z: 20 }), false);
  assert.equal(society.spawnOracleAgent({ id: 'oracle-agent-outside-01', displayName: 'Nilo', profession: 'worker', x: 999, z: 20 }), false);
  assert.equal(society.spawnOracleAgent({ id: 'oracle-agent-iris-01', displayName: 'Íris', profession: 'worker', x: 20, z: 20 }), false);
  assert.equal(society.spawnOracleAgent({ id: 'oracle-agent-nilo-01', displayName: 'Nilo', profession: 'worker', x: 20, z: 20 }), true);
});