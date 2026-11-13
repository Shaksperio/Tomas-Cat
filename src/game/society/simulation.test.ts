import assert from 'node:assert/strict';
import test from 'node:test';
import { SocietySimulation } from './simulation';

test('creates a deterministic starter neighborhood with three professions', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.snapshot();
  assert.equal(snapshot.agents.length, 4);
  assert.deepEqual(
    [...new Set(snapshot.agents.map((agent) => agent.profession))].sort(),
    ['agent', 'engineer', 'worker'],
  );
  assert.equal(snapshot.relationships.length, 3);
});

test('assigns work to matching professions and completes tasks over logical ticks', () => {
  const simulation = new SocietySimulation();
  const first = simulation.step(1);
  assert.ok(first.agents.every((agent) => agent.activeTaskId !== null));
  const finished = simulation.step(8);
  assert.ok(finished.tasks.some((task) => task.status === 'completed'));
  assert.ok(finished.events.some((event) => event.kind === 'task_completed'));
});

test('produces the same state for the same number of logical steps', () => {
  const first = new SocietySimulation().step(12);
  const second = new SocietySimulation().step(12);
  assert.deepEqual(first, second);
});

test('returns defensive snapshots that cannot mutate simulation state', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.snapshot();
  snapshot.agents[0].needs.hunger = 0;
  snapshot.tasks[0].dependencies.push('tampered');
  const fresh = simulation.snapshot();
  assert.notEqual(fresh.agents[0].needs.hunger, 0);
  assert.equal(fresh.tasks[0].dependencies.includes('tampered'), false);
});

test('caps a requested simulation advance to a bounded number of ticks', () => {
  const simulation = new SocietySimulation();
  assert.equal(simulation.step(5000).tick, 1000);
});
