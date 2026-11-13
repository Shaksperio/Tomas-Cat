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
  const assignedTasks = first.tasks.filter((task) => task.status === 'assigned' || task.status === 'in_progress');
  assert.equal(assignedTasks.length, 3);
  assert.ok(assignedTasks.every((task) => {
    const agent = first.agents.find((candidate) => candidate.id === task.assignedAgentId);
    return agent?.activeTaskId === task.id;
  }));
  const finished = simulation.step(40);
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

test('waits for a completed prerequisite before assigning a follow-up task', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.step(40);
  const followUp = snapshot.tasks.find((task) => task.dependencies.length > 0);
  assert.ok(followUp);
  assert.ok(followUp.dependencies.every((id) =>
    snapshot.tasks.some((task) => task.id === id && task.status === 'completed'),
  ));
});

test('agents rest when exhausted and resume their assigned work after recovery', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.step(80);
  const agentsWithWork = snapshot.agents.filter((agent) => agent.activeTaskId !== null);
  assert.ok(agentsWithWork.length > 0);
  assert.ok(snapshot.agents.every((agent) => agent.energy >= 0 && agent.energy <= 100));
  assert.ok(snapshot.agents.every((agent) => agent.status !== 'working' || agent.energy > 0));
});

test('agents travel toward deterministic work sites before completing tasks', () => {
  const simulation = new SocietySimulation();
  const before = simulation.snapshot().agents.find((agent) => agent.id === 'worker-01');
  const after = simulation.step(5).agents.find((agent) => agent.id === 'worker-01');
  assert.ok(before && after);
  assert.notDeepEqual(after.position, before.position);
  assert.ok(['travelling', 'working'].includes(after.status));
});


test('worker completes the material-to-construction chain and emits a project completion event', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.step(320);
  assert.ok(snapshot.tasks.some((task) => task.kind === 'prepare_site'));
  assert.ok(snapshot.tasks.some((task) => task.kind === 'build_module'));
  assert.ok(snapshot.tasks.some((task) => task.kind === 'build_module' && task.status === 'completed'));
  assert.ok(snapshot.events.some((event) => event.kind === 'project_started'));
  assert.ok(snapshot.events.some((event) => event.kind === 'project_completed'));
});
