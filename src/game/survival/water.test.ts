import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BREATH_SECONDS,
  DROWNING_DAMAGE_PER_SECOND,
  OXYGEN_MAX,
  basinDepthForRadius,
  createWaterBody,
  findWaterBody,
  sampleWater,
  stepOxygen,
  swimVerticalVelocity,
} from './water.ts';

const lake = createWaterBody('lake', 'Lago', 10, 20, 3.2);

test('bacias maiores são mais profundas', () => {
  assert.ok(basinDepthForRadius(3.4) > basinDepthForRadius(2.7));
  assert.ok(basinDepthForRadius(2.7) > basinDepthForRadius(2.2));
  assert.ok(lake.floorY < lake.surfaceY && lake.surfaceY < 0);
});

test('findWaterBody só encontra dentro do raio', () => {
  assert.equal(findWaterBody([lake], 10, 20), lake);
  assert.equal(findWaterBody([lake], 10 + 3.3, 20), null);
});

test('na calçada não há água; caindo na bacia há', () => {
  assert.equal(sampleWater([lake], 50, 0, 50, 0.6).inWater, false);
  assert.equal(sampleWater([lake], 10, 0, 20, 0.6).inWater, false); // ainda na borda
  const s = sampleWater([lake], 10, -1, 20, 0.6);
  assert.equal(s.inWater, true);
  assert.equal(s.submerged, true);
  assert.equal(s.floorY, lake.floorY);
});

test('flutuando com a cabeça fora, o oxigênio não é consumido', () => {
  const s = sampleWater([lake], 10, lake.surfaceY - 0.3, 20, 0.6);
  assert.equal(s.inWater, true);
  assert.equal(s.submerged, false);
});

test('submerso consome o fôlego inteiro em BREATH_SECONDS e então afoga', () => {
  let o = OXYGEN_MAX;
  let t = 0;
  while (o > 0 && t < 100) {
    o = stepOxygen(o, true, 0.1).oxygen;
    t += 0.1;
  }
  assert.ok(Math.abs(t - BREATH_SECONDS) < 0.3);
  const s = stepOxygen(0, true, 1);
  assert.equal(s.drowningDamage, DROWNING_DAMAGE_PER_SECOND);
  assert.equal(stepOxygen(50, true, 1).drowningDamage, 0);
});

test('na superfície o oxigênio recupera até o máximo', () => {
  let o = 10;
  for (let i = 0; i < 100; i++) o = stepOxygen(o, false, 0.1).oxygen;
  assert.equal(o, OXYGEN_MAX);
});

test('sem comando Tomas flutua; com comando mergulha ou sobe', () => {
  const idle = swimVerticalVelocity(-2, 0.6, lake.surfaceY, { ascend: false, dive: false });
  assert.ok(idle > 0, 'afundado demais volta à superfície');
  const atSurface = swimVerticalVelocity(lake.surfaceY - 0.42, 0.6, lake.surfaceY, { ascend: false, dive: false });
  assert.ok(Math.abs(atSurface) < 0.01);
  assert.ok(swimVerticalVelocity(-1, 0.6, lake.surfaceY, { ascend: false, dive: true }) < 0);
  assert.ok(swimVerticalVelocity(-1, 0.6, lake.surfaceY, { ascend: true, dive: false }) > 0);
});
