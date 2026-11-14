import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDayPeriod, isMoonTime, moonProgress, skyColorAt } from './dayCycle.ts';

const h = (hour: number) => hour / 24;

test('os 7 períodos seguem os limites da HUD', () => {
  assert.equal(getDayPeriod(h(2)), 'Madrugada');
  assert.equal(getDayPeriod(h(5.5)), 'Alvorecer');
  assert.equal(getDayPeriod(h(9)), 'Manhã');
  assert.equal(getDayPeriod(h(13)), 'Dia');
  assert.equal(getDayPeriod(h(17)), 'Tarde');
  assert.equal(getDayPeriod(h(19)), 'Anoitecer');
  assert.equal(getDayPeriod(h(22)), 'Noite');
});

test('a lua só aparece de Noite e Madrugada', () => {
  for (const hour of [20, 22, 0, 3, 4.9]) assert.equal(isMoonTime(h(hour)), true, String(hour));
  for (const hour of [5, 7, 13, 17, 19, 19.9]) assert.equal(isMoonTime(h(hour)), false, String(hour));
  assert.equal(moonProgress(h(12)), 0);
  assert.ok(Math.abs(moonProgress(h(0.5)) - 4.5 / 9) < 1e-9);
});

test('cada período tem uma cor de céu diferente e contínua', () => {
  const colors = [2, 6, 9, 13, 17, 18.5, 22].map(x => skyColorAt(h(x)));
  assert.equal(new Set(colors).size, colors.length);
  assert.equal(skyColorAt(0), skyColorAt(0.9999999));
});
