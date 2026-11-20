import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVE_UNLOCKS, getLearnedCombos } from '../progression/unlocks';
import { SHOPS } from './catalog';
import { purchaseTechnique } from './techniquePurchase';

const telhados = 'telhados';
const base = { shopId: telhados, moveId: 'lunar-sequence', coins: 500, level: 15, timeOfDay: 0.5, unlockedMoves: ['basic-claw'] };

test('toda técnica vendida existe no catálogo e tem fonte gratuita por nível, mais cedo que o nível natural', () => {
  for (const shop of SHOPS) for (const offer of shop.techniques ?? []) {
    const move = MOVE_UNLOCKS.find((m) => m.id === offer.moveId);
    assert.ok(move, `${offer.moveId} fora do catálogo`);
    assert.ok(offer.levelRequired < move.requiredLevel, `${offer.moveId}: comprar não adianta nada`);
    assert.ok(offer.price > 0);
  }
});

test('nenhuma técnica é vendida em duas lojas e cada combo tem comando próprio', () => {
  const ids = SHOPS.flatMap((s) => (s.techniques ?? []).map((t) => t.moveId));
  assert.equal(new Set(ids).size, ids.length);
  const combos = MOVE_UNLOCKS.filter((m) => m.command.startsWith('combo_')).map((m) => m.command);
  assert.equal(new Set(combos).size, combos.length);
});

test('compra válida cobra, registra a técnica e entra nos combos aprendidos', () => {
  const r = purchaseTechnique(base);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.coins, 350);
    assert.ok(r.unlockedMoves.includes('lunar-sequence'));
    assert.deepEqual(getLearnedCombos(r.unlockedMoves), ['combo_a']);
  }
});

test('recusas não alteram nada: loja, estoque, horário, nível, moedas e repetição', () => {
  assert.deepEqual(purchaseTechnique({ ...base, shopId: 'x' }), { ok: false, reason: 'unknown_shop', message: 'Loja desconhecida.' });
  assert.equal(purchaseTechnique({ ...base, moveId: 'apex-fury' }).ok, false);
  assert.equal((purchaseTechnique({ ...base, timeOfDay: 0.02 }) as { reason: string }).reason, 'closed');
  assert.equal((purchaseTechnique({ ...base, level: 14 }) as { reason: string }).reason, 'level_too_low');
  assert.equal((purchaseTechnique({ ...base, coins: 149 }) as { reason: string }).reason, 'no_coins');
  assert.equal((purchaseTechnique({ ...base, coins: Number.NaN }) as { reason: string }).reason, 'no_coins');
  assert.equal((purchaseTechnique({ ...base, unlockedMoves: ['basic-claw', 'lunar-sequence'] }) as { reason: string }).reason, 'already_known');
});

test('Barraca da Meia-Noite só vende de noite (20h–5h)', () => {
  const r = purchaseTechnique({ shopId: 'meia-noite', moveId: 'apex-fury', coins: 2000, level: 50, timeOfDay: 0.5, unlockedMoves: [] });
  assert.equal((r as { reason: string }).reason, 'closed');
  assert.equal(purchaseTechnique({ shopId: 'meia-noite', moveId: 'apex-fury', coins: 2000, level: 50, timeOfDay: 0.9, unlockedMoves: [] }).ok, true);
});
