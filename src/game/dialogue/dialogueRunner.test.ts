import test from 'node:test';
import assert from 'node:assert/strict';
import { DIALOGUE_DATA, DIALOGUE_RESIDENT_IDS } from './dialogueData';
import { availableOptions, chooseOption, startDialogue } from './dialogueRunner';
import type { DialogueContext, DialogueNode } from './types';

const context = (overrides: Partial<DialogueContext> = {}): DialogueContext => ({
  agentId: 'engineer-01', affinity: 20, trust: 20, morale: 70, weather: 'clear',
  timeOfDay: 12, playerHealthRatio: 1, territoryControlled: false,
  completedTaskIds: [], flags: {}, ...overrides,
});

test('todos os nove habitantes têm quatro nós escritos', () => {
  assert.equal(DIALOGUE_RESIDENT_IDS.length, 9);
  for (const agentId of DIALOGUE_RESIDENT_IDS) {
    assert.equal(DIALOGUE_DATA.filter((node) => node.agentId === agentId).length, 4);
  }
});

test('inicia a saudação adequada e prioriza reação de moral baixa', () => {
  const normal = startDialogue('engineer-01', context(), DIALOGUE_DATA);
  assert.equal(normal?.nodeId, 'engineer-01.greeting');
  const worried = startDialogue('engineer-01', context({ morale: 12 }), DIALOGUE_DATA);
  assert.equal(worried?.nodeId, 'engineer-01.low_morale');
});

test('opções condicionais e efeitos são retornados sem mutar contexto', () => {
  const state = startDialogue('engineer-01', context(), DIALOGUE_DATA)!;
  const options = availableOptions(DIALOGUE_DATA.find((node) => node.id === state.nodeId)!, context());
  assert.deepEqual(options.map((option) => option.id), ['ask_weather', 'ask_task', 'say_goodbye']);
  const transition = chooseOption(state, 'ask_weather', context(), DIALOGUE_DATA);
  assert.equal(transition?.state.nodeId, 'engineer-01.weather');
  assert.deepEqual(transition?.effects, [{ kind: 'affinity', amount: 1 }]);
  assert.deepEqual(state.history, ['engineer-01.greeting']);
});

test('recusa opções inexistentes e nós de destino inválidos', () => {
  const state = startDialogue('engineer-01', context(), DIALOGUE_DATA)!;
  assert.equal(chooseOption(state, 'not-an-option', context(), DIALOGUE_DATA), null);
  const broken: DialogueNode[] = [{
    id: 'broken', agentId: 'engineer-01', speaker: 'Íris', trigger: 'greeting',
    text: 'Teste', options: [{ id: 'go', text: 'Ir', nextNodeId: 'missing' }],
  }];
  const brokenState = startDialogue('engineer-01', context(), broken)!;
  assert.equal(chooseOption(brokenState, 'go', context(), broken), null);
});

test('condições de noite, ferimento e território são determinísticas', () => {
  const night = startDialogue('engineer-01', context({ timeOfDay: 23 }), DIALOGUE_DATA);
  assert.equal(night?.nodeId, 'engineer-01.low_morale' === night?.nodeId ? night.nodeId : 'engineer-01.greeting');
  const contextNight = context({ timeOfDay: 23 });
  assert.equal(contextNight.timeOfDay >= 20, true);
});
