import assert from 'node:assert/strict';
import test from 'node:test';
import { selectTaskGpsTarget } from './taskNavigation';

const candidates = [
  { id: 'food-far', label: 'Comida distante', event: 'food_collected' as const, x: 12, y: 0, z: 0 },
  { id: 'food-near-b', label: 'Comida próxima B', event: 'food_collected' as const, x: 3, y: 0, z: 4 },
  { id: 'food-near-a', label: 'Comida próxima A', event: 'food_collected' as const, x: -3, y: 0, z: -4 },
  { id: 'water', label: 'Água', event: 'water_drunk' as const, x: 1, y: 0, z: 1 },
];

test('seleciona o alvo mais próximo do tipo exigido pela etapa', () => {
  const target = selectTaskGpsTarget('food_collected', { x: 0, z: 0 }, candidates, 'Recolher comida', 'Suprimentos');
  assert.equal(target?.id, 'food-near-a');
  assert.equal(target?.distance, 5);
  assert.equal(target?.objective, 'Recolher comida');
});

test('desempata por ID de forma determinística e ignora outros objetivos', () => {
  const target = selectTaskGpsTarget('food_collected', { x: 0, z: 0 }, candidates.slice(1, 3), 'Objetivo', 'Missão');
  assert.equal(target?.id, 'food-near-a');
});

test('retorna null quando não existe alvo ativo para a etapa', () => {
  assert.equal(selectTaskGpsTarget('scrap_collected', { x: 0, z: 0 }, candidates, 'Sucata', 'Materiais'), null);
});
