import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SocietySimulation } from '../simulation.ts';
import {
  emptyAgentMemory,
  formatAgentMemoryBrief,
  ingestEventsIntoMemory,
  memoryForAgent,
} from './agentMemory.ts';
import {
  blueprintToProposedProject,
  COWILA_APPROVED_ASSETS,
  runCowilaStrategicCycle,
} from './cowilaCoordinator.ts';
import { validateConstructionProject } from '../contracts.ts';

test('memória ingere task_completed de forma idempotente', () => {
  const sim = new SocietySimulation();
  sim.step(40);
  const snap = sim.snapshot();
  const events = snap.events.filter((e) => e.kind === 'task_completed');
  assert.ok(events.length > 0, 'simulação deve gerar conclusões de tarefa');

  let book = emptyAgentMemory();
  book = ingestEventsIntoMemory(book, events, snap.tick);
  const again = ingestEventsIntoMemory(book, events, snap.tick);
  assert.deepEqual(book, again);

  const someAgent = events[0]?.payload && (events[0].payload as { agentId?: string }).agentId;
  assert.ok(typeof someAgent === 'string');
  const entries = memoryForAgent(book, someAgent!);
  assert.ok(entries.length >= 1);
  assert.match(formatAgentMemoryBrief(book, someAgent!), /Concluiu/);
});

test('Cowila produz diretiva determinística com blueprint aprovado', () => {
  const snap = new SocietySimulation().snapshot();
  const a = runCowilaStrategicCycle(snap);
  const b = runCowilaStrategicCycle(snap);
  assert.deepEqual(a, b);
  assert.equal(a.mode, 'deterministic-strategic');
  assert.ok(a.brief.length > 5);
  assert.ok(a.blueprints.length >= 1);
  assert.ok(COWILA_APPROVED_ASSETS.includes(a.blueprints[0].assetId));
});

test('blueprint da Cowila vira projeto validável', () => {
  const snap = new SocietySimulation().snapshot();
  const directive = runCowilaStrategicCycle(snap);
  const engineer = snap.agents.find((x) => x.profession === 'engineer');
  assert.ok(engineer);
  const project = blueprintToProposedProject(directive.blueprints[0], engineer!.id, snap.tick);
  const result = validateConstructionProject(project);
  assert.equal(result.valid, true, result.reason);
  assert.equal(project.status, 'proposed');
});

test('foco de recurso responde a escassez de comida', () => {
  const base = new SocietySimulation().snapshot();
  const scarce = {
    ...base,
    resources: { ...base.resources, food: 2 },
  };
  const d = runCowilaStrategicCycle(scarce);
  assert.equal(d.resourceFocus, 'food');
  assert.equal(d.blueprints[0]?.assetId, 'module_farm_plot');
  assert.ok((d.professionPriority.farmer ?? 0) >= 90);
});
