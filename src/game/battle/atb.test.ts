import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMIT_MAX,
  MAX_TURNS,
  type BattleCommand,
  type BattleState,
  canUseCommand,
  chooseOpponentCommand,
  createBattle,
  forfeitBattle,
  resolveCommand,
  seedFromText,
  tickAtb,
} from './atb.ts';

function waitReady(state: BattleState): 'player' | 'opponent' {
  for (let i = 0; i < 2000; i += 1) {
    const r = tickAtb(state, 0.05);
    if (r) return r;
  }
  throw new Error('ninguém ficou pronto');
}

function playToEnd(seed: string, playerCmd: (s: BattleState) => BattleCommand): BattleState {
  const state = createBattle(seedFromText(seed), 1.5);
  for (let i = 0; i < 400 && !state.finished; i += 1) {
    const who = waitReady(state);
    resolveCommand(state, who, who === 'player' ? playerCmd(state) : chooseOpponentCommand(state));
  }
  return state;
}

test('o ATB só avança enquanto ninguém está pronto (modo espera)', () => {
  const s = createBattle(1, 1);
  const who = waitReady(s);
  const snapshot = JSON.stringify([s.player.atb, s.opponent.atb]);
  tickAtb(s, 1);
  assert.equal(JSON.stringify([s.player.atb, s.opponent.atb]), snapshot);
  assert.equal(s.ready, who);
});

test('só o lutador pronto age, e Limit exige a barra cheia', () => {
  const s = createBattle(2, 1);
  const who = waitReady(s);
  const foe = who === 'player' ? 'opponent' : 'player';
  assert.equal(canUseCommand(s, foe, 'attack'), false);
  assert.equal(canUseCommand(s, who, 'limit'), false);
  assert.throws(() => resolveCommand(s, who, 'limit'));
  s[who].limit = LIMIT_MAX;
  assert.equal(canUseCommand(s, who, 'limit'), true);
});

test('golpes tiram vigor, enchem o limit e zeram o ATB de quem agiu', () => {
  const s = createBattle(3, 2);
  const who = waitReady(s);
  const target = who === 'player' ? 'opponent' : 'player';
  const before = s[target].vigor;
  const a = resolveCommand(s, who, 'attack');
  assert.equal(a.hits.length, 1);
  assert.equal(s[target].vigor, before - a.hits[0].damage);
  assert.ok(s[target].limit > 0);
  assert.equal(s[who].atb, 0);
  assert.equal(s.ready, null);
});

test('Garra Furiosa dá 3 golpes e atrasa o próximo turno; Limit dá 5 e ignora a defesa', () => {
  const s = createBattle(4, 2);
  const who = waitReady(s);
  const target = who === 'player' ? 'opponent' : 'player';
  const f = resolveCommand(s, who, 'flurry');
  assert.equal(f.hits.length, 3);
  assert.ok(s[who].atb < 0);
  const s2 = createBattle(4, 2);
  const w2 = waitReady(s2);
  const t2 = w2 === 'player' ? 'opponent' : 'player';
  s2[t2].guarding = true;
  s2[w2].limit = LIMIT_MAX;
  const l = resolveCommand(s2, w2, 'limit');
  assert.equal(l.hits.length, 5);
  assert.equal(l.blocked, false);
  assert.equal(s2[w2].limit, 0);
  assert.ok(target);
});

test('defender reduz o dano à metade', () => {
  const dmg = (guard: boolean) => {
    const s = createBattle(5, 2);
    const who = waitReady(s);
    const t = who === 'player' ? 'opponent' : 'player';
    s[t].guarding = guard;
    return resolveCommand(s, who, 'attack');
  };
  const normal = dmg(false);
  const guarded = dmg(true);
  assert.equal(guarded.blocked, true);
  assert.ok(guarded.hits[0].damage < normal.hits[0].damage);
});

test('a luta é determinística pela semente e termina', () => {
  const a = playToEnd('bento', () => 'attack');
  const b = playToEnd('bento', () => 'attack');
  assert.equal(a.finished, true);
  assert.deepEqual([a.winner, a.turn, a.player.vigor, a.opponent.vigor], [b.winner, b.turn, b.player.vigor, b.opponent.vigor]);
  assert.ok(a.turn <= MAX_TURNS);
  assert.ok(a.reason === 'knockout' || a.reason === 'turns');
});

test('usar Limit sempre que possível vence mais lutas que só defender', () => {
  let limitWins = 0;
  let guardWins = 0;
  for (let i = 0; i < 20; i += 1) {
    const seed = `lutador-${i}`;
    if (playToEnd(seed, (s) => (s.player.limit >= LIMIT_MAX ? 'limit' : 'attack')).winner === 'player') limitWins += 1;
    if (playToEnd(seed, () => 'guard').winner === 'player') guardWins += 1;
  }
  assert.ok(limitWins > guardWins, `${limitWins} vs ${guardWins}`);
});

test('desistir entrega a vitória ao oponente', () => {
  const s = createBattle(6, 1);
  forfeitBattle(s);
  assert.deepEqual([s.finished, s.winner, s.reason], [true, 'opponent', 'forfeit']);
});
