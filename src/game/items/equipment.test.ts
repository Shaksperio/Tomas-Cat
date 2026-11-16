import assert from 'node:assert/strict';
import test from 'node:test';
import { createEquipmentState, getEquipmentBonuses, normalizeEquipment } from './equipment';

test('aplica bônus dos dois slots de equipamento', () => {
  const equipment = { collar: 'reinforced_collar' as const, harness: 'scavenger_harness' as const };
  assert.deepEqual(getEquipmentBonuses(equipment), { maxHealth: 15, maxStamina: 20 });
});

test('normaliza saves antigos e rejeita IDs inválidos', () => {
  assert.deepEqual(normalizeEquipment(undefined), createEquipmentState());
  assert.deepEqual(normalizeEquipment({ collar: 'not-an-item', harness: 'scavenger_harness' }), {
    collar: null, harness: 'scavenger_harness',
  });
});
