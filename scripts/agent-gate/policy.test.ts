import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GATE_CONFIG, evaluateGate, isSafePath, type GateInput } from './policy.ts';

const config = { ...DEFAULT_GATE_CONFIG, agentAuthors: ['agent-bot'] };

const ok: GateInput = {
  author: 'agent-bot', headRef: 'claude/novo-recurso', headRepo: 'o/r', baseRepo: 'o/r', openAgentPrs: 1,
  reviews: [{ login: 'tom', state: 'APPROVED', association: 'OWNER' }],
  labels: ['agent-pr'], baseRef: 'main', draft: false, mergedToday: 0,
  files: [{ filename: 'src/game/shop/catalog.ts', additions: 10, deletions: 2 }, { filename: 'docs/x.md', additions: 3, deletions: 0 }],
  checks: [{ name: 'build', status: 'completed', conclusion: 'success' }, { name: 'deploy', status: 'completed', conclusion: 'skipped' }],
};
const reasonsFor = (patch: Partial<GateInput>) => evaluateGate({ ...ok, ...patch }, config).reasons.join(' | ');

test('PR de agente dentro das regras é liberada', () => {
  assert.deepEqual(evaluateGate(ok, config), { allow: true, reasons: [] });
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

test('rótulo não basta: autor, branch, fork e lista vazia de autores', () => {
  assert.match(reasonsFor({ author: 'intruso' }), /não está na lista/);
  assert.match(evaluateGate(ok).reasons.join('|'), /não está na lista/); // configuração padrão = falha fechada
  assert.match(reasonsFor({ headRef: 'feature/x' }), /fora do padrão/);
  assert.match(reasonsFor({ headRef: 'claude/../main' }), /fora do padrão|../);
  assert.match(reasonsFor({ headRepo: 'fork/r' }), /fork/);
});

test('exige revisor independente: autor, outro agente, comentário ou sem vínculo não contam', () => {
  const need = /revisor independente/;
  assert.match(reasonsFor({ reviews: [] }), need);
  assert.match(reasonsFor({ reviews: [{ login: 'agent-bot', state: 'APPROVED', association: 'OWNER' }] }), need);
  assert.match(reasonsFor({ reviews: [{ login: 'tom', state: 'COMMENTED', association: 'OWNER' }] }), need);
  assert.match(reasonsFor({ reviews: [{ login: 'tom', state: 'CHANGES_REQUESTED', association: 'OWNER' }] }), need);
  assert.match(reasonsFor({ reviews: [{ login: 'estranho', state: 'APPROVED', association: 'NONE' }] }), need);
});

test('renomeações, exclusões e arquivos ocultos são avaliados', () => {
  assert.match(reasonsFor({ files: [{ filename: 'src/game/x.ts', previousFilename: 'workers/cowila-auth/src/index.ts', status: 'renamed', additions: 0, deletions: 0 }] }), /sensível/);
  assert.match(reasonsFor({ files: [{ filename: 'src/game/shop/shop.test.ts', status: 'removed', additions: 0, deletions: 40 }] }), /excluir testes/);
  assert.match(reasonsFor({ files: [{ filename: 'src/game/.hidden.ts', additions: 1, deletions: 0 }] }), /oculto/);
  assert.match(reasonsFor({ files: [{ filename: 'src/game/../../x.ts', additions: 1, deletions: 0 }] }), /suspeito/);
  assert.match(reasonsFor({ files: [{ filename: 'tsconfig.json', additions: 1, deletions: 0 }] }), /sensível/);
  assert.equal(isSafePath('src/game/a.ts'), true);
  for (const bad of ['/etc/passwd', 'a//b', 'a/../b', 'a\\b', 'a/%2e%2e/b', '.env', 'src/.x']) assert.equal(isSafePath(bad), false, bad);
});

test('limite de PRs de agentes abertas ao mesmo tempo', () => {
  assert.match(reasonsFor({ openAgentPrs: DEFAULT_GATE_CONFIG.maxOpenAgentPrs + 1 }), /ao mesmo tempo/);
});

test('limites de tamanho e teto diário', () => {
  const many = Array.from({ length: DEFAULT_GATE_CONFIG.maxFiles + 1 }, (_, i) => ({ filename: `src/game/f${i}.ts`, additions: 1, deletions: 0 }));
  assert.match(reasonsFor({ files: many }), /arquivos/);
  assert.match(reasonsFor({ files: [{ filename: 'src/game/big.ts', additions: 2000, deletions: 0 }] }), /linhas/);
  assert.match(reasonsFor({ mergedToday: DEFAULT_GATE_CONFIG.maxPerDay }), /Teto diário/);
  assert.match(reasonsFor({ files: [] }), /sem arquivos/);
});
