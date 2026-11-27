import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldAuthority } from './authority';
import { parseClientMessage, PROTOCOL_VERSION } from './protocol';

const sid = (r: ReturnType<WorldAuthority['join']>): string => {
  const m = r.messages[0];
  assert.equal(m.t, 'welcome');
  return (m as { sessionId: string }).sessionId;
};
const mv = (seq: number, x: number, z = 0) => ({ t: 'move' as const, seq, x, y: 0, z, ry: 0 });

test('protocolo: valida mensagens e rejeita lixo', () => {
  assert.deepEqual(parseClientMessage('{"t":"ping","n":3}'), { t: 'ping', n: 3 });
  assert.equal(parseClientMessage('{"t":"move","seq":1,"x":1,"y":0,"z":NaN,"ry":0}'), null);
  assert.equal(parseClientMessage({ t: 'move', seq: 1.5, x: 1, y: 0, z: 0, ry: 0 }), null);
  assert.equal(parseClientMessage('{"t":"grant","xp":999999}'), null, 'cliente não concede XP');
  assert.equal(parseClientMessage('não é json'), null);
  assert.equal(parseClientMessage('x'.repeat(5000)), null);
  assert.equal(parseClientMessage({ t: 'hello', v: 1, token: 't', worldId: '../etc' }), null);
  assert.ok(parseClientMessage({ t: 'hello', v: 1, token: 't', worldId: 'quarantine-city' }));
});

test('dois jogadores se enxergam no mesmo mundo; movimento legítimo é aceito', () => {
  const w = new WorldAuthority();
  const a = sid(w.join('ana', 0));
  const b = sid(w.join('bia', 0));
  assert.deepEqual(w.handle('ana', a, mv(1, 3), 500), []);
  assert.deepEqual(w.handle('bia', b, mv(1, -2), 500), []);
  const snap = w.snapshot();
  assert.equal(snap.t, 'snapshot');
  assert.deepEqual((snap as { players: { id: string; x: number }[] }).players.map((p) => [p.id, p.x]), [['ana', 3], ['bia', -2]]);
});

test('teleporte, fora do mundo, sequência velha e excesso de taxa são rejeitados com correção', () => {
  const w = new WorldAuthority();
  const s = sid(w.join('ana', 0));
  const tele = w.handle('ana', s, mv(1, 100), 1000);
  assert.deepEqual(tele, [{ t: 'reject', seq: 1, reason: 'too_fast', at: { x: 0, y: 0, z: 0 } }]);
  assert.equal((w.handle('ana', s, mv(2, 9999), 1500)[0] as { reason: string }).reason, 'out_of_bounds');
  assert.deepEqual(w.handle('ana', s, mv(3, 5), 2000), []);
  assert.equal((w.handle('ana', s, mv(3, 6), 2500)[0] as { reason: string }).reason, 'stale_sequence');
  assert.equal((w.handle('ana', s, mv(4, 6), 2010)[0] as { reason: string }).reason, 'rate_limited');
  assert.equal(w.players()[0].x, 5, 'o estado autoritativo não foi alterado pelas rejeitadas');
});

test('lease exclusivo: a sessão nova invalida a antiga e mantém a posição', () => {
  const w = new WorldAuthority();
  const old = sid(w.join('ana', 0));
  w.handle('ana', old, mv(1, 4), 1000);
  const second = w.join('ana', 2000);
  assert.equal(second.replacedSessionId, old);
  assert.deepEqual(w.handle('ana', old, mv(2, 5), 3000), [{ t: 'error', reason: 'replaced' }]);
  assert.equal((second.messages[0] as { self: { x: number } }).self.x, 4);
  w.leave('ana', old); // fechar a sessão antiga não derruba a nova
  assert.equal(w.players().length, 1);
});

test('versão errada, mundo cheio e expulsão por violações repetidas', () => {
  const w = new WorldAuthority({ ...{ worldBounds: 220, maxSpeed: 16, slack: 1.5, minMoveIntervalMs: 30, maxStrikes: 3, spawn: { x: 0, y: 0, z: 0 } }, maxPlayers: 1 });
  assert.deepEqual(w.join('ana', 0, PROTOCOL_VERSION + 1).messages, [{ t: 'error', reason: 'bad_version' }]);
  const s = sid(w.join('ana', 0));
  assert.deepEqual(w.join('bia', 0).messages, [{ t: 'error', reason: 'world_full' }]);
  let last: unknown;
  for (let i = 1; i <= 3; i += 1) last = w.handle('ana', s, mv(i, 200), i * 1000);
  assert.deepEqual(last, [{ t: 'error', reason: 'too_many_violations' }]);
  assert.equal(w.players().length, 0);
});

test('determinismo: a mesma sequência de mensagens gera o mesmo estado', () => {
  const run = () => {
    const w = new WorldAuthority();
    const s = sid(w.join('ana', 0));
    for (let i = 1; i <= 20; i += 1) w.handle('ana', s, mv(i, i * 0.4), i * 100);
    w.advanceTick();
    return JSON.stringify(w.snapshot());
  };
  assert.equal(run(), run());
});
