import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, scatterPlacements } from './artDirection.ts';

const rules = {
  bounds: 220,
  spawnRadius: 14,
  roadHalfWidth: 9,
  isBlocked: (x: number, z: number, m: number) => Math.hypot(x - 60, z - 60) < 20 + m,
};

test('o gerador é determinístico', () => {
  const a = createRng(7);
  const b = createRng(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('a vegetação respeita limites, avenidas, spawn e obstáculos', () => {
  const placements = scatterPlacements(300, 42, 2, rules);
  assert.ok(placements.length > 200);
  for (const p of placements) {
    assert.ok(Math.abs(p.x) <= 212 && Math.abs(p.z) <= 212);
    assert.ok(Math.abs(p.x) >= 9 && Math.abs(p.z) >= 9);
    assert.ok(Math.hypot(p.x, p.z) >= 14);
    assert.equal(rules.isBlocked(p.x, p.z, 2), false);
  }
  assert.deepEqual(scatterPlacements(50, 1, 2, rules), scatterPlacements(50, 1, 2, rules));
});
