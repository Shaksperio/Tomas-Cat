import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameFailureTracker, runFrameStep } from './frameGuard';

test('runFrameStep devolve o erro em vez de propagá-lo e null quando tudo corre bem', () => {
  assert.equal(runFrameStep(() => undefined), null);
  const error = runFrameStep(() => { throw new TypeError('boom'); });
  assert.ok(error instanceof TypeError);
  assert.ok(runFrameStep(() => { throw undefined; }) instanceof Error);
});

test('o rastreador manda recuperar só após falhas consecutivas e zera ao ter sucesso', () => {
  const tracker = new FrameFailureTracker(3, 1000);
  assert.deepEqual(tracker.failure(0), { consecutive: 1, shouldLog: true, shouldRecover: false });
  assert.deepEqual(tracker.failure(16), { consecutive: 2, shouldLog: false, shouldRecover: false });
  assert.equal(tracker.failure(32).shouldRecover, true);
  tracker.success();
  assert.equal(tracker.failure(40).consecutive, 1);
});

test('o log é limitado no tempo, mesmo com falha a cada quadro', () => {
  const tracker = new FrameFailureTracker(100, 1000);
  let logs = 0;
  for (let t = 0; t < 5000; t += 16) if (tracker.failure(t).shouldLog) logs += 1;
  assert.equal(logs, 5);
});
