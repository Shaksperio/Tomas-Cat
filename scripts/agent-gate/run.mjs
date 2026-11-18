// Avalia uma PR de agente. Executa a partir da branch padrão, nunca do código da PR.
// Este MVP é somente informativo: não possui endpoint nem permissão para fazer merge.
import { DEFAULT_GATE_CONFIG, evaluateGate } from './policy.ts';

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA, AGENT_GATE_AUTHORS } = process.env;
// Lista de contas autorizadas vem de variável de repositório; vazia = falha fechada.
const agentAuthors = (AGENT_GATE_AUTHORS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER || !HEAD_SHA) {
  throw new Error('Contexto incompleto (GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER e HEAD_SHA são obrigatórios); avaliação falhou fechada.');
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
if (pr.head.sha !== HEAD_SHA) { console.log('A PR recebeu novos commits depois deste CI; avaliação descartada, aguardando novo CI.'); process.exit(0); }
if (!pr.head.repo?.full_name) throw new Error('Não foi possível confirmar o repositório de origem; avaliação falhou fechada.');

// Coleções da API são paginadas. Nunca avaliar uma lista truncada como se estivesse completa.
const collection = async (path, key = null) => {
  const all = [];
  for (let page = 1; page <= 10; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const payload = await api(`${path}${separator}per_page=100&page=${page}`);
    const items = key ? payload[key] : payload;
    if (!Array.isArray(items)) throw new Error(`Resposta inválida ao paginar ${path}; avaliação falhou fechada.`);
    all.push(...items);
    if (items.length < 100) {
      if (key && Number.isFinite(payload.total_count) && all.length < payload.total_count) {
        throw new Error(`Coleção ${path} incompleta (${all.length}/${payload.total_count}); avaliação falhou fechada.`);
      }
      return all;
    }
  }
  throw new Error(`Coleção ${path} excedeu o limite seguro de paginação; avaliação falhou fechada.`);
};
const searchCount = async (query) => {
  const result = await api(`/search/issues?q=${encodeURIComponent(query)}&per_page=1`);
  if (result.incomplete_results || !Number.isFinite(result.total_count) || result.total_count > 1000) {
    throw new Error('Resultado de busca incompleto ou acima do limite da API; avaliação falhou fechada.');
  }
  return result.total_count;
};

const [files, checks, reviewList, mergedToday, openAgentPrs] = await Promise.all([
  collection(`${repo}/pulls/${PR_NUMBER}/files`),
  collection(`${repo}/commits/${pr.head.sha}/check-runs`, 'check_runs'),
  collection(`${repo}/pulls/${PR_NUMBER}/reviews`),
  searchCount(`repo:${GITHUB_REPOSITORY} is:pr is:merged label:${DEFAULT_GATE_CONFIG.label} merged:>=${new Date().toISOString().slice(0, 10)}`),
  searchCount(`repo:${GITHUB_REPOSITORY} is:pr is:open label:${DEFAULT_GATE_CONFIG.label}`),
]);

// A revisão mais recente de cada pessoa prevalece; APPROVED antigo não sobrevive a CHANGES_REQUESTED.
const latestByUser = new Map();
for (const review of reviewList.filter((item) => item.user).sort((a, b) =>
  new Date(a.submitted_at ?? 0).getTime() - new Date(b.submitted_at ?? 0).getTime())) {
  latestByUser.set(review.user.login, review);
}

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
