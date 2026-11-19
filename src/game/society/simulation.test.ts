import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_WALLET, SocietySimulation } from './simulation';

test('creates a deterministic starter neighborhood with eight professions', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.snapshot();
  assert.equal(snapshot.agents.length, 9);
  assert.deepEqual(
    [...new Set(snapshot.agents.map((agent) => agent.profession))].sort(),
    ['agent', 'carpenter', 'engineer', 'farmer', 'lumberjack', 'merchant', 'miner', 'worker'],
  );
  assert.equal(snapshot.relationships.length, 6);
});

test('assigns work to matching professions and completes tasks over logical ticks', () => {
  const simulation = new SocietySimulation();
  const first = simulation.step(1);
  const assignedTasks = first.tasks.filter((task) => task.status === 'assigned' || task.status === 'in_progress');
  // O carpinteiro aguarda madeira acima da reserva de construção; os demais já recebem trabalho.
  assert.equal(assignedTasks.length, 7);
  assert.equal(first.tasks.find((task) => task.id === 'task-craft-01')?.status, 'queued');
  assert.ok(assignedTasks.every((task) => {
    const agent = first.agents.find((candidate) => candidate.id === task.assignedAgentId);
    return agent?.activeTaskId === task.id;
  }));
  const finished = simulation.step(40);
  assert.ok(finished.tasks.some((task) => task.status === 'completed'));
  assert.ok(finished.events.some((event) => event.kind === 'task_completed'));
});

test('deterministic specialist cycle enqueues and completes real society tasks', () => {
  const simulation = new SocietySimulation();
  let specialistCreated = false;
  let specialistCompleted = false;

  for (let tick = 0; tick < 240; tick += 1) {
    const snapshot = simulation.step(1);
    specialistCreated ||= snapshot.events.some((event) =>
      event.kind === 'task_created'
      && typeof event.payload.taskId === 'string'
      && event.payload.taskId.startsWith('specialist:'),
    );
    specialistCompleted ||= snapshot.events.some((event) =>
      event.kind === 'task_completed'
      && typeof event.payload.taskId === 'string'
      && event.payload.taskId.startsWith('specialist:'),
    );
    if (specialistCreated && specialistCompleted) break;
  }

  assert.equal(specialistCreated, true, 'expected the specialist cycle to enqueue an authorized task');
  assert.equal(specialistCompleted, true, 'expected the normal scheduler to execute a specialist task');
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
  snapshot.resources.wood = 999;
  const fresh = simulation.snapshot();
  assert.notEqual(fresh.agents[0].needs.hunger, 0);
  assert.equal(fresh.tasks[0].dependencies.includes('tampered'), false);
  assert.notEqual(fresh.resources.wood, 999);
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
  const snapshot = simulation.step(120);
  assert.ok(snapshot.tasks.some((task) => task.kind === 'prepare_site'));
  assert.ok(snapshot.tasks.some((task) => task.kind === 'build_module'));
  assert.ok(snapshot.tasks.some((task) => task.kind === 'build_module' && task.status === 'completed'));
  assert.ok(snapshot.events.some((event) => event.kind === 'project_started'));
  assert.ok(snapshot.events.some((event) => event.kind === 'project_completed'));
  assert.ok(snapshot.events.some((event) => event.kind === 'resource_changed'
    && event.payload.reason === 'construction_consumption'));
  assert.ok(snapshot.events.filter((event) => event.kind === 'resource_changed').length >= 4);
});


test('farmer cultivates, harvests food and residents consume community meals', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.step(320);
  assert.ok(snapshot.tasks.some((task) => task.kind === 'cultivate_field' && task.status === 'completed'));
  assert.ok(snapshot.tasks.some((task) => task.kind === 'harvest_food' && task.status === 'completed'));
  assert.ok(snapshot.events.some((event) => event.kind === 'resource_changed'
    && event.payload.reason === 'crop_harvest'));
  assert.ok(snapshot.events.some((event) => event.kind === 'resource_changed'
    && event.payload.reason === 'community_meal'));
  assert.ok(snapshot.resources.food >= 0);
  assert.ok(snapshot.agents.every((agent) => agent.needs.hunger >= 0 && agent.needs.hunger <= 100));
});

test('records deterministic social interactions and relationship growth', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.step(320);
  assert.ok(snapshot.events.some((event) => event.kind === 'social_interaction'));
  assert.ok(snapshot.events.some((event) => event.kind === 'relationship_changed'));
  assert.ok(snapshot.relationships.every((relationship) =>
    relationship.trust >= 0 && relationship.trust <= 100
    && relationship.affinity >= 0 && relationship.affinity <= 100,
  ));
  assert.ok(snapshot.relationships.some((relationship) => relationship.interactionCount >= 5));
});


test('lumberjack, miner and carpenter produce and transform materials', () => {
  const snapshot = new SocietySimulation().step(150);
  const reasons = new Set(snapshot.events
    .filter((event) => event.kind === 'resource_changed')
    .map((event) => event.payload.reason));
  for (const reason of ['lumber_production', 'quarry_production', 'carpentry_production', 'crafting_consumption']) {
    assert.ok(reasons.has(reason), `missing resource reason: ${reason}`);
  }
  assert.ok(snapshot.resources.planks > 0);
});

test('the carpenter never consumes the wood reserved for construction', () => {
  const simulation = new SocietySimulation();
  for (let tick = 0; tick < 400; tick += 1) {
    const snapshot = simulation.step(1);
    const craftingEvents = snapshot.events.filter((event) => event.tick === snapshot.tick
      && event.kind === 'resource_changed' && event.payload.reason === 'crafting_consumption');
    for (const event of craftingEvents) {
      assert.ok(Number(event.payload.current) >= 4, `wood fell below the reserve at tick ${snapshot.tick}`);
    }
  }
});

test('the merchant sells surplus goods for coins and buys food during shortages', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.step(200);
  const trades = snapshot.events.filter((event) => event.kind === 'trade_completed');
  assert.ok(trades.length > 0);
  assert.ok(snapshot.resources.coins > 0);
  assert.ok(snapshot.events.some((event) => event.kind === 'resource_changed'
    && event.payload.reason === 'trade_sale'));

  const internals = simulation as unknown as { resources: { food: number; coins: number } };
  internals.resources.food = 0;
  internals.resources.coins = 30;
  const afterShortage = simulation.step(40);
  assert.ok(afterShortage.events.some((event) => event.kind === 'resource_changed'
    && event.payload.reason === 'trade_purchase'));
});

test('the community consumes firewood and maintenance planks, and unmet needs lower morale', () => {
  const met = new SocietySimulation().step(130);
  assert.ok(met.events.some((event) => event.kind === 'community_need_changed'
    && event.payload.need === 'firewood' && event.payload.met === true));
  assert.ok(met.events.some((event) => event.kind === 'resource_changed'
    && event.payload.reason === 'community_firewood'));
  assert.ok(met.events.some((event) => event.kind === 'resource_changed'
    && event.payload.reason === 'community_maintenance'));

  const simulation = new SocietySimulation();
  simulation.step(59);
  const internals = simulation as unknown as { resources: { wood: number } };
  const moraleBefore = simulation.snapshot().agents.map((agent) => agent.needs.morale);
  internals.resources.wood = 0;
  const after = simulation.step(1);
  assert.ok(after.events.some((event) => event.kind === 'community_need_changed'
    && event.payload.need === 'firewood' && event.payload.met === false));
  after.agents.forEach((agent, index) => {
    assert.ok(agent.needs.morale < moraleBefore[index] + 0.5, 'morale should not rise when a need is unmet');
  });
});

test('storage never exceeds warehouse capacity or goes negative over a long run', () => {
  const simulation = new SocietySimulation();
  for (let block = 0; block < 30; block += 1) {
    const { resources } = simulation.step(100);
    for (const resource of ['food', 'wood', 'stone', 'planks'] as const) {
      assert.ok(resources[resource] >= 0 && resources[resource] <= 60, `${resource}=${resources[resource]}`);
    }
    assert.ok(resources.coins >= 0 && resources.coins <= 999);
  }
});

test('the community keeps eating and working after a long run, without unbounded task growth', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.step(1000);
  const later = simulation.step(1000);
  assert.ok(later.tasks.length < 160, `task list grew to ${later.tasks.length}`);
  assert.ok(later.tasks.some((task) => task.kind === 'harvest_food' && task.status !== 'queued'));
  assert.ok(later.agents.every((agent) => agent.needs.hunger < 100));
  assert.ok(snapshot.tick === 1000 && later.tick === 2000);
});

test('repeating professions stay near their workplaces instead of drifting away', () => {
  const simulation = new SocietySimulation();
  simulation.step(1000);
  const snapshot = simulation.step(1000);
  for (const agent of snapshot.agents) {
    assert.ok(Math.hypot(agent.position.x, agent.position.z) < 25,
      `${agent.id} wandered to (${agent.position.x.toFixed(1)}, ${agent.position.z.toFixed(1)})`);
  }
});

test('the treasury pays wages on payday to everyone who worked, and wallets match the payments', () => {
  const simulation = new SocietySimulation();
  const snapshot = simulation.step(100);
  const payday = snapshot.events.find((event) => event.kind === 'wage_paid');
  assert.ok(payday, 'expected a wage_paid event at tick 100');
  const paid = payday.payload.paid as Array<{ agentId: string; amount: number }>;
  assert.ok(paid.length > 0);
  const totalPaid = paid.reduce((sum, entry) => sum + entry.amount, 0);
  assert.equal(snapshot.agents.reduce((sum, agent) => sum + agent.wallet - INITIAL_WALLET, 0), totalPaid);
  for (const entry of paid) {
    assert.equal(snapshot.agents.find((agent) => agent.id === entry.agentId)?.wallet, INITIAL_WALLET + entry.amount);
  }
});

test('unpaid wages are reported and lower morale when the treasury is empty', () => {
  const simulation = new SocietySimulation();
  simulation.step(99);
  const internals = simulation as unknown as { resources: { coins: number } };
  const moraleBefore = new Map(simulation.snapshot().agents.map((agent) => [agent.id, agent.needs.morale]));
  internals.resources.coins = 0;
  const snapshot = simulation.step(1);
  const payday = snapshot.events.find((event) => event.kind === 'wage_paid' && event.tick === 100);
  assert.ok(payday);
  const unpaid = payday.payload.unpaid as string[];
  assert.ok(unpaid.length > 0, 'expected unpaid agents with an empty treasury');
  for (const id of unpaid) {
    const agent = snapshot.agents.find((candidate) => candidate.id === id)!;
    assert.equal(agent.wallet, INITIAL_WALLET);
    assert.ok(agent.needs.morale < (moraleBefore.get(id) ?? 100));
  }
});

test('duel outcomes move coins and health of a resident within safe limits', () => {
  const simulation = new SocietySimulation();
  const id = simulation.snapshot().agents[0].id;
  assert.equal(simulation.applyDuelOutcome(id, { coins: -30, health: -20 }), true);
  let agent = simulation.snapshot().agents[0];
  assert.equal(agent.wallet, INITIAL_WALLET - 30);
  assert.equal(agent.health, 80);
  simulation.applyDuelOutcome(id, { coins: -9999, health: -9999 });
  agent = simulation.snapshot().agents[0];
  assert.equal(agent.wallet, 0);
  assert.ok(agent.health >= 25, 'a duel never leaves a resident with less than 25 health');
  assert.equal(simulation.applyDuelOutcome('ninguem', { coins: 1, health: 1 }), false);
});


test('governance suspension is enforced by the authoritative task scheduler', () => {
  const simulation = new SocietySimulation();
  const record = simulation.reportAgentViolation({
    id: 'violation-worker-01',
    agentId: 'worker-01',
    kind: 'unauthorized_action',
    tick: 0,
    evidenceId: 'evidence-worker-01',
    verified: true,
  });
  assert.equal(record.status, 'suspended');
  const snapshot = simulation.step(1);
  assert.equal(snapshot.agents.find((agent) => agent.id === 'worker-01')?.activeTaskId, null);
  assert.equal(snapshot.tasks.some((task) => task.assignedAgentId === 'worker-01'), false);
  assert.equal(simulation.getAgentDiscipline('worker-01').status, 'suspended');
});

test('unverified reports do not punish agents and reintegration requires review', () => {
  const simulation = new SocietySimulation();
  const unverified = simulation.reportAgentViolation({
    id: 'unverified-agent-01',
    agentId: 'worker-01',
    kind: 'policy_bypass',
    tick: 0,
    evidenceId: 'evidence-unverified',
    verified: false,
  });
  assert.equal(unverified.status, 'active');

  simulation.reportAgentViolation({
    id: 'verified-agent-01',
    agentId: 'worker-01',
    kind: 'unauthorized_action',
    tick: 0,
    evidenceId: 'evidence-verified',
    verified: true,
  });
  simulation.step(30);
  assert.equal(simulation.reinstateAgent('worker-01', false, true).status, 'suspended');
  assert.equal(simulation.reinstateAgent('worker-01', true, true).status, 'probation');
  assert.equal(simulation.getAgentDiscipline('worker-01').status, 'probation');
  simulation.step(60);
  assert.equal(simulation.getAgentDiscipline('worker-01').status, 'active');
});

test('repeated verified incitement permanently blocks the agent identity', () => {
  const simulation = new SocietySimulation();
  simulation.reportAgentViolation({
    id: 'incitement-one',
    agentId: 'agent-01',
    kind: 'verified_incitement',
    tick: 0,
    evidenceId: 'evidence-incitement-one',
    verified: true,
  });
  const blocked = simulation.reportAgentViolation({
    id: 'incitement-two',
    agentId: 'agent-01',
    kind: 'verified_incitement',
    tick: 1,
    evidenceId: 'evidence-incitement-two',
    verified: true,
  });
  assert.equal(blocked.status, 'permanently_blocked');
  assert.equal(simulation.step(1).agents.find((agent) => agent.id === 'agent-01')?.activeTaskId, null);
});


test('restores the complete society state and continues deterministically', () => {
  const uninterrupted = new SocietySimulation();
  uninterrupted.step(17);
  const state = uninterrupted.exportState();

  const restored = new SocietySimulation();
  assert.equal(restored.restoreState(state), true);
  assert.deepEqual(restored.snapshot(), uninterrupted.snapshot());
  assert.deepEqual(restored.exportState(), state);

  for (let tick = 0; tick < 45; tick += 1) {
    assert.deepEqual(restored.step(1), uninterrupted.step(1));
  }
  assert.deepEqual(restored.exportState(), uninterrupted.exportState());
});

test('restored task runtime preserves elapsed work instead of restarting tasks', () => {
  const simulation = new SocietySimulation();
  simulation.step(25);
  const state = simulation.exportState();
  const runtime = state.taskRuntime.find((entry) => entry.elapsedTicks > 0);
  assert.ok(runtime);
  assert.ok(runtime.elapsedTicks > 0);

  const restored = new SocietySimulation();
  assert.equal(restored.restoreState(state), true);
  assert.deepEqual(
    restored.exportState().taskRuntime.find((entry) => entry.taskId === runtime.taskId),
    runtime,
  );
});

test('rejects malformed society state without mutating the current simulation', () => {
  const simulation = new SocietySimulation();
  simulation.step(3);
  const before = simulation.exportState();
  const malformed = {
    ...before,
    schemaVersion: 99,
  } as unknown as ReturnType<typeof simulation.exportState>;

  assert.equal(simulation.restoreState(malformed), false);
  assert.deepEqual(simulation.exportState(), before);
});
