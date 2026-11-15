import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  birdActivity,
  cloudProfile,
  moonIllumination,
  moonLightFactor,
  moonPhase,
  sampleSkyAtmosphere,
} from './skyAtmosphere.ts';

const h = (hour: number) => hour / 24;

test('fase lunar é periódica e está em [0, 1)', () => {
  const a = moonPhase(0, 0);
  const b = moonPhase(8, 0);
  assert.ok(Math.abs(a - b) < 1e-9);
  assert.ok(a >= 0 && a < 1);
  const mid = moonPhase(4, 0);
  assert.ok(mid > 0.4 && mid < 0.6);
});

test('iluminação da lua: nova ≈ 0, cheia ≈ 1', () => {
  assert.ok(moonIllumination(0) < 0.05);
  assert.ok(moonIllumination(0.5) > 0.95);
  assert.ok(moonIllumination(0.25) > 0.4 && moonIllumination(0.25) < 0.6);
});

test('luz da lua só fora do dia', () => {
  assert.equal(moonLightFactor(1, h(12)), 0);
  assert.ok(moonLightFactor(1, h(22)) > 0);
  assert.ok(moonLightFactor(1, h(2)) > 0);
});

test('nuvens: chuva ácida mais densa que céu limpo', () => {
  const clear = cloudProfile('clear', h(12));
  const acid = cloudProfile('acid_rain', h(12));
  assert.ok(acid.density > clear.density);
  assert.ok(clear.density >= 0 && clear.density <= 1);
  assert.ok(acid.drift >= clear.drift);
});

test('aves ativas de manhã com tempo bom e ausentes à noite ou chuva ácida', () => {
  const morning = birdActivity('clear', h(7));
  assert.equal(morning.active, true);
  assert.ok(morning.flockStrength > 0.5);

  const night = birdActivity('clear', h(22));
  assert.equal(night.active, false);

  const acid = birdActivity('acid_rain', h(8));
  assert.equal(acid.active, false);
});

test('sampleSkyAtmosphere agrega campos esperados', () => {
  const s = sampleSkyAtmosphere(3, h(21), 'clear');
  assert.ok(typeof s.moonPhase === 'number');
  assert.ok(s.moonLightFactor > 0);
  assert.ok(s.clouds.density >= 0);
  assert.ok(typeof s.birds.active === 'boolean');
});
