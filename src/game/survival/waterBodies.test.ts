import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceToSegment,
  findRiverAt,
  lakesAsWaterBodies,
  PHASE_LAKES,
  PHASE_RIVERS,
  riversForPhase,
} from './waterBodies.ts';

test('há pelo menos um lago por fase 1–4', () => {
  for (const p of [1, 2, 3, 4]) {
    assert.ok(PHASE_LAKES.some((l) => l.phase === p), `fase ${p}`);
  }
});

test('lakesAsWaterBodies gera WaterBody com floor abaixo da superfície', () => {
  const bodies = lakesAsWaterBodies(1);
  assert.ok(bodies.length >= 1);
  for (const b of bodies) {
    assert.ok(b.floorY < b.surfaceY);
    assert.ok(b.radius > 0);
  }
});

test('distanceToSegment: ponto no meio do segmento ≈ 0', () => {
  const d = distanceToSegment(0, 0, -10, 0, 10, 0);
  assert.ok(d < 1e-6);
  const off = distanceToSegment(0, 5, -10, 0, 10, 0);
  assert.ok(Math.abs(off - 5) < 1e-6);
});

test('findRiverAt encontra ponto dentro da meia-largura', () => {
  const r = PHASE_RIVERS[0];
  const mx = (r.ax + r.bx) / 2;
  const mz = (r.az + r.bz) / 2;
  assert.equal(findRiverAt(PHASE_RIVERS, mx, mz)?.id, r.id);
  assert.equal(findRiverAt(PHASE_RIVERS, mx, mz + r.halfWidth + 2), null);
});

test('riversForPhase filtra corretamente', () => {
  assert.ok(riversForPhase(1).every((r) => r.phase === 1));
});
