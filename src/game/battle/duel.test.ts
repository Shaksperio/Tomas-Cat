import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COIN_STAKE,
  DUEL_TIME_LIMIT_SECONDS,
  type DuelFighter,
  createDuelCombat,
  decideChallengeResponse,
  defaultStake,
  forfeitDuel,
  maxResourceStake,
  playerStrike,
  seedFromString,
  settleDuel,
  tickDuel,
  validateMatchedStake,
  validateStake,
} from './duel.ts';

const fighter = (id: string, over: Partial<DuelFighter> = {}): DuelFighter => ({
  id,
  name: id,
  coins: 100,
  items: { scrap: 10 },
  health: 100,
  maxHealth: 100,
  oxygen: 100,
  maxOxygen: 100,
  ...over,
});

test('aposta padrão é 30 moedas e o vencedor leva as moedas do perdedor', () => {
  assert.equal(defaultStake.amount, 30);
  assert.equal(DEFAULT_COIN_STAKE, 30);
  const a = fighter('tomas');
  const b = fighter('bento');
  const s = settleDuel(a, b, defaultStake, 'tomas');
  assert.equal(s.changes.tomas.coins, 30);
  assert.equal(s.changes.bento.coins, -30);
  assert.equal(s.draw, false);
});

test('sem moedas suficientes a aposta é recusada para qualquer lado', () => {
  const a = fighter('a');
  const poor = fighter('b', { coins: 10 });
  assert.match(validateMatchedStake(a, poor, defaultStake) ?? '', /não tem 30 moedas/);
  assert.equal(validateStake(a, defaultStake), null);
});

test('item apostado muda de dono; exige itemId e quantidade', () => {
  const a = fighter('a');
  const b = fighter('b', { items: { scrap: 2 } });
  assert.ok(validateStake(a, { kind: 'item', amount: 3 }));
  assert.ok(validateMatchedStake(a, b, { kind: 'item', itemId: 'scrap', amount: 5 }));
  const s = settleDuel(a, b, { kind: 'item', itemId: 'scrap', amount: 2 }, 'b');
  assert.equal(s.changes.b.items.scrap, 2);
  assert.equal(s.changes.a.items.scrap, -2);
});

test('nunca é possível apostar toda a energia vital ou todo o oxigênio', () => {
  assert.equal(maxResourceStake(100, 100), 50);
  assert.equal(maxResourceStake(40, 100), 15); // mínimo restante de 25%
  assert.equal(maxResourceStake(20, 100), 0);
  const a = fighter('a');
  assert.equal(validateStake(a, { kind: 'vitality', amount: 50 }), null);
  assert.ok(validateStake(a, { kind: 'vitality', amount: 51 }));
  assert.ok(validateStake(a, { kind: 'vitality', amount: 100 }));
  assert.ok(validateStake(a, { kind: 'oxygen', amount: 100 }));
  const weak = fighter('w', { health: 24 });
  assert.ok(validateStake(weak, { kind: 'vitality', amount: 1 }));
});

test('vitalidade/oxigênio: vencedor ganha até seu limite máximo, perdedor perde o apostado', () => {
  const a = fighter('a', { health: 90 });
  const b = fighter('b');
  const s = settleDuel(a, b, { kind: 'vitality', amount: 20 }, 'a');
  assert.equal(s.changes.a.health, 10);
  assert.equal(s.changes.b.health, -20);
  const o = settleDuel(a, b, { kind: 'oxygen', amount: 30 }, 'b');
  assert.equal(o.changes.b.oxygen, 0); // oxigênio de b já está cheio
  assert.equal(o.changes.a.oxygen, -30);
});

test('empate e aposta inválida não transferem nada', () => {
  const a = fighter('a');
  const b = fighter('b');
  const d = settleDuel(a, b, defaultStake, null);
  assert.equal(d.draw, true);
  assert.equal(d.changes.a.coins, 0);
  const bad = settleDuel(a, fighter('b', { coins: 0 }), defaultStake, 'a');
  assert.equal(bad.changes.a.coins, 0);
  assert.throws(() => settleDuel(a, b, defaultStake, 'ninguem'));
});

test('adversário recusa quando está descansando, sem ânimo ou cansado demais', () => {
  const a = fighter('a');
  const b = fighter('b');
  const ok = { morale: 80, health: 90, busyResting: false };
  assert.equal(decideChallengeResponse(a, b, ok, defaultStake).accepted, true);
  assert.equal(decideChallengeResponse(a, b, { ...ok, busyResting: true }, defaultStake).accepted, false);
  assert.equal(decideChallengeResponse(a, b, { ...ok, morale: 10 }, defaultStake).accepted, false);
  assert.equal(
    decideChallengeResponse(a, b, { ...ok, health: 30 }, { kind: 'vitality', amount: 10 }).accepted,
    false,
  );
});

test('luta é determinística pela semente e termina por nocaute', () => {
  const run = () => {
    const st = createDuelCombat(seedFromString('bento'));
    const log: string[] = [];
    for (let i = 0; i < 4000 && !st.finished; i += 1) {
      if (i % 20 === 0) log.push(String(playerStrike(st, 2, 1)));
      log.push(...tickDuel(st, 0.05, 2, false));
    }
    return { st, log };
  };
  const r1 = run();
  const r2 = run();
  assert.deepEqual(r1.log, r2.log);
  assert.equal(r1.st.finished, true);
  assert.ok(r1.st.winner === 'player' || r1.st.winner === 'opponent');
});

test('esquivar ou ficar longe evita os golpes; tempo esgotado decide por vigor', () => {
  const st = createDuelCombat(7);
  for (let i = 0; i < 200; i += 1) tickDuel(st, 0.05, 2, true);
  assert.equal(st.playerVigor, 100);
  assert.equal(playerStrike(st, 10, 1), 'player_miss');
  assert.equal(st.opponentVigor, 100);
  const t = createDuelCombat(7);
  playerStrike(t, 1, 1);
  while (!t.finished) tickDuel(t, 1, 99, false);
  assert.equal(t.reason, 'time');
  assert.equal(t.winner, 'player');
  assert.ok(t.elapsed >= DUEL_TIME_LIMIT_SECONDS);
});

test('desistir entrega a vitória ao oponente', () => {
  const st = createDuelCombat(1);
  forfeitDuel(st);
  assert.equal(st.winner, 'opponent');
  assert.equal(st.reason, 'forfeit');
});

test('grupo: o jogador cobre N × aposta e cada oponente cobre a sua', async () => {
  const { validateGroupStake, settleGroupDuel } = await import('./duel.ts');
  const player = { id: 'p', name: 'Tomas', coins: 80, items: {}, health: 100, maxHealth: 100, oxygen: 100, maxOxygen: 100 };
  const mk = (id: string, coins = 40) => ({ id, name: id, coins, items: {}, health: 100, maxHealth: 100, oxygen: 100, maxOxygen: 100 });
  const foes = [mk('a'), mk('b'), mk('c')];
  assert.match(validateGroupStake(player, foes, { kind: 'coins', amount: 30 }) ?? '', /moedas/);
  assert.equal(validateGroupStake(player, foes, { kind: 'coins', amount: 26 }), null);
  assert.ok(validateGroupStake(player, [mk('a', 5)], { kind: 'coins', amount: 30 }));
  // vitalidade: máximo de 50% / nunca abaixo de 25% do total, aplicado à soma
  assert.ok(validateGroupStake(player, foes, { kind: 'vitality', amount: 20 }));
  assert.equal(validateGroupStake(player, foes, { kind: 'vitality', amount: 15 }), null);

  const stake = { kind: 'coins' as const, amount: 20 };
  const s = settleGroupDuel(player, foes, stake, ['win', 'win', 'lose']);
  assert.equal(s.player.coins, 20);
  assert.equal(s.wins, 2);
  assert.equal(s.losses, 1);
  assert.equal(s.foes.a.coins, -20);
  assert.equal(s.foes.c.coins, 20);
  const draw = settleGroupDuel(player, foes, stake, ['draw', 'draw', 'draw']);
  assert.equal(draw.player.coins, 0);
  // perdendo para todos: nunca perde mais do que apostou × N
  const lost = settleGroupDuel(player, foes, stake, ['lose', 'lose', 'lose']);
  assert.equal(lost.player.coins, -60);
});
