import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArticulatedCat } from '../catModel';

test('o modelo felino possui bigodes dos dois lados e olhos identificáveis', () => {
  const cat = new ArticulatedCat();
  const whiskers = cat.root.getObjectByName('TomasWhiskers');

  assert.ok(whiskers);
  assert.equal(whiskers.children.length, 6);
  assert.ok(cat.root.getObjectByName('TomasEyeLeft'));
  assert.ok(cat.root.getObjectByName('TomasEyeRight'));
});

test('a piscada fecha os olhos brevemente e os reabre sem alterar a escala base', () => {
  const cat = new ArticulatedCat();
  const leftEye = cat.root.getObjectByName('TomasEyeLeft');
  const rightEye = cat.root.getObjectByName('TomasEyeRight');
  assert.ok(leftEye && rightEye);

  cat.update(1 / 60, 0, true, false, false, false, false, 0, false, 5.515);
  assert.ok(leftEye.scale.y < 0.2);
  assert.ok(rightEye.scale.y < 0.2);

  cat.update(1 / 60, 0, true, false, false, false, false, 0, false, 5.6);
  assert.equal(leftEye.scale.y, 1);
  assert.equal(rightEye.scale.y, 1);
});
