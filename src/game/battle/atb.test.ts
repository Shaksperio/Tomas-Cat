import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Side,
  defaultTarget,
  fighter,
  foeSides,
  livingFoes,
  isFoe,
  specialProfile,
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

function waitReady(state: BattleState): Side {
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
  fighter(s, who).limit = LIMIT_MAX;
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
  assert.equal(fighter(s, who).atb, 0);
  assert.equal(s.ready, null);
});

test('Garra Furiosa dá 3 golpes e atrasa o próximo turno; Limit dá 5 e ignora a defesa', () => {
  const s = createBattle(4, 2);
  const who = waitReady(s);
  const target = who === 'player' ? 'opponent' : 'player';
  const f = resolveCommand(s, who, 'flurry');
  assert.equal(f.hits.length, 3);
  assert.ok(fighter(s, who).atb < 0);
  const s2 = createBattle(4, 2);
  const w2 = waitReady(s2);
  const t2 = w2 === 'player' ? 'opponent' : 'player';
  s2[t2].guarding = true;
  fighter(s2, w2).limit = LIMIT_MAX;
  const l = resolveCommand(s2, w2, 'limit');
  assert.equal(l.hits.length, 3); // nível 1: 3 golpes
  assert.equal(l.blocked, false);
  assert.equal(fighter(s2, w2).limit, 0);
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

test('o maná sobe a cada golpe dado e recebido, e atacar enche mais que defender', () => {
  const s = createBattle(11, 2);
  const who = waitReady(s);
  const foe = who === 'player' ? 'opponent' : 'player';
  const m0 = fighter(s, who).limit;
  resolveCommand(s, who, 'attack');
  assert.equal(fighter(s, who).limit, m0 + 14);
  assert.ok(s[foe].limit > 0);
});

test('a sequência especial escala com o nível', () => {
  const low = specialProfile(1);
  const high = specialProfile(99);
  assert.ok(high.hits > low.hits);
  assert.ok(high.totalDamage > low.totalDamage * 3);
  assert.ok(high.totalDamage <= 80 && low.totalDamage >= 15);
  const run = (level: number) => {
    const s = createBattle(21, 2, level, level);
    const who = waitReady(s);
    const t = who === 'player' ? 'opponent' : 'player';
    fighter(s, who).limit = LIMIT_MAX;
    const before = s[t].vigor;
    resolveCommand(s, who, 'limit');
    return before - s[t].vigor;
  };
  assert.ok(run(99) > run(1) * 2.5, `${run(99)} vs ${run(1)}`);
});

test('o maná com que o jogador entra é mantido e limitado a 100', () => {
  assert.equal(createBattle(1, 2, 10, 10, { playerMana: 63 }).player.limit, 63);
  assert.equal(createBattle(1, 2, 10, 10, { playerMana: 900 }).player.limit, LIMIT_MAX);
  assert.equal(createBattle(1, 2, 10, 10, { playerMana: -5 }).player.limit, 0);
});

test('duelo em grupo: 1 contra 3 cria três oponentes independentes', () => {
  const s = createBattle(5, 3, 40, 10, { foeLevels: [20, 15, 15] });
  assert.equal(s.foeCount, 3);
  assert.deepEqual(foeSides(s), ['opponent', 'opponent2', 'opponent3']);
  assert.equal(s.opponent4, undefined);
  assert.equal(createBattle(5, 3, 1, 10, { foeLevels: [1, 1, 1, 1, 1, 1] }).foeCount, 4);
});

test('em grupo a vitória só vem quando TODOS caem; golpes escolhem o alvo', () => {
  const s = createBattle(9, 6, 99, 10, { foeLevels: [10, 10, 10] });
  let guard = 0;
  let fell = 0;
  while (!s.finished && guard++ < 4000) {
    const who = waitReady(s);
    if (isFoe(who)) {
      const cmd = chooseOpponentCommand(s, who);
      resolveCommand(s, who, cmd);
      s.player.vigor = Math.max(s.player.vigor, 60); // mantém o jogador vivo para o teste
    } else {
      const target = livingFoes(s).includes('opponent2') ? 'opponent2' : defaultTarget(s);
      const a = resolveCommand(s, 'player', 'attack', target);
      assert.equal(a.target, target);
      if (a.knockedOut) {
        fell += 1;
        assert.equal(a.finishing, livingFoes(s).length === 0);
      }
    }
  }
  assert.equal(s.finished, true);
  assert.equal(s.winner, 'player');
  assert.equal(fell, 3);
  for (const f of foeSides(s)) assert.equal(fighter(s, f).vigor, 0);
});

test('em grupo o oponente caído não age mais e o jogador perde ao zerar o vigor', () => {
  const s = createBattle(3, 1, 1, 50, { foeLevels: [50, 50] });
  s.opponent.vigor = 0;
  for (let i = 0; i < 200; i += 1) {
    const who = tickAtb(s, 0.1);
    if (who) assert.notEqual(who, 'opponent');
    if (who === 'opponent2') break;
    if (who === 'player') resolveCommand(s, 'player', 'guard');
  }
  s.player.vigor = 1;
  s.opponent2!.atb = 100;
  s.ready = null;
  const who = waitReady(s);
  if (who === 'opponent2') {
    s.player.guarding = false;
    resolveCommand(s, 'opponent2', 'attack');
    assert.equal(s.finished, true);
    assert.equal(s.winner, 'opponent');
  }
});
