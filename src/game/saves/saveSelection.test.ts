import test from 'node:test';
import assert from 'node:assert/strict';
import type { SavedGameState } from '../../types/game';
import { pickBestSave, saveProgressScore } from './saveSelection';

const mk = (level: number, extra: Partial<SavedGameState> = {}) => ({ level, stars: 0, starProgress: 0, day: 1, defeatedBosses: [], conqueredTerritories: [], ...extra }) as unknown as SavedGameState;

test('save de nível alto vence personagem novo remoto', () => {
  const best = pickBestSave([{ origin: 'remote', save: mk(1) }, { origin: 'legacy', save: mk(37, { day: 9 }) }]);
  assert.equal(best?.origin, 'legacy');
});

test('empate segue a precedência remote > local > legacy > backup', () => {
  const best = pickBestSave([{ origin: 'backup', save: mk(5) }, { origin: 'local', save: mk(5) }, { origin: 'remote', save: mk(5) }]);
  assert.equal(best?.origin, 'remote');
});

test('mesmo nível: mais estrelas e dias vencem', () => {
  assert.ok(saveProgressScore(mk(10, { stars: 3 })) > saveProgressScore(mk(10, { stars: 2, day: 50 })));
  assert.ok(saveProgressScore(mk(10, { day: 5 })) > saveProgressScore(mk(10, { day: 4 })));
});

test('entradas inválidas são ignoradas', () => {
  assert.equal(pickBestSave([null, undefined]), null);
  assert.equal(saveProgressScore(null), -1);
  assert.equal(pickBestSave([{ origin: 'local', save: mk(2) }])?.origin, 'local');
});
