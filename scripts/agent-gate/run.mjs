// Avalia uma PR de agente. Executa a partir da branch padrão, nunca do código da PR.
// Este MVP é somente informativo: não possui endpoint nem permissão para fazer merge.
import { DEFAULT_GATE_CONFIG, evaluateGate } from './policy.ts';

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA, AGENT_GATE_AUTHORS } = process.env;
// Lista de contas autorizadas vem de variável de repositório; vazia = falha fechada.
const agentAuthors = (AGENT_GATE_AUTHORS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER) {
  console.log('Sem PR associada à execução; nada a fazer.');
  process.exit(0);
}
const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${body.message ?? ''}`);
  return body;
};

const repo = `/repos/${GITHUB_REPOSITORY}`;
const pr = await api(`${repo}/pulls/${PR_NUMBER}`);
if (pr.state !== 'open') { console.log('PR não está aberta; avaliação encerrada.'); process.exit(0); }
if (HEAD_SHA && pr.head.sha !== HEAD_SHA) { console.log('A PR recebeu novos commits depois deste CI; avaliação descartada, aguardando novo CI.'); process.exit(0); }
if (!pr.head.repo?.full_name) throw new Error('Não foi possível confirmar o repositório de origem; avaliação falhou fechada.');

const [files, runs, reviewList, merged, open] = await Promise.all([
  api(`${repo}/pulls/${PR_NUMBER}/files?per_page=100`),
  api(`${repo}/commits/${pr.head.sha}/check-runs?per_page=100`),
  api(`${repo}/pulls/${PR_NUMBER}/reviews?per_page=100`),
  api(`/search/issues?q=${encodeURIComponent(`repo:${GITHUB_REPOSITORY} is:pr is:merged label:${DEFAULT_GATE_CONFIG.label} merged:>=${new Date().toISOString().slice(0, 10)}`)}`),
  api(`/search/issues?q=${encodeURIComponent(`repo:${GITHUB_REPOSITORY} is:pr is:open label:${DEFAULT_GATE_CONFIG.label}`)}`),
]);

// A revisão mais recente de cada pessoa prevalece; APPROVED antigo não sobrevive a CHANGES_REQUESTED.
const latestByUser = new Map();
for (const review of reviewList) if (review.user) latestByUser.set(review.user.login, review);

const decision = evaluateGate({
  labels: pr.labels.map((l) => l.name), author: pr.user.login, headRef: pr.head.ref,
  headRepo: pr.head.repo.full_name, baseRepo: pr.base.repo.full_name,
  reviews: [...latestByUser.values()].map((r) => ({ login: r.user.login, state: r.state, association: r.author_association })),
  openAgentPrs: open.total_count,
  baseRef: pr.base.ref, draft: pr.draft,
  files: files.map((f) => ({ filename: f.filename, additions: f.additions, deletions: f.deletions, status: f.status, previousFilename: f.previous_filename })),
  checks: runs.check_runs.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion })),
  mergedToday: merged.total_count,
}, { ...DEFAULT_GATE_CONFIG, agentAuthors });

console.log(JSON.stringify({ pr: Number(PR_NUMBER), headSha: pr.head.sha, mode: 'audit-only', ...decision }, null, 2));
console.log(decision.allow
  ? 'POLÍTICA: elegível para revisão final humana. Nenhum merge foi executado.'
  : 'POLÍTICA: bloqueada. Nenhum merge foi executado.');
