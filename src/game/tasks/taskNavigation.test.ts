import assert from 'node:assert/strict';
import test from 'node:test';
import { selectFirstAvailableTaskGpsTarget, selectTaskGpsTarget } from './taskNavigation';

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


test('prioriza o pedido aceito do habitante antes das missões cíclicas', () => {
  const objectives = [
    { event: 'scrap_collected' as const, objective: 'Recolha sucata para Íris', taskTitle: 'Materiais para Íris' },
    { event: 'food_collected' as const, objective: 'Recolher alimentos', taskTitle: 'Suprimentos da cidade' },
  ];
  const target = selectFirstAvailableTaskGpsTarget(objectives, { x: 0, z: 0 }, candidates);
  assert.equal(target?.id, 'food-near-a');
  assert.equal(target?.taskTitle, 'Suprimentos da cidade');
});

test('usa o próximo objetivo com destino físico quando a tarefa prioritária não tem alvo', () => {
  const objectives = [
    { event: 'shelter_upgraded' as const, objective: 'Melhore um abrigo', taskTitle: 'Reparo para Nina' },
    { event: 'water_drunk' as const, objective: 'Beba água', taskTitle: 'Água para o depósito' },
  ];
  const target = selectFirstAvailableTaskGpsTarget(objectives, { x: 0, z: 0 }, candidates);
  assert.equal(target?.id, 'water');
  assert.equal(target?.taskTitle, 'Água para o depósito');
});

test('permite direcionar pedidos de melhoria ao abrigo físico', () => {
  const shelter = { id: 'shelter-01', label: 'Abrigo comunitário', event: 'shelter_upgraded' as const, x: 8, y: 0, z: -6 };
  const target = selectFirstAvailableTaskGpsTarget(
    [{ event: 'shelter_upgraded', objective: 'Melhore um abrigo', taskTitle: 'Reparo para Nina' }],
    { x: 0, z: 0 },
    [shelter],
  );
  assert.equal(target?.id, 'shelter-01');
  assert.equal(target?.distance, 10);
});
