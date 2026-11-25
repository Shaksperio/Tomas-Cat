import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCowilaTrainingPrompt } from './index';

test('training identity is a real AI lab, not the Tomas game narrative', () => {
  const prompt = buildCowilaTrainingPrompt('Quem sou eu?', []);
  assert.match(prompt, /ambiente real de desenvolvimento de IA/);
  assert.match(prompt, /responsável pelo projeto e treinador humano/);
  assert.match(prompt, /não é Oráculo, NPC, personagem/);
  assert.match(prompt, /nunca como O Escolhido/);
  assert.match(prompt, /não faz parte deste ambiente de treinamento/);
  assert.doesNotMatch(prompt, /"world"\s*:/);
  assert.doesNotMatch(prompt, /"setting"\s*:/);
});

test('training prompt preserves only the explicitly supplied conversation context', () => {
  const prompt = buildCowilaTrainingPrompt('Explique seu objetivo.', [
    { role: 'user', content: 'Quero avaliar seu raciocínio.' },
    { role: 'assistant', content: 'Vou explicar meu raciocínio com clareza.' },
  ]);
  assert.match(prompt, /Quero avaliar seu raciocínio/);
  assert.match(prompt, /Explique seu objetivo/);
  assert.doesNotMatch(prompt, /"role":"O Escolhido"/);
});
