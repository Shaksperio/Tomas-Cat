import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceToSegment,
  findRiverAt,
  lakesAsWaterBodies,
  PHASE_LAKES,
  PHASE_RIVERS,
  riverCurrentDelta,
  riverCurrentDirection,
  riverCorners,
  riversForPhase,
  sampleExpandedWater,
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

test('riverCurrentDirection é unitário ao longo de A→B', () => {
  const r = PHASE_RIVERS[0];
  const d = riverCurrentDirection(r);
  const len = Math.sqrt(d.x * d.x + d.z * d.z);
  assert.ok(Math.abs(len - 1) < 1e-6);
});

test('riverCurrentDelta escala com dt', () => {
  const r = PHASE_RIVERS[0];
  const a = riverCurrentDelta(r, 1);
  const b = riverCurrentDelta(r, 0.5);
  assert.ok(Math.abs(a.dx - 2 * b.dx) < 1e-6);
  assert.ok(Math.abs(a.dz - 2 * b.dz) < 1e-6);
});

test('sampleExpandedWater detecta rio e aplica corrente', () => {
  const r = PHASE_RIVERS[0];
  const mx = (r.ax + r.bx) / 2;
  const mz = (r.az + r.bz) / 2;
  const s = sampleExpandedWater([], PHASE_RIVERS, mx, r.surfaceY - 0.5, mz, 0.9, 1);
  assert.equal(s.inWater, true);
  assert.equal(s.river?.id, r.id);
  assert.ok(Math.abs(s.currentDx) + Math.abs(s.currentDz) > 0.5);
});

test('sampleExpandedWater fora d água', () => {
  const s = sampleExpandedWater([], PHASE_RIVERS, 0, 0, 0, 0.9);
  assert.equal(s.inWater, false);
  assert.equal(s.river, null);
});

test('cada fase possui lago e rio/canal catalogado', () => {
  for (const phase of [1, 2, 3, 4]) {
    assert.ok(PHASE_LAKES.some((lake) => lake.phase === phase), `lago fase ${phase}`);
    assert.ok(PHASE_RIVERS.some((river) => river.phase === phase), `rio/canal fase ${phase}`);
  }
});

test('canal elevado é visual e não entra na amostragem de natação', () => {
  const canal = PHASE_RIVERS.find((river) => river.id === 'canal_roofs')!;
  const x = (canal.ax + canal.bx) / 2;
  const z = canal.az;
  const sample = sampleExpandedWater([], PHASE_RIVERS, x, 0, z, 0.9, 1 / 60);
  assert.equal(sample.inWater, false);
  assert.equal(sample.river, null);
});

test('rio retorna corpo navegável e corrente proporcional ao dt', () => {
  const river = PHASE_RIVERS.find((r) => r.id === 'river_suburb')!;
  const x = (river.ax + river.bx) / 2;
  const sample = sampleExpandedWater([], PHASE_RIVERS, x, river.surfaceY - 0.5, river.az, 0.9, 0.5);
  assert.ok(sample.body);
  assert.equal(sample.body?.id, river.id);
  assert.ok(Math.abs(sample.currentDx) + Math.abs(sample.currentDz) > 0);
  const corners = riverCorners(river);
  assert.equal(corners.length, 4);
});
