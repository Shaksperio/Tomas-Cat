import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GATE_CONFIG, evaluateGate, type GateInput } from './policy.ts';

const ok: GateInput = {
  labels: ['agent-pr'], baseRef: 'main', draft: false, mergedToday: 0,
  files: [{ filename: 'src/game/shop/catalog.ts', additions: 10, deletions: 2 }, { filename: 'docs/x.md', additions: 3, deletions: 0 }],
  checks: [{ name: 'build', status: 'completed', conclusion: 'success' }, { name: 'deploy', status: 'completed', conclusion: 'skipped' }],
};
const reasonsFor = (patch: Partial<GateInput>) => evaluateGate({ ...ok, ...patch }).reasons.join(' | ');

test('PR de agente dentro das regras é liberada', () => {
  assert.deepEqual(evaluateGate(ok), { allow: true, reasons: [] });
});

test('sem rótulo, base errada ou rascunho: não libera', () => {
  assert.match(reasonsFor({ labels: [] }), /rótulo/);
  assert.match(reasonsFor({ baseRef: 'dev' }), /Base/);
  assert.match(reasonsFor({ draft: true }), /rascunho/);
});

test('áreas sensíveis sempre exigem humano', () => {
  for (const filename of ['.github/workflows/deploy-pages.yml', 'firestore.rules', 'workers/cowila-auth/src/index.ts', 'package.json',
    'src/firebase/client.ts', 'src/game/saves/saveSelection.ts', 'scripts/agent-gate/policy.ts', '.env.example', 'src/game/auth-token.ts']) {
    assert.match(reasonsFor({ files: [{ filename, additions: 1, deletions: 0 }] }), /sensível/, filename);
  }
});

test('arquivo fora das pastas permitidas é recusado', () => {
  assert.match(reasonsFor({ files: [{ filename: 'src/components/GameHUD.tsx', additions: 1, deletions: 0 }] }), /fora das pastas/);
});

test('checks falhos, cancelados, ignorados, pendentes ou ausentes não liberam', () => {
  const build = (conclusion: string | null, status = 'completed') => [{ name: 'build', status, conclusion }];
  assert.match(reasonsFor({ checks: build('failure') }), /não aprovado/);
  assert.match(reasonsFor({ checks: build('cancelled') }), /não aprovado/);
  assert.match(reasonsFor({ checks: build('skipped') }), /não aprovado/);
  assert.match(reasonsFor({ checks: build(null, 'in_progress') }), /andamento/);
  assert.match(reasonsFor({ checks: [] }), /ausente/);
  assert.match(reasonsFor({ checks: [...ok.checks, { name: 'lint', status: 'completed', conclusion: 'cancelled' }] }), /lint/);
});

test('limites de tamanho e teto diário', () => {
  const many = Array.from({ length: DEFAULT_GATE_CONFIG.maxFiles + 1 }, (_, i) => ({ filename: `src/game/f${i}.ts`, additions: 1, deletions: 0 }));
  assert.match(reasonsFor({ files: many }), /arquivos/);
  assert.match(reasonsFor({ files: [{ filename: 'src/game/big.ts', additions: 2000, deletions: 0 }] }), /linhas/);
  assert.match(reasonsFor({ mergedToday: DEFAULT_GATE_CONFIG.maxPerDay }), /Teto diário/);
  assert.match(reasonsFor({ files: [] }), /sem arquivos/);
});
