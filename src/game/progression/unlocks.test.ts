import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNewlyUnlockedMoves, getUnlockedMovesForLevel, mergeUnlockedMoves } from './unlocks.ts';

test('nível inicial mantém apenas a técnica básica', () => {
  assert.deepEqual(getUnlockedMovesForLevel(1), ['basic-claw']);
});

test('desbloqueia todas as técnicas atravessadas em uma subida de vários níveis', () => {
  assert.deepEqual(getNewlyUnlockedMoves(4, 26).map((move) => move.id), [
    'double-scratch', 'fierce-claw', 'lunar-sequence',
  ]);
});

test('técnicas de combo do catálogo correspondem aos comandos executáveis nos níveis corretos', () => {
  const level25 = getNewlyUnlockedMoves(24, 25);
  assert.deepEqual(level25.map(({ id, name, command }) => ({ id, name, command })), [
    { id: 'lunar-sequence', name: 'Rasante Duplo', command: 'combo_a' },
  ]);
  const level55 = getNewlyUnlockedMoves(54, 55);
  assert.deepEqual(level55.map(({ id, name, command }) => ({ id, name, command })), [
    { id: 'shadow-combo', name: 'Tempestade de Garras', command: 'combo_b' },
  ]);
});

test('nível é limitado ao intervalo válido', () => {
  assert.deepEqual(getUnlockedMovesForLevel(0), ['basic-claw']);
  assert.equal(getUnlockedMovesForLevel(100).length, 9);
});

test('migração combina técnicas antigas salvas com desbloqueios por nível sem duplicar', () => {
  assert.deepEqual(mergeUnlockedMoves(12, ['lunar-sequence', 'double-scratch', 'invalid']), [
    'basic-claw', 'double-scratch', 'fierce-claw', 'lunar-sequence',
  ]);
});
