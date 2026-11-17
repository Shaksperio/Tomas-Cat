import assert from 'node:assert/strict';
import test from 'node:test';
import { createEquipmentState, getEquipmentBonuses, normalizeEquipment } from './equipment';

test('aplica bônus dos slots de equipamento', () => {
  const equipment = { ...createEquipmentState(), collar: 'reinforced_collar' as const, harness: 'scavenger_harness' as const };
  assert.deepEqual(getEquipmentBonuses(equipment), { maxHealth: 15, maxStamina: 20, attackPercent: 0, sonarRadius: 0 });
});

test('soma arma, armadura, roupa e aparato', () => {
  const equipment = { ...createEquipmentState(), weapon: 'tempered_claws' as const, armor: 'plated_vest' as const, clothing: 'wool_scarf' as const, gadget: 'sonar_whisker' as const };
  assert.deepEqual(getEquipmentBonuses(equipment), { maxHealth: 38, maxStamina: 10, attackPercent: 18, sonarRadius: 8 });
});

test('normaliza saves antigos e rejeita IDs inválidos ou no slot errado', () => {
  assert.deepEqual(normalizeEquipment(undefined), createEquipmentState());
  assert.deepEqual(normalizeEquipment({ collar: 'not-an-item', harness: 'scavenger_harness', weapon: 'plated_vest' }), {
    ...createEquipmentState(), harness: 'scavenger_harness',
  });
  assert.deepEqual(normalizeEquipment({ collar: 'reinforced_collar' }).collar, 'reinforced_collar');
});
