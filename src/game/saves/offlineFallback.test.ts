import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecoverableConnectivityFailure } from '../offline/connectivity';

test('timeout ao consultar Firestore permite contingência local', () => {
  assert.equal(isRecoverableConnectivityFailure(new Error('Tempo esgotado ao consultar o Firestore.')), true);
});

test('indisponibilidade e falha de rede permitem contingência', () => {
  assert.equal(isRecoverableConnectivityFailure({ code: 'unavailable' }), true);
  assert.equal(isRecoverableConnectivityFailure({ code: 'firestore/deadline-exceeded' }), true);
  assert.equal(isRecoverableConnectivityFailure({ code: 'auth/network-request-failed' }), true);
});

test('falha de permissão ou dados inválidos não permite contornar a validação', () => {
  assert.equal(isRecoverableConnectivityFailure({ code: 'permission-denied' }), false);
  assert.equal(isRecoverableConnectivityFailure({ code: 'unauthenticated' }), false);
  assert.equal(isRecoverableConnectivityFailure(new Error('O salvamento remoto está inválido.')), false);
  assert.equal(isRecoverableConnectivityFailure(null), false);
});
